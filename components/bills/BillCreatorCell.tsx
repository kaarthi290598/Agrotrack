"use client";

import { CreatorProfile, resolveBillCreator } from "../../lib/clerk-user";
import { cn } from "../../lib/utils";

type BillCreatorCellProps = {
  bill: { createdBy?: string; createdByEmail?: string };
  lookup: Map<string, CreatorProfile>;
  compact?: boolean;
  className?: string;
};

export function BillCreatorCell({ bill, lookup, compact = false, className }: BillCreatorCellProps) {
  const creator = resolveBillCreator(bill, lookup);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{creator.name}</p>
      {!compact && creator.email && (
        <p className="truncate text-[10px] text-slate-400">{creator.email}</p>
      )}
    </div>
  );
}

type BillCreatorInlineProps = {
  bill: { createdBy?: string; createdByEmail?: string };
  lookup: Map<string, CreatorProfile>;
  label?: string;
};

export function BillCreatorInline({ bill, lookup, label = "Created by" }: BillCreatorInlineProps) {
  const creator = resolveBillCreator(bill, lookup);

  return (
    <p className="text-xs text-slate-600 dark:text-slate-400">
      {label}:{" "}
      <span className="font-semibold text-slate-800 dark:text-slate-200">{creator.name}</span>
    </p>
  );
}
