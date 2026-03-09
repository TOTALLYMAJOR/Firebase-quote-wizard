import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { auth, firebaseReady } from "./firebase";

function ensureAuth() {
  if (!firebaseReady || !auth) {
    throw new Error("Firebase Auth is not configured. Add VITE_FIREBASE_* env vars.");
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function signInWithEmail({ email, password }) {
  ensureAuth();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required.");
  }
  await signInWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function registerWithEmail({ email, password }) {
  ensureAuth();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new Error("Email and password are required.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  await createUserWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function signInWithGoogle() {
  ensureAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

export async function signOutCurrentUser() {
  ensureAuth();
  await signOut(auth);
}
