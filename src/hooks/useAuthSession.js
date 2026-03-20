import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { signOutCurrentUser } from "../lib/authClient";
import { auth, cloudFunctions, db, firebaseReady } from "../lib/firebase";
import { buildOrganizationProfile, DEFAULT_ORGANIZATION_ID, resolveOrganizationId } from "../lib/organizationService";
import { recordDiagnosticError, recordDiagnosticEvent } from "../lib/sessionDiagnostics";

const ROLE_VALUES = new Set(["admin", "sales", "customer"]);
const E2E_AUTH_BYPASS = ["1", "true", "yes", "on"].includes(
  String(import.meta.env.VITE_E2E_BYPASS_AUTH || "").trim().toLowerCase()
);
const E2E_ROLE = ROLE_VALUES.has(String(import.meta.env.VITE_E2E_ROLE || "").trim().toLowerCase())
  ? String(import.meta.env.VITE_E2E_ROLE || "").trim().toLowerCase()
  : "admin";
const E2E_EMAIL = String(import.meta.env.VITE_E2E_EMAIL || "e2e-admin@local.test").trim().toLowerCase();
const E2E_UID = String(import.meta.env.VITE_E2E_UID || "e2e-admin").trim() || "e2e-admin";
const ORG_BOOTSTRAP_CALLABLE = "ensureOrganizationBootstrap";
const BOOTSTRAP_ADMINS = new Set(
  [
    "tonitastefultouch@yahoo.com",
    ...(String(import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAILS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean))
  ].map((value) => value.toLowerCase())
);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ROLE_VALUES.has(role) ? role : "customer";
}

function generateOrganizationId() {
  if (!db) return "";
  return doc(collection(db, "organizations")).id;
}

async function loadOrCreateRoleLegacy(user) {
  if (!user || !db) {
    return {
      role: "customer",
      organizationId: resolveOrganizationId("", "")
    };
  }

  const email = normalizeEmail(user.email);
  const bootstrapRole = BOOTSTRAP_ADMINS.has(email) ? "admin" : "customer";
  const generatedOrganizationId = generateOrganizationId();
  const defaultOrganizationId = bootstrapRole === "admin"
    ? resolveOrganizationId(generatedOrganizationId, DEFAULT_ORGANIZATION_ID)
    : resolveOrganizationId("", "");
  const roleRef = doc(db, "userRoles", user.uid);
  const roleSnap = await getDoc(roleRef);
  if (roleSnap.exists()) {
    const existing = roleSnap.data() || {};
    const role = normalizeRole(existing.role);
    const roleFallbackOrgId = role === "admin" || role === "sales"
      ? resolveOrganizationId(generatedOrganizationId, DEFAULT_ORGANIZATION_ID)
      : "";
    const organizationId = resolveOrganizationId(existing.organizationId, roleFallbackOrgId);

    if (!existing.organizationId) {
      await setDoc(roleRef, {
        organizationId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    if (role === "admin") {
      const orgRef = doc(db, "organizations", organizationId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) {
        const organizationProfile = buildOrganizationProfile({
          organizationId,
          name: "Default Organization",
          slug: "default-organization",
          ownerUid: user.uid,
          ownerEmail: email
        });
        await setDoc(orgRef, {
          name: organizationProfile.name,
          slug: organizationProfile.slug,
          ownerUid: organizationProfile.ownerUid,
          ownerEmail: organizationProfile.ownerEmail,
          updatedAtISO: organizationProfile.updatedAtISO,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    return { role, organizationId };
  }

  await setDoc(roleRef, {
    role: bootstrapRole,
    email,
    organizationId: defaultOrganizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (bootstrapRole === "admin") {
    const orgRef = doc(db, "organizations", defaultOrganizationId);
    const organizationProfile = buildOrganizationProfile({
      organizationId: defaultOrganizationId,
      name: "Default Organization",
      slug: "default-organization",
      ownerUid: user.uid,
      ownerEmail: email
    });
    await setDoc(orgRef, {
      name: organizationProfile.name,
      slug: organizationProfile.slug,
      ownerUid: organizationProfile.ownerUid,
      ownerEmail: organizationProfile.ownerEmail,
      updatedAtISO: organizationProfile.updatedAtISO,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  return {
    role: bootstrapRole,
    organizationId: defaultOrganizationId
  };
}

async function bootstrapRoleWithCallable(user) {
  if (!cloudFunctions || !user) {
    throw new Error("Callable organization bootstrap is unavailable.");
  }
  const call = httpsCallable(cloudFunctions, ORG_BOOTSTRAP_CALLABLE);
  const result = await call({});
  const data = result?.data || {};
  return {
    role: normalizeRole(data.role),
    organizationId: resolveOrganizationId(data.organizationId, "")
  };
}

async function loadOrCreateRole(user) {
  if (!user || !db) {
    return {
      role: "customer",
      organizationId: resolveOrganizationId("", "")
    };
  }

  try {
    const callableResult = await bootstrapRoleWithCallable(user);
    if (callableResult.organizationId || callableResult.role !== "customer") {
      return callableResult;
    }
  } catch (err) {
    recordDiagnosticEvent({
      level: "warning",
      type: "auth.org-bootstrap.callable-fallback",
      message: err?.message || "Falling back to client role bootstrap."
    });
  }

  return loadOrCreateRoleLegacy(user);
}

export function useAuthSession() {
  const [state, setState] = useState({
    loading: true,
    user: null,
    role: "customer",
    organizationId: resolveOrganizationId("", ""),
    error: ""
  });

  useEffect(() => {
    let active = true;

    if (E2E_AUTH_BYPASS) {
      setState({
        loading: false,
        user: {
          uid: E2E_UID,
          email: E2E_EMAIL
        },
        role: E2E_ROLE,
        organizationId: resolveOrganizationId("", ""),
        error: ""
      });
      return () => {
        active = false;
      };
    }

    if (!firebaseReady || !auth || !db) {
      recordDiagnosticEvent({
        level: "warning",
        type: "auth.unavailable",
        message: "Firebase auth unavailable in current session."
      });
      setState({
        loading: false,
        user: null,
        role: "customer",
        organizationId: resolveOrganizationId("", ""),
        error: "Firebase Auth is unavailable. Check env config."
      });
      return () => {
        active = false;
      };
    }

    const stop = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      if (!nextUser) {
        setState({
          loading: false,
          user: null,
          role: "customer",
          organizationId: resolveOrganizationId("", ""),
          error: ""
        });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const tokenResult = await nextUser.getIdTokenResult();
        const claimRole = normalizeRole(tokenResult?.claims?.role);
        const roleRecord = await loadOrCreateRole(nextUser);
        const role = claimRole !== "customer" ? claimRole : roleRecord.role;
        if (!active) return;
        setState({
          loading: false,
          user: nextUser,
          role,
          organizationId: resolveOrganizationId(roleRecord.organizationId, ""),
          error: ""
        });
      } catch (err) {
        if (!active) return;
        recordDiagnosticError(err, {
          surface: "auth-session",
          action: "resolve-role",
          uid: nextUser?.uid || ""
        });
        setState({
          loading: false,
          user: nextUser,
          role: "customer",
          organizationId: resolveOrganizationId("", ""),
          error: err?.message || "Failed to load role data."
        });
      }
    });

    return () => {
      active = false;
      stop();
    };
  }, []);

  const roleFlags = useMemo(() => {
    const isAdmin = state.role === "admin";
    const isStaff = isAdmin || state.role === "sales";
    return { isAdmin, isStaff };
  }, [state.role]);

  return {
    ...state,
    ...roleFlags,
    signOut: E2E_AUTH_BYPASS
      ? async () => {
        setState({
          loading: false,
          user: null,
          role: "customer",
          organizationId: resolveOrganizationId("", ""),
          error: ""
        });
      }
      : signOutCurrentUser
  };
}
