"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserProfile, UserRole } from "../../types";
import { getClerkDisplayName } from "../../lib/clerk-user";
import { setConvexTokenGetter } from "../../lib/convex-client";

interface AuthContextType {
  isSignedIn: boolean;
  isLoaded: boolean;
  isRoleLoading: boolean;
  user: UserProfile | null;
  orgRole: string | null | undefined;
  signOut: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoaded: false,
  isRoleLoading: false,
  user: null,
  orgRole: null,
  signOut: () => {},
  switchRole: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    isLoaded: clerkLoaded,
    isSignedIn: clerkSignedIn,
    user: clerkUser,
  } = useUser();
  const { orgId, orgRole, getToken } = useClerkAuth();

  // Register JWT getter during render so services don't race ahead of useEffect
  if (clerkSignedIn) {
    setConvexTokenGetter(async () => {
      return (await getToken({ template: "convex" })) || (await getToken());
    });
  } else {
    setConvexTokenGetter(null);
  }

  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const convexUser = useQuery(
    api.users.getCurrentUser,
    clerkSignedIn && clerkUser && orgId ? {} : "skip"
  );

  useEffect(() => {
    if (!clerkSignedIn || !clerkUser || !orgId) return;

    const email = clerkUser.primaryEmailAddress?.emailAddress;
    if (!email) return;

    void ensureCurrentUser({
      orgId,
      clerkUserId: clerkUser.id,
      email,
      fullName: getClerkDisplayName(clerkUser),
      imageUrl: clerkUser.imageUrl,
      clerkOrgRole: orgRole || undefined,
    }).catch((err) => {
      console.error("Failed to sync Convex user:", err);
    });
  }, [clerkSignedIn, clerkUser, orgId, orgRole, ensureCurrentUser]);

  const waitingOnConvexRole =
    !!clerkSignedIn &&
    !!clerkUser &&
    !!orgId &&
    (convexUser === undefined ||
      (convexUser === null && orgRole !== "org:admin"));

  let effectiveRole: UserRole | null = null;
  if (convexUser?.role) {
    effectiveRole = convexUser.role;
  } else if (
    clerkSignedIn &&
    orgId &&
    convexUser === null &&
    orgRole === "org:admin"
  ) {
    effectiveRole = "ADMIN";
  } else if (clerkSignedIn && !orgId) {
    effectiveRole = "ADMIN";
  }

  const user: UserProfile | null =
    clerkSignedIn && clerkUser && effectiveRole
      ? {
          id: clerkUser.id,
          fullName: getClerkDisplayName(clerkUser),
          primaryEmailAddress:
            clerkUser.primaryEmailAddress?.emailAddress || "",
          role: effectiveRole,
        }
      : null;

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: !!clerkSignedIn,
        isLoaded: clerkLoaded && !waitingOnConvexRole,
        isRoleLoading: waitingOnConvexRole,
        user,
        orgRole: orgRole || null,
        signOut: () => {},
        switchRole: () => {
          console.log(
            "Manual role switching disabled. Application roles are managed in Convex."
          );
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
