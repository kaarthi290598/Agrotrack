/**
 * Quick local check: Clerk keys must match the Convex URL environment.
 * Usage: node scripts/check-env-pairing.mjs
 * Loads .env.local if present (does not override existing process env).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const secret = process.env.CLERK_SECRET_KEY || "";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN || "";

const isLive = publishable.startsWith("pk_live_") || secret.startsWith("sk_live_");
const isTest = publishable.startsWith("pk_test_") || secret.startsWith("sk_test_");
const isProdConvex = convexUrl.includes("grandiose-bulldog-410");
const isDevConvex = convexUrl.includes("different-puffin-360");

console.log("Clerk publishable:", publishable.slice(0, 12) + "…");
console.log("Convex URL:      ", convexUrl || "(missing)");
console.log("JWT issuer:      ", issuer || "(missing)");

if (!convexUrl) {
  console.error("\nFAIL: NEXT_PUBLIC_CONVEX_URL is missing");
  process.exit(1);
}

if (isLive && isDevConvex) {
  console.error("\nFAIL: Clerk PRODUCTION paired with Convex DEVELOPMENT");
  process.exit(1);
}

if (isTest && !isLive && isProdConvex) {
  console.error("\nFAIL: Clerk DEVELOPMENT paired with Convex PRODUCTION");
  process.exit(1);
}

if (isDevConvex && issuer && !issuer.includes("clerk.accounts.dev")) {
  console.warn(
    "\nWARN: Dev Convex usually uses https://welcome-phoenix-36.clerk.accounts.dev"
  );
}

if (isProdConvex && issuer && !issuer.includes("clerk.arkit.online")) {
  console.warn("\nWARN: Prod Convex usually uses https://clerk.arkit.online");
}

console.log("\nOK: Clerk ↔ Convex pairing looks consistent for this env file.");
