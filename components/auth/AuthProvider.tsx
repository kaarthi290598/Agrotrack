"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser, useAuth as useClerkAuth } from "@clerk/nextjs";
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
  switchRole: () => {}
});

const ROLE_STORAGE_KEY = "farmer_tracker_active_role";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, user: clerkUser } = useUser();
  const { orgRole } = useClerkAuth();

  // Determine actual role from Clerk Organization Role
  // org:admin -> "admin"
  // org:member -> "user"
  // If no org selected, default to "user" to be safe, or "admin" if you want solo users to be admins.
  // We'll default to "user" if they are explicitly org:member, and "admin" if explicitly org:admin.
  // If undefined (personal account), we can default to "admin" so solo users can use the app, 
  // but if they are in an org and are a member, they MUST be "user".
  let effectiveRole: UserRole = "admin"; // Default for personal accounts
  
  if (orgRole) {
    // If they are in an organization, STRICTLY use their org role
    effectiveRole = orgRole === "org:admin" ? "admin" : "user";
  }

  const user: UserProfile | null = clerkSignedIn && clerkUser ? {
    id: clerkUser.id,
    fullName: getClerkDisplayName(clerkUser),
    primaryEmailAddress: clerkUser.primaryEmailAddress?.emailAddress || "",
    role: effectiveRole
  } : null;

  const switchRole = (role: UserRole) => {
    // No-op since we removed the manual override
    console.log("Manual role switching disabled. Using Clerk roles.");
  };

  const signOut = () => {
    // Handled by Clerk
  };

  return (
    <AuthContext.Provider value={{ 
      isSignedIn: !!clerkSignedIn, 
      isLoaded: clerkLoaded, 
      user, 
      orgRole: orgRole || null,
      signOut, 
      switchRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
