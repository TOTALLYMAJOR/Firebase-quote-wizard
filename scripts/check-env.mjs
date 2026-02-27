import fs from "node:fs";
import path from "node:path";

const REQUIRED = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      out[key] = value;
    });
  return out;
}

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const dotEnv = readDotEnv(envPath);

const missing = REQUIRED.filter((key) => !(process.env[key] || dotEnv[key]));

if (missing.length) {
  console.error("Missing required Firebase env vars:");
  missing.forEach((key) => console.error(`- ${key}`));
  console.error("\nAdd them to .env (local) or host environment settings (Vercel).");
  process.exit(1);
}

console.log("Firebase env check passed.");
