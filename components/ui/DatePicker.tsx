"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD string
  onChange: (value: string) => void;
  helperText?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper to format YYYY-MM-DD -> "24-07-2026" (DD-MM-YYYY format)
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "Select date";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
  }
  return dateStr;
}

// Format Date object -> "YYYY-MM-DD"
function toYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  helperText,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Current viewing month and year state for popover calendar
  const initialDate = value ? new Date(value) : new Date();
  const validInitialDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

  const [currentMonth, setCurrentMonth] = useState(validInitialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(validInitialDate.getFullYear());

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleSelectDay = (dayNum: number) => {
    const selected = new Date(currentYear, currentMonth, dayNum);
    onChange(toYYYYMMDD(selected));
    setIsOpen(false);
  };

  const handleSetPreset = (preset: "today" | "yesterday" | "tomorrow") => {
    const d = new Date();
    if (preset === "yesterday") d.setDate(d.getDate() - 1);
    if (preset === "tomorrow") d.setDate(d.getDate() + 1);
    
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    onChange(toYYYYMMDD(d));
    setIsOpen(false);
  };

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const todayStr = toYYYYMMDD(new Date());
  const selectedDateStr = value || todayStr;

  return (
    <div className={cn("w-full space-y-1.5 text-left relative", className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-all shadow-xs cursor-pointer",
            !value && "text-slate-400"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm tracking-wide truncate">
              {formatDateDisplay(selectedDateStr)}
            </span>
          </div>
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 z-40 mt-1 w-[280px] sm:w-[300px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 animate-in fade-in zoom-in-95 duration-150">
              <div className="space-y-3">
                {/* Header: Month & Year Controls */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </button>

                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSetPreset("yesterday")}
                    className="py-1 rounded-lg font-semibold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer text-center"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset("today")}
                    className="py-1 rounded-lg font-bold bg-emerald-600 text-white shadow-xs cursor-pointer text-center"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPreset("tomorrow")}
                    className="py-1 rounded-lg font-semibold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer text-center"
                  >
                    Tomorrow
                  </button>
                </div>

                {/* Days of Week Header */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Day Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Blank offset days */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`blank-${i}`} />
                  ))}

                  {/* Month Days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateObj = new Date(currentYear, currentMonth, dayNum);
                    const dateStr = toYYYYMMDD(dateObj);
                    const isSelected = dateStr === selectedDateStr;
                    const isToday = dateStr === todayStr;

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => handleSelectDay(dayNum)}
                        className={cn(
                          "h-8 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center relative",
                          isSelected
                            ? "bg-emerald-600 text-white font-bold shadow-xs"
                            : "hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200",
                          isToday && !isSelected && "border border-emerald-500 font-bold text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {helperText && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
    </div>
  );
};
