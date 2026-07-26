import { ConvexHttpClient } from "convex/browser";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://different-puffin-360.convex.cloud";

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/** Called from AuthProvider so browser services can attach the Clerk JWT. */
export function setConvexTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter;
}

/**
 * Fresh authenticated Convex client per call (never reuse setAuth on a singleton).
 */
export async function getAuthedConvexClient(): Promise<ConvexHttpClient> {
  if (!tokenGetter) {
    throw new Error("Convex auth is not ready");
  }

  const token =
    (await tokenGetter()) ||
    // Fallback if the "convex" JWT template is missing in Clerk Dashboard
    null;

  if (!token) {
    throw new Error("Unauthenticated");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

export async function getServerAuthedConvex(
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<ConvexHttpClient> {
  const token =
    (await getToken({ template: "convex" })) || (await getToken());
  if (!token) {
    throw new Error("Unauthenticated");
  }
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

export { convexUrl };
