"use client";

import { useMemo } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import {
  CreatorProfile,
  formatClerkMemberName,
  getClerkDisplayName,
  getInitials,
} from "../lib/clerk-user";

export function useOrgMemberLookup(): Map<string, CreatorProfile> {
  const { user: clerkUser } = useUser();
  const { memberships } = useOrganization({
    memberships: {
      pageSize: 100,
      keepPreviousData: true,
    },
  });

  return useMemo(() => {
    const map = new Map<string, CreatorProfile>();

    if (clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase().trim();
      if (email) {
        const name = getClerkDisplayName(clerkUser);
        map.set(email, {
          name,
          email: clerkUser.primaryEmailAddress?.emailAddress,
          imageUrl: clerkUser.imageUrl,
          initials: getInitials(name),
        });
      }
    }

    memberships?.data?.forEach((membership) => {
      const member = membership.publicUserData;
      if (!member?.identifier) return;

      const email = member.identifier.toLowerCase().trim();
      const name = formatClerkMemberName(member.firstName, member.lastName, member.identifier);

      map.set(email, {
        name,
        email: member.identifier,
        imageUrl: member.imageUrl,
        initials: getInitials(name),
      });
    });

    return map;
  }, [clerkUser, memberships?.data]);
}
