import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import {
  DEFAULT_ADDONS,
  DEFAULT_PACKAGES,
  DEFAULT_RENTALS,
  DEFAULT_SETTINGS,
  normalizeCatalog,
  toStorageCatalog
} from "../data/mockCatalog";
import { db, firebaseReady } from "../lib/firebase";

const LOCAL_KEY = "quoteWizard.catalog";

function defaultCatalog() {
  return normalizeCatalog({
    packages: DEFAULT_PACKAGES,
    addons: DEFAULT_ADDONS,
    rentals: DEFAULT_RENTALS,
    settings: DEFAULT_SETTINGS
  });
}

async function loadFromFirebase() {
  const [pkgSnap, addSnap, rentSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, "catalogPackages")),
    getDocs(collection(db, "catalogAddons")),
    getDocs(collection(db, "catalogRentals")),
    getDoc(doc(db, "pricing", "settings"))
  ]);

  const raw = {
    packages: pkgSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    addons: addSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    rentals: rentSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    settings: settingsSnap.exists() ? settingsSnap.data() : DEFAULT_SETTINGS
  };

  return normalizeCatalog(raw);
}

async function saveToFirebase(catalog) {
  const [pkgSnap, addSnap, rentSnap] = await Promise.all([
    getDocs(collection(db, "catalogPackages")),
    getDocs(collection(db, "catalogAddons")),
    getDocs(collection(db, "catalogRentals"))
  ]);

  const batch = writeBatch(db);
  const packageIds = new Set(catalog.packages.map((item) => item.id));
  const addonIds = new Set(catalog.addons.map((item) => item.id));
  const rentalIds = new Set(catalog.rentals.map((item) => item.id));

  pkgSnap.docs.forEach((docSnap) => {
    if (!packageIds.has(docSnap.id)) batch.delete(docSnap.ref);
  });
  addSnap.docs.forEach((docSnap) => {
    if (!addonIds.has(docSnap.id)) batch.delete(docSnap.ref);
  });
  rentSnap.docs.forEach((docSnap) => {
    if (!rentalIds.has(docSnap.id)) batch.delete(docSnap.ref);
  });

  catalog.packages.forEach((item) => {
    batch.set(doc(db, "catalogPackages", item.id), {
      name: item.name,
      ppp: Number(item.ppp || 0)
    });
  });
  catalog.addons.forEach((item) => {
    batch.set(doc(db, "catalogAddons", item.id), {
      name: item.name,
      type: item.type,
      price: Number(item.price || 0)
    });
  });
  catalog.rentals.forEach((item) => {
    batch.set(doc(db, "catalogRentals", item.id), {
      name: item.name,
      price: Number(item.price || 0),
      qtyPerGuests: Number(item.qtyPerGuests || 1)
    });
  });

  batch.set(doc(db, "pricing", "settings"), catalog.settings);
  await batch.commit();
}

export function useCatalogData() {
  const [state, setState] = useState(() => ({
    loading: true,
    saving: false,
    source: firebaseReady ? "firebase" : "local-defaults",
    error: "",
    ...defaultCatalog()
  }));

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (firebaseReady) {
          const catalog = await loadFromFirebase();
          if (!alive) return;
          const hasRecords = catalog.packages.length || catalog.addons.length || catalog.rentals.length;
          if (!hasRecords) {
            const defaults = defaultCatalog();
            if (alive) {
              setState((prev) => ({
                ...prev,
                loading: false,
                source: "firebase-empty-defaults",
                ...defaults
              }));
            }
            return;
          }
          localStorage.setItem(LOCAL_KEY, JSON.stringify(toStorageCatalog(catalog)));
          setState((prev) => ({
            ...prev,
            loading: false,
            source: "firebase",
            ...catalog
          }));
          return;
        }

        const cached = localStorage.getItem(LOCAL_KEY);
        const catalog = cached ? normalizeCatalog(JSON.parse(cached)) : defaultCatalog();
        if (!alive) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          source: cached ? "local-cache" : "local-defaults",
          ...catalog
        }));
      } catch (err) {
        if (!alive) return;
        const fallback = defaultCatalog();
        setState((prev) => ({
          ...prev,
          loading: false,
          source: "fallback-defaults",
          error: err?.message || "Failed to load catalog.",
          ...fallback
        }));
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const saveCatalog = useCallback(async (nextCatalog) => {
    const normalized = normalizeCatalog(nextCatalog);
    setState((prev) => ({ ...prev, saving: true, error: "" }));

    try {
      if (firebaseReady) {
        await saveToFirebase(normalized);
      }

      localStorage.setItem(LOCAL_KEY, JSON.stringify(toStorageCatalog(normalized)));
      setState((prev) => ({
        ...prev,
        saving: false,
        source: firebaseReady ? "firebase" : "local-cache",
        ...normalized
      }));
      return { ok: true };
    } catch (err) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error: err?.message || "Failed to save catalog."
      }));
      return { ok: false, error: err?.message || "Failed to save catalog." };
    }
  }, []);

  return {
    ...state,
    saveCatalog
  };
}
