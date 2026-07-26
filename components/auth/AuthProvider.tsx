"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserProfile, UserRole } from "../../types";
import { getClerkDisplayName } from "../../lib/clerk-user";

interface AuthContextType {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: UserProfile | null;
  orgRole: string | null | undefined;
  signOut: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  isSignedIn: false,
  isLoaded: false,
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
  const { orgId, orgRole } = useClerkAuth();

  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const convexUser = useQuery(
    api.users.getCurrentUser,
    clerkSignedIn && clerkUser && orgId
      ? { orgId, clerkUserId: clerkUser.id }
      : "skip"
  );

  // Keep Convex user record in sync whenever the user is in an organization
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
  }, [
    clerkSignedIn,
    clerkUser,
    orgId,
    orgRole,
    ensureCurrentUser,
  ]);

  // Convex is the source of truth for application roles.
  // While syncing, bootstrap from Clerk org role so creators aren't locked out.
  let effectiveRole: UserRole | null = null;
  if (convexUser?.role) {
    effectiveRole = convexUser.role;
  } else if (orgId && orgRole) {
    effectiveRole = orgRole === "org:admin" ? "ADMIN" : "MEMBER";
  } else if (clerkSignedIn && !orgId) {
    // Personal/no-org session — keep previous solo-admin behavior
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

  const switchRole = (_role: UserRole) => {
    console.log(
      "Manual role switching disabled. Application roles are managed in Convex."
    );
  };

  const signOut = () => {
    // Handled by Clerk
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: !!clerkSignedIn,
        isLoaded: clerkLoaded,
        user,
        orgRole: orgRole || null,
        signOut,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
