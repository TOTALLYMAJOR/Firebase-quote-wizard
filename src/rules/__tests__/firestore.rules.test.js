import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, afterAll, describe, test } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "quote-wizard-rules";
const RULES_PATH = path.resolve(process.cwd(), "firestore.rules");
const HAS_FIRESTORE_EMULATOR = Boolean(String(process.env.FIRESTORE_EMULATOR_HOST || "").trim());

let testEnv;

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "userRoles", "sales-org-a"), {
      role: "sales",
      email: "sales-a@example.com",
      organizationId: "org-a"
    });
    await setDoc(doc(db, "userRoles", "sales-org-b"), {
      role: "sales",
      email: "sales-b@example.com",
      organizationId: "org-b"
    });
    await setDoc(doc(db, "userRoles", "customer-org-a"), {
      role: "customer",
      email: "customer-a@example.com",
      organizationId: "org-a"
    });
    await setDoc(doc(db, "organizations", "org-a", "quotes", "q1"), {
      ownerUid: "sales-org-a",
      organizationId: "org-a",
      portalKey: "abcdefghijklmnopqrstuvwxyz",
      status: "draft"
    });
  });
}

function versionRefFor(uid, email, orgId, quoteId = "q1", versionId = "v0001") {
  const db = testEnv.authenticatedContext(uid, { email }).firestore();
  return doc(db, "organizations", orgId, "quotes", quoteId, "versions", versionId);
}

function buildVersionPayload(overrides = {}) {
  return {
    quoteId: "q1",
    organizationId: "org-a",
    versionId: "v0001",
    versionNumber: 1,
    createdAtISO: "2026-03-20T00:00:00.000Z",
    reason: "test",
    status: "draft",
    createdBy: {
      uid: "sales-org-a",
      email: "sales-a@example.com",
      role: "sales"
    },
    pricing: {
      pricingVersion: "pricing-v1",
      authority: "server_authoritative",
      calculatedAt: "2026-03-20T00:00:00.000Z",
      inputs: {},
      lineItems: [],
      fees: {},
      tax: {
        rate: 0,
        amount: 0,
        regionId: "local",
        regionName: "Local"
      },
      discountTotal: 0,
      deposit: {
        pct: 0.3,
        amount: 300
      },
      subtotal: 1000,
      grandTotal: 1000,
      rulesSnapshot: {}
    },
    snapshot: {
      id: "q1",
      status: "draft"
    },
    ...overrides
  };
}

const rulesDescribe = HAS_FIRESTORE_EMULATOR ? describe : describe.skip;

rulesDescribe("firestore rules - quote versions", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(RULES_PATH, "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedBaseData();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("org staff can create and read version docs in own org", async () => {
    const ref = versionRefFor("sales-org-a", "sales-a@example.com", "org-a");
    await assertSucceeds(setDoc(ref, buildVersionPayload()));
    await assertSucceeds(getDoc(ref));
  });

  test("version docs are immutable after create", async () => {
    const ref = versionRefFor("sales-org-a", "sales-a@example.com", "org-a");
    await assertSucceeds(setDoc(ref, buildVersionPayload()));

    await assertFails(updateDoc(ref, { reason: "mutated" }));
    await assertFails(deleteDoc(ref));
  });

  test("cross-org staff and customers cannot create/read org version docs", async () => {
    const crossOrgRef = versionRefFor("sales-org-a", "sales-a@example.com", "org-b", "q1", "v0001");
    await assertFails(setDoc(crossOrgRef, buildVersionPayload({
      organizationId: "org-b"
    })));

    const customerRef = versionRefFor("customer-org-a", "customer-a@example.com", "org-a", "q1", "v0001");
    await assertFails(setDoc(customerRef, buildVersionPayload()));
    await assertFails(getDoc(customerRef));
  });
});
