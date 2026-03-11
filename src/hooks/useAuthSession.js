import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { signOutCurrentUser } from "../lib/authClient";
import { auth, db, firebaseReady } from "../lib/firebase";
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

async function loadOrCreateRole(user) {
  if (!user || !db) return "customer";

  const email = normalizeEmail(user.email);
  const bootstrapRole = BOOTSTRAP_ADMINS.has(email) ? "admin" : "customer";
  const roleRef = doc(db, "userRoles", user.uid);
  const roleSnap = await getDoc(roleRef);
  if (roleSnap.exists()) {
    return normalizeRole(roleSnap.data()?.role);
  }

  await setDoc(roleRef, {
    role: bootstrapRole,
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return bootstrapRole;
}

export function useAuthSession() {
  const [state, setState] = useState({
    loading: true,
    user: null,
    role: "customer",
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
        error: "Firebase Auth is unavailable. Check env config."
      });
      return () => {
        active = false;
      };
    }

    const stop = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      if (!nextUser) {
        setState({ loading: false, user: null, role: "customer", error: "" });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const tokenResult = await nextUser.getIdTokenResult();
        const claimRole = normalizeRole(tokenResult?.claims?.role);
        const docRole = await loadOrCreateRole(nextUser);
        const role = claimRole !== "customer" ? claimRole : docRole;
        if (!active) return;
        setState({
          loading: false,
          user: nextUser,
          role,
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
          error: ""
        });
      }
      : signOutCurrentUser
  };
}
