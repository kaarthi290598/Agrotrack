type ClerkUserLike = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

export function getClerkDisplayName(user: ClerkUserLike): string {
  const full = user.fullName?.trim();
  if (full) return full;

  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (composed) return composed;

  if (user.username?.trim()) return user.username.trim();

  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.split("@")[0];

  return "User";
}

export type CreatorProfile = {
  name: string;
  email?: string;
  imageUrl?: string;
  initials: string;
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatClerkMemberName(
  firstName?: string | null,
  lastName?: string | null,
  identifier?: string | null
): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (identifier?.includes("@")) return identifier.split("@")[0];
  if (identifier) return identifier;
  return "Unknown";
}

export function resolveBillCreator(
  bill: { createdBy?: string; createdByEmail?: string },
  lookup: Map<string, CreatorProfile>
): CreatorProfile {
  const email = (bill.createdByEmail || "").toLowerCase().trim();
  if (email && lookup.has(email)) {
    return lookup.get(email)!;
  }

  const createdBy = (bill.createdBy || "").trim();
  if (createdBy && createdBy.toLowerCase() !== "operator") {
    if (createdBy.includes("@")) {
      const key = createdBy.toLowerCase();
      if (lookup.has(key)) return lookup.get(key)!;
    }
    return {
      name: createdBy,
      email: bill.createdByEmail,
      initials: getInitials(createdBy),
    };
  }

  if (email) {
    const localPart = email.split("@")[0];
    return {
      name: localPart,
      email: bill.createdByEmail,
      initials: getInitials(localPart),
    };
  }

  return { name: "Unknown", initials: "?" };
}
