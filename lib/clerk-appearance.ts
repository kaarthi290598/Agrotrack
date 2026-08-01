import { dark } from "@clerk/ui/themes";

/**
 * Invite-only / no self-serve org create — app UI only hides entry points.
 * Real enforcement is in the Clerk Dashboard (same instance as NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY):
 *
 * 1. Disable Sign up (Restrictions / Sign-up & Sign-in) for this instance (dev and prod).
 * 2. Keep "Allow user-created organizations" off.
 * 3. Confirm you edited the instance that matches the site’s publishable key.
 *
 * App companions: /sign-up redirects to /sign-in; hideSignUpElements; hideCreateOrganizationElements.
 */

const sharedVariables = {
  borderRadius: "0.75rem",
  fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  fontFamilyButtons: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
};

/** Hide Clerk "Create organization" entry points (orgs are provisioned by admins). */
export const hideCreateOrganizationElements = {
  organizationSwitcherPopoverActionButton__createOrganization: {
    display: "none",
  },
  organizationListCreateOrganizationActionButton: {
    display: "none",
  },
  taskChooseOrganizationCreateOrganizationActionButton: {
    display: "none",
  },
} as const;

/** Invite-only app: hide Clerk Sign-in → Sign-up links. */
export const hideSignUpElements = {
  footerAction: { display: "none" },
  footerActionLink: { display: "none" },
  footerActionText: { display: "none" },
} as const;

export const organizationSwitcherAppearance = {
  elements: {
    rootBox: "w-full min-w-0 max-w-full overflow-hidden",
    organizationSwitcherTrigger:
      "w-full max-w-full min-w-0 overflow-hidden justify-start",
    organizationPreview: "min-w-0 flex-1 overflow-hidden",
    organizationPreviewTextContainer: "min-w-0 overflow-hidden",
    organizationPreviewMainIdentifier: "truncate block max-w-full",
    organizationPreviewSecondaryIdentifier: "truncate block max-w-full",
    ...hideCreateOrganizationElements,
  },
};

const sharedElements = {
  modalBackdrop: "backdrop-blur-sm",
  ...hideCreateOrganizationElements,
  ...hideSignUpElements,
};

export const clerkLightAppearance = {
  variables: {
    ...sharedVariables,
    colorPrimary: "#99278a",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#ffffff",
    colorForeground: "#0f172a",
    colorInput: "#f8fafc",
    colorInputForeground: "#0f172a",
    colorMuted: "#f1f5f9",
    colorMutedForeground: "#64748b",
    colorNeutral: "#334155",
    colorDanger: "#e11d48",
    colorModalBackdrop: "rgba(15, 23, 42, 0.55)",
  },
  elements: {
    ...sharedElements,
    cardBox: "shadow-xl border border-slate-200",
    popoverBox: "shadow-xl border border-slate-200",
    userButtonPopoverCard: "border border-slate-200 shadow-xl",
    organizationSwitcherPopoverCard: "border border-slate-200 shadow-xl",
  },
};

export const clerkDarkAppearance = {
  theme: dark,
  variables: {
    ...sharedVariables,
    colorPrimary: "#be41bf",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#0f172a",
    colorForeground: "#f8fafc",
    colorInput: "#1e293b",
    colorInputForeground: "#f8fafc",
    colorMuted: "#1e293b",
    colorMutedForeground: "#94a3b8",
    colorNeutral: "#cbd5e1",
    colorDanger: "#fb7185",
    colorModalBackdrop: "rgba(2, 6, 23, 0.78)",
  },
  elements: {
    ...sharedElements,
    cardBox: "shadow-2xl border border-slate-800 bg-slate-900",
    popoverBox: "shadow-2xl border border-slate-800 bg-slate-900",
    userButtonPopoverCard: "border border-slate-800 bg-slate-900 shadow-2xl",
    organizationSwitcherPopoverCard: "border border-slate-800 bg-slate-900 shadow-2xl",
    userButtonPopoverActionButton: "hover:bg-slate-800",
    userButtonPopoverActionButtonText: "text-slate-100",
    userButtonPopoverActionButtonIcon: "text-slate-400",
    organizationSwitcherTrigger: "text-slate-100",
    organizationPreviewMainIdentifier: "text-slate-100",
    organizationPreviewSecondaryIdentifier: "text-slate-400",
  },
};

export function getClerkAppearance(isDark: boolean) {
  return isDark ? clerkDarkAppearance : clerkLightAppearance;
}
