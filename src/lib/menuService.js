import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { db, firebaseReady } from "./firebase";
import {
  allowLegacyGlobalFallback,
  getActiveOrganizationId,
  getOrganizationCollectionRef,
  getOrganizationSubDocRef,
  normalizeOrganizationId
} from "./organizationService";

function ensureReady() {
  if (!firebaseReady || !db) {
    throw new Error("Firebase is not configured.");
  }
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePriceType(value) {
  if (value === "per_person" || value === "per_item" || value === "per_event") {
    return value;
  }
  return "per_event";
}

function normalizeActive(value, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function mapDocs(snapshot) {
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

function sortByName(items) {
  return [...items].sort((a, b) => asText(a?.name).localeCompare(asText(b?.name)));
}

function resolveScopedOrganizationId(organizationId = "") {
  return normalizeOrganizationId(organizationId || getActiveOrganizationId());
}

function requireOrganizationId(organizationId = "", action = "menu operation") {
  const resolvedOrgId = resolveScopedOrganizationId(organizationId);
  if (!resolvedOrgId) {
    throw new Error(`organizationId is required for ${action}.`);
  }
  return resolvedOrgId;
}

function orgCollectionRef(collectionName, organizationId) {
  return getOrganizationCollectionRef(collectionName, organizationId);
}

function orgDocRef(collectionName, docId, organizationId) {
  return getOrganizationSubDocRef(collectionName, docId, organizationId);
}

export async function getEventTypes({ organizationId = "" } = {}) {
  if (!firebaseReady || !db) return [];
  const resolvedOrgId = resolveScopedOrganizationId(organizationId);
  const mapEventType = (item) => ({
    ...item,
    name: asText(item.name, "Untitled Event Type")
  });

  if (!resolvedOrgId) {
    if (!allowLegacyGlobalFallback()) {
      return [];
    }
    const legacySnap = await getDocs(query(collection(db, "eventTypes")));
    return sortByName(mapDocs(legacySnap).map(mapEventType));
  }

  const scopedSnap = await getDocs(query(orgCollectionRef("eventTypes", resolvedOrgId)));
  const scopedItems = mapDocs(scopedSnap).map(mapEventType);
  if (scopedItems.length || !allowLegacyGlobalFallback()) {
    return sortByName(scopedItems);
  }
  const legacySnap = await getDocs(query(collection(db, "eventTypes")));
  return sortByName(mapDocs(legacySnap).map(mapEventType));
}

export async function getMenuCategories(eventTypeId, { organizationId = "" } = {}) {
  const nextEventTypeId = asText(eventTypeId);
  if (!nextEventTypeId || !firebaseReady || !db) return [];
  const resolvedOrgId = resolveScopedOrganizationId(organizationId);
  const mapCategory = (item) => ({
    ...item,
    eventTypeId: asText(item.eventTypeId),
    name: asText(item.name, "Untitled Category")
  });

  if (!resolvedOrgId) {
    if (!allowLegacyGlobalFallback()) {
      return [];
    }
    const legacySnap = await getDocs(
      query(collection(db, "menuCategories"), where("eventTypeId", "==", nextEventTypeId))
    );
    return sortByName(mapDocs(legacySnap).map(mapCategory));
  }

  const scopedSnap = await getDocs(
    query(orgCollectionRef("menuCategories", resolvedOrgId), where("eventTypeId", "==", nextEventTypeId))
  );
  const scopedItems = mapDocs(scopedSnap).map(mapCategory);
  if (scopedItems.length || !allowLegacyGlobalFallback()) {
    return sortByName(scopedItems);
  }
  const legacySnap = await getDocs(
    query(collection(db, "menuCategories"), where("eventTypeId", "==", nextEventTypeId))
  );
  return sortByName(mapDocs(legacySnap).map(mapCategory));
}

export async function getMenuItems(eventTypeId, { includeInactive = false, organizationId = "" } = {}) {
  const nextEventTypeId = asText(eventTypeId);
  if (!nextEventTypeId || !firebaseReady || !db) return [];
  const resolvedOrgId = resolveScopedOrganizationId(organizationId);

  const mapItem = (item) => {
    const pricingType = normalizePriceType(item.pricingType || item.type);
    return {
      ...item,
      eventTypeId: asText(item.eventTypeId),
      categoryId: asText(item.categoryId),
      name: asText(item.name, "Untitled Item"),
      price: asNumber(item.price, 0),
      pricingType,
      type: pricingType,
      active: normalizeActive(item.active, true)
    };
  };

  if (!resolvedOrgId) {
    if (!allowLegacyGlobalFallback()) {
      return [];
    }
    const legacySnap = await getDocs(
      query(collection(db, "menuItems"), where("eventTypeId", "==", nextEventTypeId))
    );
    const mapped = mapDocs(legacySnap).map(mapItem);
    return sortByName(includeInactive ? mapped : mapped.filter((item) => item.active !== false));
  }

  const scopedSnap = await getDocs(
    query(orgCollectionRef("menuItems", resolvedOrgId), where("eventTypeId", "==", nextEventTypeId))
  );
  const scopedMapped = mapDocs(scopedSnap).map(mapItem);
  if (scopedMapped.length || !allowLegacyGlobalFallback()) {
    return sortByName(includeInactive ? scopedMapped : scopedMapped.filter((item) => item.active !== false));
  }

  const legacySnap = await getDocs(
    query(collection(db, "menuItems"), where("eventTypeId", "==", nextEventTypeId))
  );
  const mapped = mapDocs(legacySnap).map(mapItem);
  return sortByName(includeInactive ? mapped : mapped.filter((item) => item.active !== false));
}

export async function createMenuItem(data = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(data.organizationId, "createMenuItem");
  const pricingType = normalizePriceType(data.pricingType || data.type);
  const payload = {
    eventTypeId: asText(data.eventTypeId),
    categoryId: asText(data.categoryId),
    name: asText(data.name, "New Menu Item"),
    price: asNumber(data.price, 0),
    pricingType,
    type: pricingType,
    active: normalizeActive(data.active, true),
    createdAtISO: new Date().toISOString()
  };
  if (!payload.eventTypeId) {
    throw new Error("eventTypeId is required.");
  }
  if (!payload.categoryId) {
    throw new Error("categoryId is required.");
  }
  const ref = await addDoc(orgCollectionRef("menuItems", resolvedOrgId), payload);
  return {
    id: ref.id,
    ...payload
  };
}

export async function updateMenuItem(id, data = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(data.organizationId, "updateMenuItem");
  const itemId = asText(id);
  if (!itemId) {
    throw new Error("Menu item id is required.");
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = asText(data.name, "New Menu Item");
  }
  if (Object.prototype.hasOwnProperty.call(data, "price")) {
    payload.price = asNumber(data.price, 0);
  }
  if (Object.prototype.hasOwnProperty.call(data, "categoryId")) {
    payload.categoryId = asText(data.categoryId);
  }
  if (Object.prototype.hasOwnProperty.call(data, "eventTypeId")) {
    payload.eventTypeId = asText(data.eventTypeId);
  }
  if (Object.prototype.hasOwnProperty.call(data, "type")) {
    const pricingType = normalizePriceType(data.type);
    payload.pricingType = pricingType;
    payload.type = pricingType;
  }
  if (Object.prototype.hasOwnProperty.call(data, "pricingType")) {
    const pricingType = normalizePriceType(data.pricingType);
    payload.pricingType = pricingType;
    payload.type = pricingType;
  }
  if (Object.prototype.hasOwnProperty.call(data, "active")) {
    payload.active = normalizeActive(data.active, true);
  }
  payload.updatedAtISO = new Date().toISOString();

  await updateDoc(orgDocRef("menuItems", itemId, resolvedOrgId), payload);
  return {
    id: itemId,
    ...payload
  };
}

export async function deleteMenuItem(id, { organizationId = "" } = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(organizationId, "deleteMenuItem");
  const itemId = asText(id);
  if (!itemId) {
    throw new Error("Menu item id is required.");
  }
  await deleteDoc(orgDocRef("menuItems", itemId, resolvedOrgId));
  return { ok: true, id: itemId };
}

export async function createCategory(data = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(data.organizationId, "createCategory");
  const payload = {
    eventTypeId: asText(data.eventTypeId),
    name: asText(data.name, "New Category"),
    createdAtISO: new Date().toISOString()
  };
  if (!payload.eventTypeId) {
    throw new Error("eventTypeId is required.");
  }
  const ref = await addDoc(orgCollectionRef("menuCategories", resolvedOrgId), payload);
  return {
    id: ref.id,
    ...payload
  };
}

export async function updateCategory(id, data = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(data.organizationId, "updateCategory");
  const categoryId = asText(id);
  if (!categoryId) {
    throw new Error("Category id is required.");
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = asText(data.name, "New Category");
  }
  if (Object.prototype.hasOwnProperty.call(data, "eventTypeId")) {
    payload.eventTypeId = asText(data.eventTypeId);
  }
  payload.updatedAtISO = new Date().toISOString();

  await updateDoc(orgDocRef("menuCategories", categoryId, resolvedOrgId), payload);
  return {
    id: categoryId,
    ...payload
  };
}

export async function createEventType(data = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(data.organizationId, "createEventType");
  const payload = {
    name: asText(data.name, "New Event Type"),
    createdAtISO: new Date().toISOString()
  };
  const ref = await addDoc(orgCollectionRef("eventTypes", resolvedOrgId), payload);
  return {
    id: ref.id,
    ...payload
  };
}

export async function updateEventType(id, data = {}) {
  ensureReady();
  const resolvedOrgId = requireOrganizationId(data.organizationId, "updateEventType");
  const eventTypeId = asText(id);
  if (!eventTypeId) {
    throw new Error("Event type id is required.");
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = asText(data.name, "New Event Type");
  }
  payload.updatedAtISO = new Date().toISOString();

  await updateDoc(orgDocRef("eventTypes", eventTypeId, resolvedOrgId), payload);
  return {
    id: eventTypeId,
    ...payload
  };
}
