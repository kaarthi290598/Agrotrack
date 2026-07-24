"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type DatePreset =
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "all"
  | "custom";

export interface DateRange {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
  /** Text shown above the trigger. Set `hideLabel` to render without it. */
  label?: string;
  hideLabel?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 Days" },
  { id: "month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" },
];

const POPOVER_WIDTH = 320;

function toYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}-${month}-${year}`;
}

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getPresetRange(preset: DatePreset): { startDate: string; endDate: string } {
  const today = startOfDay(new Date());
  const endDate = toYYYYMMDD(today);

  if (preset === "today") {
    return { startDate: endDate, endDate };
  }

  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { startDate: toYYYYMMDD(start), endDate };
  }

  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: toYYYYMMDD(start), endDate };
  }

  if (preset === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: toYYYYMMDD(start), endDate: toYYYYMMDD(end) };
  }

  return { startDate: "", endDate: "" };
}

/** Convenience helper for building an initial value from a preset. */
export function makeDateRange(preset: DatePreset): DateRange {
  return { preset, ...getPresetRange(preset) };
}

function rangeLabel(value: DateRange): string {
  if (value.preset === "all") return "All dates";
  if (value.preset !== "custom") {
    const preset = PRESETS.find((p) => p.id === value.preset);
    return preset?.label || "Date range";
  }
  if (value.startDate && value.endDate) {
    return `${formatDisplay(value.startDate)} → ${formatDisplay(value.endDate)}`;
  }
  if (value.startDate) return `From ${formatDisplay(value.startDate)}`;
  return "Select custom range";
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className,
  label = "Date Range",
  hideLabel = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [draftStart, setDraftStart] = useState(value.startDate);
  const [draftEnd, setDraftEnd] = useState(value.endDate);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const viewSeed = value.startDate || value.endDate || toYYYYMMDD(new Date());
  const seedDate = useMemo(() => {
    const d = new Date(viewSeed);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [viewSeed]);

  const [currentMonth, setCurrentMonth] = useState(seedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(seedDate.getFullYear());

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - POPOVER_WIDTH - 8
    );
    const estimatedHeight = value.preset === "custom" || pickingEnd ? 420 : 120;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openAbove = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    const top = openAbove
      ? Math.max(8, rect.top - estimatedHeight - gap)
      : rect.bottom + gap;
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value.preset, pickingEnd]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftStart(value.startDate);
    setDraftEnd(value.endDate);
    setPickingEnd(Boolean(value.startDate && !value.endDate));
    const d = new Date(value.startDate || value.endDate || toYYYYMMDD(new Date()));
    if (!isNaN(d.getTime())) {
      setCurrentMonth(d.getMonth());
      setCurrentYear(d.getFullYear());
    }
  }, [isOpen, value.startDate, value.endDate]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const todayStr = toYYYYMMDD(new Date());

  const handlePreset = (preset: DatePreset) => {
    if (preset === "custom") {
      onChange({
        preset: "custom",
        startDate: value.startDate || draftStart,
        endDate: value.endDate || draftEnd,
      });
      setIsOpen(true);
      setPickingEnd(false);
      return;
    }

    onChange({ preset, ...getPresetRange(preset) });
    setIsOpen(false);
  };

  const applyCustomRange = (start: string, end: string) => {
    let startDate = start;
    let endDate = end;
    if (startDate && endDate && startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }
    onChange({ preset: "custom", startDate, endDate });
  };

  const handleSelectDay = (dayNum: number) => {
    const dateStr = toYYYYMMDD(new Date(currentYear, currentMonth, dayNum));

    if (!pickingEnd || !draftStart) {
      setDraftStart(dateStr);
      setDraftEnd("");
      setPickingEnd(true);
      onChange({ preset: "custom", startDate: dateStr, endDate: "" });
      return;
    }

    setDraftEnd(dateStr);
    setPickingEnd(false);
    applyCustomRange(draftStart, dateStr);
    setIsOpen(false);
  };

  const isInRange = (dateStr: string) => {
    const start = draftStart || value.startDate;
    const end = draftEnd || value.endDate;
    if (!start || !end) return false;
    const lo = start <= end ? start : end;
    const hi = start <= end ? end : start;
    return dateStr >= lo && dateStr <= hi;
  };

  const isEndpoint = (dateStr: string) => {
    const start = draftStart || value.startDate;
    const end = draftEnd || value.endDate;
    return dateStr === start || dateStr === end;
  };

  const clearRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ preset: "all", startDate: "", endDate: "" });
    setDraftStart("");
    setDraftEnd("");
    setPickingEnd(false);
  };

  const popover =
    isOpen &&
    coords &&
    typeof document !== "undefined" &&
    createPortal(
      <>
        <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)} />
        <div
          style={{ top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
          className="fixed z-50 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 animate-in fade-in zoom-in-95 duration-150 max-h-[min(480px,calc(100vh-16px))] overflow-y-auto"
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PRESETS.map((preset) => {
              const active = value.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePreset(preset.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border",
                    active
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:border-emerald-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {(value.preset === "custom" || pickingEnd) && (
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">From</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 truncate block">
                    {formatDisplay(draftStart || value.startDate)}
                  </span>
                </div>
                <span className="text-slate-300 font-bold">→</span>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">To</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100 truncate block">
                    {formatDisplay(draftEnd || value.endDate) || (pickingEnd ? "Pick end" : "—")}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {pickingEnd ? "Select the end date" : "Select a start date, then an end date"}
              </p>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (currentMonth === 0) {
                      setCurrentMonth(11);
                      setCurrentYear((y) => y - 1);
                    } else {
                      setCurrentMonth((m) => m - 1);
                    }
                  }}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </button>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentMonth(0);
                      setCurrentYear((y) => y + 1);
                    } else {
                      setCurrentMonth((m) => m + 1);
                    }
                  }}
                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="py-1">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = toYYYYMMDD(new Date(currentYear, currentMonth, dayNum));
                  const selected = isEndpoint(dateStr);
                  const inRange = isInRange(dateStr);
                  const isToday = dateStr === todayStr;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => handleSelectDay(dayNum)}
                      className={cn(
                        "h-8 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center",
                        selected && "bg-emerald-600 text-white font-bold shadow-xs",
                        !selected && inRange && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
                        !selected && !inRange && "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200",
                        isToday && !selected && "border border-emerald-500 font-bold text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </>,
      document.body
    );

  return (
    <div className={cn("relative w-full", className)}>
      {!hideLabel && (
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm transition-all cursor-pointer shadow-xs",
          "border-slate-200 hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none",
          "dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-700",
          isOpen && "border-emerald-500 ring-2 ring-emerald-500/10"
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate font-mono font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm tracking-wide">
            {rangeLabel(value)}
          </span>
        </span>
        {value.preset !== "all" && (
          <span
            role="button"
            tabIndex={0}
            onClick={clearRange}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") clearRange(e as unknown as React.MouseEvent);
            }}
            className="rounded-md p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Clear date filter"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {popover}
    </div>
  );
};
