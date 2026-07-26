import type { NextRequest } from "next/server";

/**
 * Canonical public origin for this app (no trailing slash).
 * Used for Clerk invitation redirect URLs — those are baked into the email
 * link, so they must never silently fall back to localhost in production.
 */
export function getAppUrl(req?: NextRequest): string {
  const fromEnv = cleanOrigin(process.env.NEXT_PUBLIC_APP_URL);
  if (fromEnv) return fromEnv;

  // Prefer the production domain on Vercel over the per-deployment preview host.
  const vercelProd = cleanOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProd) return vercelProd.startsWith("http") ? vercelProd : `https://${vercelProd}`;

  const vercel = cleanOrigin(process.env.VERCEL_URL);
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;

  if (req) {
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    if (host) {
      const proto =
        req.headers.get("x-forwarded-proto") ||
        (isLocalHost(host) ? "http" : "https");
      return `${proto}://${host}`;
    }
  }

  return "http://localhost:3000";
}

export function isLocalHost(hostOrUrl: string): boolean {
  try {
    const host = hostOrUrl.includes("://")
      ? new URL(hostOrUrl).hostname
      : hostOrUrl.split(":")[0];
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  } catch {
    return /localhost|127\.0\.0\.1/.test(hostOrUrl);
  }
}

function cleanOrigin(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed || null;
}
