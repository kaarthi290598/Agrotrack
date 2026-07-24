import React from "react";
import { cn } from "../../lib/utils";

type StatCardColor =
  | "emerald"
  | "blue"
  | "teal"
  | "amber"
  | "sky"
  | "violet"
  | "indigo"
  | "pink";

const COLOR_STYLES: Record<
  StatCardColor,
  { gradient: string; iconBg: string; iconText: string; label: string; value: string }
> = {
  emerald: {
    gradient:
      "bg-linear-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/40",
    iconBg: "bg-emerald-600/10",
    iconText: "text-emerald-700 dark:text-emerald-400",
    label: "text-emerald-600/80 dark:text-emerald-400/80",
    value: "text-emerald-900 dark:text-emerald-300",
  },
  blue: {
    gradient:
      "bg-linear-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200/60 dark:border-blue-800/40",
    iconBg: "bg-blue-600/10",
    iconText: "text-blue-700 dark:text-blue-400",
    label: "text-blue-600/80 dark:text-blue-400/80",
    value: "text-blue-900 dark:text-blue-300",
  },
  teal: {
    gradient:
      "bg-linear-to-br from-teal-50 to-teal-100/40 dark:from-teal-950/40 dark:to-teal-900/20 border-teal-200/60 dark:border-teal-800/40",
    iconBg: "bg-teal-600/10",
    iconText: "text-teal-700 dark:text-teal-400",
    label: "text-teal-600/80 dark:text-teal-400/80",
    value: "text-teal-900 dark:text-teal-300",
  },
  amber: {
    gradient:
      "bg-linear-to-br from-amber-50 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200/60 dark:border-amber-800/40",
    iconBg: "bg-amber-600/10",
    iconText: "text-amber-700 dark:text-amber-400",
    label: "text-amber-600/80 dark:text-amber-400/80",
    value: "text-amber-900 dark:text-amber-300",
  },
  sky: {
    gradient:
      "bg-linear-to-br from-sky-50 to-sky-100/40 dark:from-sky-950/40 dark:to-sky-900/20 border-sky-200/60 dark:border-sky-800/40",
    iconBg: "bg-sky-600/10",
    iconText: "text-sky-700 dark:text-sky-400",
    label: "text-sky-600/80 dark:text-sky-400/80",
    value: "text-sky-900 dark:text-sky-300",
  },
  violet: {
    gradient:
      "bg-linear-to-br from-violet-50 to-violet-100/40 dark:from-violet-950/40 dark:to-violet-900/20 border-violet-200/60 dark:border-violet-800/40",
    iconBg: "bg-violet-600/10",
    iconText: "text-violet-700 dark:text-violet-400",
    label: "text-violet-600/80 dark:text-violet-400/80",
    value: "text-violet-900 dark:text-violet-300",
  },
  indigo: {
    gradient:
      "bg-linear-to-br from-indigo-50 to-indigo-100/40 dark:from-indigo-950/40 dark:to-indigo-900/20 border-indigo-200/60 dark:border-indigo-800/40",
    iconBg: "bg-indigo-600/10",
    iconText: "text-indigo-700 dark:text-indigo-400",
    label: "text-indigo-600/80 dark:text-indigo-400/80",
    value: "text-indigo-900 dark:text-indigo-300",
  },
  pink: {
    gradient:
      "bg-linear-to-br from-pink-50 to-pink-100/40 dark:from-pink-950/40 dark:to-pink-900/20 border-pink-200/60 dark:border-pink-800/40",
    iconBg: "bg-pink-600/10",
    iconText: "text-pink-700 dark:text-pink-400",
    label: "text-pink-600/80 dark:text-pink-400/80",
    value: "text-pink-900 dark:text-pink-300",
  },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color?: StatCardColor;
  className?: string;
  mono?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  color = "emerald",
  className,
  mono = true,
}: StatCardProps) {
  const styles = COLOR_STYLES[color];

  return (
    <div className={cn("rounded-xl border p-3.5", styles.gradient, className)}>
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
            styles.iconBg,
            styles.iconText
          )}
        >
          {icon}
        </div>
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", styles.label)}>
          {label}
        </span>
      </div>
      <p className={cn("text-xl font-extrabold", mono && "font-mono", styles.value)}>{value}</p>
    </div>
  );
}

export type { StatCardColor };
