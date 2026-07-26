"use client";

import React, { Suspense, useEffect, useMemo } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";

function AcceptInvitationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();

  const ticket = searchParams.get("__clerk_ticket");
  const status = searchParams.get("__clerk_status");

  // Absolute URLs keep post-accept redirects on this host instead of Clerk's
  // Account Portal default (often localhost on development instances).
  const afterAcceptUrl = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.origin}/`;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn || status === "complete") {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, status, router]);

  if (!ticket) {
    return (
      <div className="mx-auto max-w-md space-y-3 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Invalid invitation
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This invitation link is missing or expired. Ask your admin to send a
          new invite.
        </p>
      </div>
    );
  }

  if (status === "complete" || isSignedIn) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Invitation accepted. Redirecting…
      </p>
    );
  }

  if (status === "sign_up") {
    return (
      <SignUp
        forceRedirectUrl={afterAcceptUrl}
        fallbackRedirectUrl={afterAcceptUrl}
      />
    );
  }

  return (
    <SignIn
      forceRedirectUrl={afterAcceptUrl}
      fallbackRedirectUrl={afterAcceptUrl}
    />
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense
        fallback={
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading invitation…
          </p>
        }
      >
        <AcceptInvitationInner />
      </Suspense>
    </div>
  );
}
