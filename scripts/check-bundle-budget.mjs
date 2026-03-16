import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIST_ASSETS_DIR = path.join(ROOT, "dist", "assets");
const BUDGET_FILE = path.join(ROOT, "docs", "performance", "bundle-budget.json");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function collectJsMetrics() {
  if (!fs.existsSync(DIST_ASSETS_DIR)) {
    throw new Error(`Missing ${DIST_ASSETS_DIR}. Run npm run build first.`);
  }

  const files = fs
    .readdirSync(DIST_ASSETS_DIR)
    .filter((name) => name.endsWith(".js"))
    .sort();

  if (!files.length) {
    throw new Error(`No JavaScript assets found in ${DIST_ASSETS_DIR}.`);
  }

  let totalJsBytes = 0;
  let largestJsChunkBytes = 0;

  for (const file of files) {
    const fullPath = path.join(DIST_ASSETS_DIR, file);
    const size = fs.statSync(fullPath).size;
    totalJsBytes += size;
    largestJsChunkBytes = Math.max(largestJsChunkBytes, size);
  }

  return { totalJsBytes, largestJsChunkBytes };
}

const current = collectJsMetrics();

if (UPDATE_BASELINE) {
  const existing = fs.existsSync(BUDGET_FILE)
    ? readJson(BUDGET_FILE)
    : { allowancePercent: 15 };

  const baseline = {
    generatedAt: toDateStamp(),
    allowancePercent: Number(existing.allowancePercent ?? 15),
    metrics: current
  };

  writeJson(BUDGET_FILE, baseline);
  console.log(`Updated bundle baseline in ${path.relative(ROOT, BUDGET_FILE)}`);
  console.log(JSON.stringify(baseline, null, 2));
  process.exit(0);
}

if (!fs.existsSync(BUDGET_FILE)) {
  throw new Error(
    `Missing ${path.relative(ROOT, BUDGET_FILE)}. Run npm run check:perf:bundle -- --update-baseline`
  );
}

const baseline = readJson(BUDGET_FILE);
const allowance = Number(baseline.allowancePercent ?? 15) / 100;
const maxTotal = Math.round(baseline.metrics.totalJsBytes * (1 + allowance));
const maxLargest = Math.round(baseline.metrics.largestJsChunkBytes * (1 + allowance));

const failures = [];
if (current.totalJsBytes > maxTotal) {
  failures.push(
    `totalJsBytes ${current.totalJsBytes} exceeds allowed ${maxTotal} (baseline ${baseline.metrics.totalJsBytes}, +${baseline.allowancePercent}%)`
  );
}
if (current.largestJsChunkBytes > maxLargest) {
  failures.push(
    `largestJsChunkBytes ${current.largestJsChunkBytes} exceeds allowed ${maxLargest} (baseline ${baseline.metrics.largestJsChunkBytes}, +${baseline.allowancePercent}%)`
  );
}

console.log("Bundle budget baseline:", baseline.metrics);
console.log("Current bundle metrics:", current);
console.log("Allowance percent:", baseline.allowancePercent);

if (failures.length) {
  console.error("Bundle budget check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Bundle budget check passed.");
