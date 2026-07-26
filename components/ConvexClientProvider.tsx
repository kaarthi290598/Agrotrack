"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { ReactNode, useCallback, useMemo } from "react";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://different-puffin-360.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

/**
 * Always use the Clerk "convex" JWT template so custom claims (org_id, org_role)
 * reach Convex. ConvexProviderWithClerk may fall back to the raw session token
 * when sessionClaims.aud === "convex", which omits template claims.
 */
function useConvexClerkAuth() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionId } =
    useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const token = await getToken({
          template: "convex",
          skipCache: forceRefreshToken,
        });
        if (!token) {
          console.warn(
            'Clerk getToken({ template: "convex" }) returned null. Ensure the JWT template named "convex" exists.'
          );
        }
        return token;
      } catch (err) {
        console.error("Failed to fetch Convex JWT from Clerk:", err);
        return null;
      }
    },
    // Re-auth when active org/session changes so Convex gets a fresh token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, orgRole, sessionId]
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken]
  );
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexClerkAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
