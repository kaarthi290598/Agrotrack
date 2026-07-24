"use client";

import React, { useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "../../lib/utils";

interface TimePickerProps {
  label?: string;
  value: string; // HH:mm 24-hr string (e.g. "14:30")
  onChange: (value: string) => void;
  helperText?: string;
  className?: string;
}

// Convert "14:30" -> { hour: "02", minute: "30", period: "PM" }
function parse24to12(timeStr: string) {
  if (!timeStr) return { hour: "08", minute: "00", period: "AM" };
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  if (isNaN(h)) return { hour: "08", minute: "00", period: "AM" };

  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const hour = h < 10 ? `0${h}` : `${h}`;
  return { hour, minute: m, period };
}

// Convert { hour: "02", minute: "30", period: "PM" } -> "14:30"
function format12to24(hour: string, minute: string, period: string) {
  let h = parseInt(hour, 10);
  if (isNaN(h)) h = 8;
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return `${hStr}:${minute}`;
}

const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const PRESET_MINUTES = ["00", "15", "30", "45"];

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  helperText,
  className
}) => {
  const parsed = parse24to12(value);
  const [isOpen, setIsOpen] = useState(false);
  const [customMinuteInput, setCustomMinuteInput] = useState(parsed.minute);

  const handleHourSelect = (h: string) => {
    const next24 = format12to24(h, parsed.minute, parsed.period);
    onChange(next24);
  };

  const handleMinuteSelect = (m: string) => {
    const validM = Math.min(59, Math.max(0, parseInt(m, 10) || 0));
    const mStr = validM < 10 ? `0${validM}` : `${validM}`;
    setCustomMinuteInput(mStr);
    const next24 = format12to24(parsed.hour, mStr, parsed.period);
    onChange(next24);
  };

  const handlePeriodSelect = (p: string) => {
    const next24 = format12to24(parsed.hour, parsed.minute, p);
    onChange(next24);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const hStr = h < 10 ? `0${h}` : `${h}`;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    onChange(`${hStr}:${mStr}`);
    setIsOpen(false);
  };

  const displayFormatted = value
    ? `${parsed.hour}:${parsed.minute} ${parsed.period}`
    : "Select Time";

  return (
    <div className={cn("w-full space-y-1.5 text-left relative", className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {/* Main Button Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition-all shadow-xs cursor-pointer",
            !value && "text-slate-400"
          )}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm tracking-wide truncate">
              {value ? displayFormatted : "Choose Time"}
            </span>
          </div>
          {value && (
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              {parsed.period}
            </span>
          )}
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 z-40 mt-1 w-[280px] sm:w-[310px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 animate-in fade-in zoom-in-95 duration-150">
              <div className="space-y-3">
                {/* AM / PM Toggle */}
                <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handlePeriodSelect("AM")}
                    className={cn(
                      "py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      parsed.period === "AM"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodSelect("PM")}
                    className={cn(
                      "py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      parsed.period === "PM"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    PM
                  </button>
                </div>

                {/* Hours Grid */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                    Select Hour (1-12)
                  </span>
                  <div className="grid grid-cols-6 gap-1.5">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHourSelect(h)}
                        className={cn(
                          "h-8 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center",
                          parsed.hour === h
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        {parseInt(h, 10)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minutes Grid & Flexible Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Minutes
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">00-59</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {PRESET_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMinuteSelect(m)}
                        className={cn(
                          "py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center",
                          parsed.minute === m
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        :{m}
                      </button>
                    ))}
                  </div>

                  {/* Flexible Custom Minute Typing */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">Exact Min:</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0-59"
                      value={customMinuteInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomMinuteInput(val);
                        if (val !== "") {
                          handleMinuteSelect(val);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Quick Presets & Close */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSetNow}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  >
                    Current Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
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
