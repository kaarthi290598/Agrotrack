/** Shared class string for filter/search inputs across list pages */
export const FILTER_SEARCH_CLASS =
  "w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 pl-9 pr-8 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all";

/** Shared table cell typography — use with TableCell across pages */
export const TABLE = {
  invoice: "font-mono font-bold text-xs text-slate-900 dark:text-white",
  name: "font-semibold text-xs text-slate-800 dark:text-slate-200",
  muted: "text-xs text-slate-500 dark:text-slate-400",
  mono: "font-mono text-xs text-slate-600 dark:text-slate-400",
  money: "font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400",
  moneyRight: "font-mono font-bold text-xs text-right text-emerald-600 dark:text-emerald-400",
  secondary: "text-xs font-medium text-slate-600 dark:text-slate-400",
} as const;
