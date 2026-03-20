import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ORGANIZATION_ID,
  loadOrganizationProfile,
  normalizeOrganizationId
} from "../lib/organizationService";

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const [organizationId, setOrganizationIdState] = useState("");
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapState, setBootstrapState] = useState("idle");
  const [error, setError] = useState("");

  const setOrganizationId = (nextOrganizationId) => {
    const normalized = normalizeOrganizationId(nextOrganizationId);
    setOrganizationIdState(normalized);
    if (!normalized) {
      setOrganization(null);
      setLoading(false);
      setBootstrapState("idle");
      setError("");
    }
  };

  useEffect(() => {
    let alive = true;
    const normalized = normalizeOrganizationId(organizationId);

    if (!normalized) {
      setOrganization(null);
      setLoading(false);
      setBootstrapState("idle");
      setError("");
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setBootstrapState("loading");
    setError("");

    loadOrganizationProfile(normalized)
      .then((profile) => {
        if (!alive) return;
        setOrganization(profile || null);
        setBootstrapState(profile ? "ready" : "missing");
      })
      .catch((err) => {
        if (!alive) return;
        setOrganization(null);
        setBootstrapState("error");
        setError(err?.message || "Failed to load organization.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [organizationId]);

  const value = useMemo(() => {
    const normalized = normalizeOrganizationId(organizationId);
    return {
      orgId: normalized,
      organization,
      loading,
      bootstrapState,
      error,
      organizationId: normalized,
      effectiveOrganizationId: normalized || DEFAULT_ORGANIZATION_ID,
      ready: Boolean(normalized),
      setOrganizationId
    };
  }, [bootstrapState, error, loading, organization, organizationId]);

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider.");
  }
  return context;
}
