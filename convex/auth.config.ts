import { AuthConfig } from "convex/server";

/**
 * One Clerk issuer per Convex deployment (set via Convex dashboard env):
 *
 *   Dev deployment  → CLERK_JWT_ISSUER_DOMAIN=https://welcome-phoenix-36.clerk.accounts.dev
 *   Prod deployment → CLERK_JWT_ISSUER_DOMAIN=https://clerk.arkit.online
 *
 * Do not list both issuers here — that allows cross-environment tokens.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
