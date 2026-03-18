#!/usr/bin/env node

import { createRequire } from "node:module";
import process from "node:process";
import { DEFAULT_EVENT_TEMPLATES, DEFAULT_MENU_SECTIONS } from "../src/data/mockCatalog.js";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");

const MAX_BATCH_WRITES = 450;

function slugify(value, fallback = "item") {
  const raw = String(value || fallback).trim().toLowerCase();
  const slug = raw
    .replace(/[^\w-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

function uniqueEventTypes() {
  const seen = new Set();
  return DEFAULT_EVENT_TEMPLATES
    .map((template) => ({
      id: slugify(template.id || template.name, "event"),
      name: String(template.name || template.id || "Event").trim()
    }))
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeSectionItems(section) {
  const source = Array.isArray(section?.items) ? section.items : [];
  const seen = new Set();
  const normalizePricingType = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "per_person" || raw === "per_item" || raw === "per_event") return raw;
    return "per_event";
  };
  return source
    .map((item, index) => {
      if (typeof item === "string") {
        const name = item.trim();
        return {
          id: slugify(name, `item-${index + 1}`),
          name: name || `Item ${index + 1}`,
          pricingType: "per_event",
          type: "per_event",
          price: 0,
          active: true
        };
      }
      const name = String(item?.name || "").trim();
      const pricingType = normalizePricingType(item?.pricingType || item?.type);
      return {
        id: slugify(item?.id || name, `item-${index + 1}`),
        name: name || `Item ${index + 1}`,
        pricingType,
        type: pricingType,
        price: Number(item?.price || 0),
        active: item?.active !== false
      };
    })
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function buildSeedDocs(nowISO) {
  const eventTypeDocs = [];
  const categoryDocs = [];
  const itemDocs = [];
  const eventTypes = uniqueEventTypes();

  eventTypes.forEach((eventType) => {
    eventTypeDocs.push({
      id: eventType.id,
      data: {
        name: eventType.name,
        source: "seed-script",
        createdAtISO: nowISO
      }
    });

    DEFAULT_MENU_SECTIONS.forEach((section, sectionIndex) => {
      const sectionIdBase = slugify(section?.id || section?.name, `category-${sectionIndex + 1}`);
      const categoryId = `${eventType.id}__${sectionIdBase}`;

      categoryDocs.push({
        id: categoryId,
        data: {
          eventTypeId: eventType.id,
          name: String(section?.name || `Category ${sectionIndex + 1}`).trim(),
          source: "seed-script",
          createdAtISO: nowISO
        }
      });

      const sectionItems = normalizeSectionItems(section);
      sectionItems.forEach((item, itemIndex) => {
        const itemId = `${categoryId}__${slugify(item.id, `item-${itemIndex + 1}`)}`;
        itemDocs.push({
          id: itemId,
          data: {
            eventTypeId: eventType.id,
            categoryId,
            name: item.name,
            pricingType: item.pricingType,
            type: item.type,
            price: Number(item.price || 0),
            active: item.active !== false,
            source: "seed-script",
            createdAtISO: nowISO
          }
        });
      });
    });
  });

  return { eventTypeDocs, categoryDocs, itemDocs };
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  let projectId = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    const token = String(args[i] || "").trim();
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (token === "--project") {
      projectId = String(args[i + 1] || "").trim();
      i += 1;
    }
  }

  return {
    projectId:
      projectId ||
      String(process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
    dryRun
  };
}

async function fetchMissingDocs(db, collectionName, docs) {
  if (!docs.length) {
    return { missing: [], existingCount: 0 };
  }
  const refs = docs.map((entry) => db.collection(collectionName).doc(entry.id));
  const snapshots = await db.getAll(...refs);
  const missing = [];
  let existingCount = 0;

  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists) {
      existingCount += 1;
      return;
    }
    missing.push(docs[index]);
  });

  return { missing, existingCount };
}

async function createDocsInBatches(db, collectionName, docs, { merge = false } = {}) {
  let created = 0;
  for (let i = 0; i < docs.length; i += MAX_BATCH_WRITES) {
    const chunk = docs.slice(i, i + MAX_BATCH_WRITES);
    const batch = db.batch();
    chunk.forEach((entry) => {
      batch.set(db.collection(collectionName).doc(entry.id), entry.data, { merge });
    });
    await batch.commit();
    created += chunk.length;
  }
  return created;
}

async function seedCollection({ db, collectionName, docs, dryRun }) {
  const { missing, existingCount } = await fetchMissingDocs(db, collectionName, docs);
  if (dryRun || missing.length === 0) {
    return {
      total: docs.length,
      existing: existingCount,
      created: dryRun ? 0 : 0,
      wouldCreate: dryRun ? missing.length : 0,
      backfilled: 0,
      wouldBackfill: 0
    };
  }

  const created = await createDocsInBatches(db, collectionName, missing);
  return {
    total: docs.length,
    existing: existingCount,
    created,
    wouldCreate: 0,
    backfilled: 0,
    wouldBackfill: 0
  };
}

function normalizePricingType(value, fallback = "per_event") {
  const raw = String(value || fallback).trim().toLowerCase();
  if (raw === "per_person" || raw === "per_item" || raw === "per_event") return raw;
  return fallback;
}

async function seedMenuItemsCollection({ db, docs, dryRun }) {
  if (!docs.length) {
    return {
      total: 0,
      existing: 0,
      created: 0,
      backfilled: 0,
      wouldCreate: 0,
      wouldBackfill: 0
    };
  }

  const refs = docs.map((entry) => db.collection("menuItems").doc(entry.id));
  const snapshots = await db.getAll(...refs);
  const missing = [];
  const backfill = [];
  let existing = 0;

  snapshots.forEach((snapshot, index) => {
    const entry = docs[index];
    if (!snapshot.exists) {
      missing.push(entry);
      return;
    }
    existing += 1;
    const current = snapshot.data() || {};
    const resolvedPricingType = normalizePricingType(current.pricingType || current.type || entry.data.pricingType, "per_event");
    const patch = {};
    if (current.pricingType !== resolvedPricingType) patch.pricingType = resolvedPricingType;
    if (current.type !== resolvedPricingType) patch.type = resolvedPricingType;
    if (typeof current.active !== "boolean") patch.active = true;
    if (!Object.keys(patch).length) return;
    backfill.push({
      id: entry.id,
      data: {
        ...patch,
        updatedAtISO: new Date().toISOString()
      }
    });
  });

  if (dryRun) {
    return {
      total: docs.length,
      existing,
      created: 0,
      backfilled: 0,
      wouldCreate: missing.length,
      wouldBackfill: backfill.length
    };
  }

  const created = missing.length ? await createDocsInBatches(db, "menuItems", missing) : 0;
  const backfilled = backfill.length ? await createDocsInBatches(db, "menuItems", backfill, { merge: true }) : 0;

  return {
    total: docs.length,
    existing,
    created,
    backfilled,
    wouldCreate: 0,
    wouldBackfill: 0
  };
}

async function main() {
  const { projectId, dryRun } = parseArgs(process.argv.slice(2));

  if (!admin.apps.length) {
    const options = projectId ? { projectId } : {};
    admin.initializeApp(options);
  }

  const db = admin.firestore();
  const nowISO = new Date().toISOString();
  const { eventTypeDocs, categoryDocs, itemDocs } = buildSeedDocs(nowISO);

  const [eventTypeSummary, categorySummary, itemSummary] = await Promise.all([
    seedCollection({ db, collectionName: "eventTypes", docs: eventTypeDocs, dryRun }),
    seedCollection({ db, collectionName: "menuCategories", docs: categoryDocs, dryRun }),
    seedMenuItemsCollection({ db, docs: itemDocs, dryRun })
  ]);

  const label = dryRun ? "Dry run completed." : "Seed completed.";
  console.log(label);
  console.log(`Project: ${projectId || "(auto-detected)"}`);
  console.log(
    `eventTypes -> total:${eventTypeSummary.total} existing:${eventTypeSummary.existing} created:${eventTypeSummary.created}`
    + (dryRun ? ` wouldCreate:${eventTypeSummary.wouldCreate}` : "")
  );
  console.log(
    `menuCategories -> total:${categorySummary.total} existing:${categorySummary.existing} created:${categorySummary.created}`
    + (dryRun ? ` wouldCreate:${categorySummary.wouldCreate}` : "")
  );
  console.log(
    `menuItems -> total:${itemSummary.total} existing:${itemSummary.existing} created:${itemSummary.created}`
    + `${dryRun ? ` wouldCreate:${itemSummary.wouldCreate}` : ""}`
    + ` backfilled:${itemSummary.backfilled}`
    + `${dryRun ? ` wouldBackfill:${itemSummary.wouldBackfill}` : ""}`
  );
}

main().catch((error) => {
  console.error("Menu seed failed:", error?.message || error);
  process.exitCode = 1;
});
