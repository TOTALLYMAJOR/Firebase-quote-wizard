import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

function createStorageMock() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((key) => delete store[key]);
    }
  };
}

function stubBrowserGlobals() {
  const localStorage = createStorageMock();
  const addEventListener = vi.fn();
  vi.stubGlobal("window", {
    localStorage,
    location: {
      href: "http://localhost:4173/",
      pathname: "/"
    },
    innerWidth: 1440,
    innerHeight: 900,
    addEventListener
  });
  vi.stubGlobal("document", {
    referrer: "http://localhost/referrer"
  });
  vi.stubGlobal("navigator", {
    userAgent: "vitest-agent",
    language: "en-US"
  });
  return { localStorage, addEventListener };
}

describe("sessionDiagnostics", () => {
  beforeEach(() => {
    vi.resetModules();
    stubBrowserGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("initializes session diagnostics and records session start", async () => {
    const diagnostics = await import("../sessionDiagnostics");

    diagnostics.initSessionDiagnostics({ appVersion: "0.1.0-test" });
    const snapshot = diagnostics.readSessionDiagnostics();

    expect(snapshot.session.appVersion).toBe("0.1.0-test");
    expect(snapshot.session.sessionId).not.toBe("");
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(1);
    expect(snapshot.events[0].type).toBe("session.start");
  });

  test("records errors with context and user session details", async () => {
    const diagnostics = await import("../sessionDiagnostics");

    diagnostics.initSessionDiagnostics({ appVersion: "0.1.0-test" });
    diagnostics.setDiagnosticsUserContext({
      uid: "abc-123",
      email: "staff@example.com",
      role: "admin",
      authenticated: true
    });
    diagnostics.recordDiagnosticError(new Error("Quote save failed"), {
      surface: "app",
      action: "submit-quote"
    });

    const snapshot = diagnostics.readSessionDiagnostics();
    const top = snapshot.events[0];
    expect(snapshot.session.user.email).toBe("staff@example.com");
    expect(top.level).toBe("error");
    expect(top.message).toContain("Quote save failed");
    expect(top.context.surface).toBe("app");
    expect(snapshot.summary.errors).toBeGreaterThanOrEqual(1);
  });

  test("clears captured events while keeping session metadata", async () => {
    const diagnostics = await import("../sessionDiagnostics");

    diagnostics.initSessionDiagnostics({ appVersion: "0.1.0-test" });
    diagnostics.recordDiagnosticEvent({
      level: "warning",
      type: "catalog.load",
      message: "Catalog fallback used"
    });

    let snapshot = diagnostics.readSessionDiagnostics();
    expect(snapshot.summary.total).toBeGreaterThan(0);

    diagnostics.clearSessionDiagnostics();
    snapshot = diagnostics.readSessionDiagnostics();
    expect(snapshot.summary.total).toBe(0);
    expect(snapshot.session.sessionId).not.toBe("");
  });
});
