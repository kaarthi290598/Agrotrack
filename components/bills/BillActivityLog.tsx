"use client";

import type { ReactNode } from "react";
import {
  CheckCircle2,
  CreditCard,
  FilePlus2,
  History,
  Pencil,
  XCircle,
} from "lucide-react";
import { Bill, BillActivityEntry } from "../../types";

const ACTION_META: Record<
  BillActivityEntry["action"],
  {
    label: string;
    icon: ReactNode;
    className: string;
  }
> = {
  CREATED: {
    label: "Created",
    icon: <FilePlus2 className="h-3.5 w-3.5" />,
    className:
      "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800",
  },
  UPDATED: {
    label: "Edited",
    icon: <Pencil className="h-3.5 w-3.5" />,
    className:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  },
  APPROVED: {
    label: "Approved",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800",
  },
  REJECTED: {
    label: "Rejected",
    icon: <XCircle className="h-3.5 w-3.5" />,
    className:
      "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800",
  },
  PAYMENT_UPDATED: {
    label: "Payment updated",
    icon: <CreditCard className="h-3.5 w-3.5" />,
    className:
      "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800",
  },
};

function formatWhen(at: number): string {
  try {
    return new Date(at).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function BillActivityLog({ bill }: { bill: Bill }) {
  const entries = [...(bill.activityLog || [])].sort((a, b) => b.at - a.at);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
          <History className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          No activity yet
        </p>
        <p className="text-xs text-slate-400 max-w-[240px]">
          Creates, edits, approvals, and payment changes will appear here.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0 pl-2">
      {entries.map((entry, i) => {
        const meta = ACTION_META[entry.action];
        const isLast = i === entries.length - 1;
        return (
          <li key={`${entry.at}-${entry.action}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 dark:bg-slate-800"
                aria-hidden
              />
            )}
            <div
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${meta.className}`}
            >
              {meta.icon}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {meta.label}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {formatWhen(entry.at)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                by <span className="font-semibold text-slate-800 dark:text-slate-100">{entry.byName}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
