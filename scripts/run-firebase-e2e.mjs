#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectId = process.env.E2E_FIREBASE_PROJECT_ID || "demo-e2e";
const orgId = process.env.E2E_FIREBASE_ORG_ID || "e2e-org";
const email = process.env.E2E_FIREBASE_EMAIL || "e2e-admin@local.test";
const password = process.env.E2E_FIREBASE_PASSWORD || "Passw0rd!";

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("bash", ["./scripts/ensure-local-jre.sh"]);
run("bash", [
  "-lc",
  "for port in 9099 8080 4000 4400 4500; do fuser -k \"${port}/tcp\" >/dev/null 2>&1 || true; done"
]);

const localJre = path.join(rootDir, ".cache", "tools", "jre21");
const env = {
  ...process.env,
  E2E_FIREBASE_PROJECT_ID: projectId,
  E2E_FIREBASE_ORG_ID: orgId,
  E2E_FIREBASE_EMAIL: email,
  E2E_FIREBASE_PASSWORD: password,
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "30000"
};

if (!process.env.JAVA_HOME && fs.existsSync(path.join(localJre, "bin", "java"))) {
  env.JAVA_HOME = localJre;
  env.PATH = `${path.join(localJre, "bin")}${path.delimiter}${process.env.PATH || ""}`;
}

run(
  "npx",
  [
    "firebase-tools",
    "emulators:exec",
    "--project",
    projectId,
    "--only",
    "auth,firestore",
    "bash ./scripts/run-firebase-e2e-inner.sh"
  ],
  { env }
);
