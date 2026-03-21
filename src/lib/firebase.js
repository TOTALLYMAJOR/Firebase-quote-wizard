import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const functionsRegion = String(import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1").trim() || "us-central1";
const shouldUseEmulators = ["1", "true", "yes", "on"].includes(
  String(import.meta.env.VITE_USE_FIREBASE_EMULATORS || "").trim().toLowerCase()
);
const emulatorHost = String(import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1").trim() || "127.0.0.1";
const authEmulatorPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || 9099);
const firestoreEmulatorPort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
const functionsEmulatorPort = Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || 5001);

export const app = hasConfig ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;
export const cloudFunctions = app ? getFunctions(app, functionsRegion) : null;
export const firebaseReady = Boolean(db);

if (app && shouldUseEmulators) {
  if (auth && !globalThis.__quoteWizardAuthEmulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, {
      disableWarnings: true
    });
    globalThis.__quoteWizardAuthEmulatorConnected = true;
  }
  if (db && !globalThis.__quoteWizardFirestoreEmulatorConnected) {
    connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort);
    globalThis.__quoteWizardFirestoreEmulatorConnected = true;
  }
  if (cloudFunctions && !globalThis.__quoteWizardFunctionsEmulatorConnected) {
    connectFunctionsEmulator(cloudFunctions, emulatorHost, functionsEmulatorPort);
    globalThis.__quoteWizardFunctionsEmulatorConnected = true;
  }
}
