/**
 * Clerk JWT validation for Convex.
 * Issuer must match the Clerk Frontend API domain for this instance.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
