/**
 * Environment pairing for Clerk ↔ Convex.
 *
 * Local / Preview (development):
 *   Clerk pk_test_…  →  Convex different-puffin-360
 *   Issuer: https://welcome-phoenix-36.clerk.accounts.dev
 *
 * Production (arkit.online):
 *   Clerk pk_live_…  →  Convex grandiose-bulldog-410
 *   Issuer: https://clerk.arkit.online
 */

export const CONVEX_DEV_URL = "https://different-puffin-360.convex.cloud";
export const CONVEX_PROD_URL = "https://grandiose-bulldog-410.convex.cloud";

export const CLERK_DEV_ISSUER =
  "https://welcome-phoenix-36.clerk.accounts.dev";
export const CLERK_PROD_ISSUER = "https://clerk.arkit.online";

export function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is required. " +
        `Dev: ${CONVEX_DEV_URL} | Prod: ${CONVEX_PROD_URL}`
    );
  }
  return url;
}

/**
 * Fail fast when Clerk keys and Convex URL belong to different environments.
 * Call from client providers and server entry points that talk to Convex.
 */
export function assertClerkConvexPairing(context = "app"): void {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const secret = process.env.CLERK_SECRET_KEY || "";
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

  if (!convexUrl) return;

  const isLiveClerk =
    publishable.startsWith("pk_live_") || secret.startsWith("sk_live_");
  const isTestClerk =
    publishable.startsWith("pk_test_") || secret.startsWith("sk_test_");
  const isProdConvex = convexUrl.includes("grandiose-bulldog-410");
  const isDevConvex = convexUrl.includes("different-puffin-360");

  if (isLiveClerk && isDevConvex) {
    throw new Error(
      `[${context}] Misconfigured environment: Clerk PRODUCTION keys ` +
        `are paired with Convex DEVELOPMENT (${CONVEX_DEV_URL}). ` +
        `Set NEXT_PUBLIC_CONVEX_URL=${CONVEX_PROD_URL} on production.`
    );
  }

  if (isTestClerk && !isLiveClerk && isProdConvex) {
    throw new Error(
      `[${context}] Misconfigured environment: Clerk DEVELOPMENT keys ` +
        `are paired with Convex PRODUCTION (${CONVEX_PROD_URL}). ` +
        `Set NEXT_PUBLIC_CONVEX_URL=${CONVEX_DEV_URL} for local/dev.`
    );
  }
}
