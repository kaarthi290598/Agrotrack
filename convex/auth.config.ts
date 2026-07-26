import { AuthConfig } from "convex/server";

/**
 * Accept both Clerk instances:
 * - Development: https://welcome-phoenix-36.clerk.accounts.dev
 * - Production:  https://clerk.arkit.online
 *
 * Prefer setting CLERK_JWT_ISSUER_DOMAIN per Convex deployment, but keep both
 * providers so a mis-pointed NEXT_PUBLIC_CONVEX_URL does not reject valid tokens.
 */
const domains = [
  process.env.CLERK_JWT_ISSUER_DOMAIN,
  "https://welcome-phoenix-36.clerk.accounts.dev",
  "https://clerk.arkit.online",
].filter((d, i, arr): d is string => !!d && arr.indexOf(d) === i);

export default {
  providers: domains.map((domain) => ({
    domain,
    applicationID: "convex",
  })),
} satisfies AuthConfig;
