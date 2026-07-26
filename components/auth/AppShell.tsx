"use client";

import React from "react";
import { Show } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { LandingPage } from "../landing/LandingPage";
import { DashboardLayout } from "../layout/DashboardLayout";

const PUBLIC_AUTH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/session-tasks",
];

/**
 * Pending session tasks (e.g. choose-organization) are treated as signed-out.
 * Auth/task routes must still render their own pages, otherwise LandingPage
 * replaces the SignIn / TaskChooseOrganization UI and the flow appears stuck.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isAuthRoute = PUBLIC_AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Show when="signed-out">
        <LandingPage />
      </Show>
      <Show when="signed-in">
        <DashboardLayout>{children}</DashboardLayout>
      </Show>
    </>
  );
}
