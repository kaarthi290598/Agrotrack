import { AuthConfig } from "convex/server";

/**
 * One Clerk Frontend API URL per Convex deployment (Convex dashboard env):
 *
 *   Dev  → CLERK_FRONTEND_API_URL=https://welcome-phoenix-36.clerk.accounts.dev
 *   Prod → CLERK_FRONTEND_API_URL=https://clerk.arkit.online
 *
 * Set with: npx convex env set CLERK_FRONTEND_API_URL <url>
 * Prod:     npx convex env --prod set CLERK_FRONTEND_API_URL <url>
 *
 * Do not list both issuers here — that allows cross-environment tokens.
 * CLERK_JWT_ISSUER_DOMAIN is accepted as a legacy alias (same value).
 */
const clerkFrontendApiUrl =
  process.env.CLERK_FRONTEND_API_URL || process.env.CLERK_JWT_ISSUER_DOMAIN;

export default {
  providers: [
    {
      domain: clerkFrontendApiUrl!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
