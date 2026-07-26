import { dark } from "@clerk/ui/themes";

const sharedVariables = {
  borderRadius: "0.75rem",
  fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  fontFamilyButtons: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
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
    modalBackdrop: "backdrop-blur-sm",
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
    modalBackdrop: "backdrop-blur-sm",
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
