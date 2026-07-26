import { ConvexHttpClient } from "convex/browser";
import { assertClerkConvexPairing, getConvexUrl } from "./env";

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
  assertClerkConvexPairing("getAuthedConvexClient");
  if (!tokenGetter) {
    throw new Error("Convex auth is not ready");
  }

  const token = await tokenGetter();
  if (!token) {
    throw new Error("Unauthenticated");
  }

  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  return client;
}

export async function getServerAuthedConvex(
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<ConvexHttpClient> {
  assertClerkConvexPairing("getServerAuthedConvex");
  const token =
    (await getToken({ template: "convex" })) || (await getToken());
  if (!token) {
    throw new Error("Unauthenticated");
  }
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  return client;
}

