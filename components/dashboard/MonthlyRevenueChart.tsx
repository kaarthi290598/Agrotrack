"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/Card";
import { CalendarDays } from "lucide-react";

export interface MonthlyRevenuePoint {
  year: number;
  month: number;
  amount: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthlyRevenueChartProps {
  data: MonthlyRevenuePoint[];
  availableYears: number[];
  currency: string;
}

export function MonthlyRevenueChart({
  data,
  availableYears,
  currency,
}: MonthlyRevenueChartProps) {
  const defaultYear = availableYears[0] ?? new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const years = useMemo(() => {
    const set = new Set(availableYears);
    set.add(selectedYear);
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [availableYears, selectedYear]);

  const monthData = useMemo(() => {
    return MONTH_LABELS.map((label, i) => {
      const month = i + 1;
      const point = data.find((d) => d.year === selectedYear && d.month === month);
      return { label, month, amount: point?.amount ?? 0 };
    });
  }, [data, selectedYear]);

  const totalYearRevenue = monthData.reduce((sum, m) => sum + m.amount, 0);
  const maxVal = Math.max(...monthData.map((m) => m.amount), 1);

  const padding = { top: 28, right: 16, bottom: 40, left: 52 };
  const chartWidth = 560;
  const chartHeight = 220;
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const barGap = 6;
  const barWidth = (plotWidth - barGap * 11) / 12;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Monthly Revenue
            </CardTitle>
            <CardDescription>
              {currency}
              {totalYearRevenue.toLocaleString()} total in {selectedYear}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 cursor-pointer"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {totalYearRevenue === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold">No revenue recorded for {selectedYear}</p>
            <p className="text-xs mt-1">Try selecting a different year.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full min-w-[320px] h-52 select-none"
              role="img"
              aria-label={`Monthly revenue chart for ${selectedYear}`}
            >
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#be41bf" stopOpacity="1" />
                  <stop offset="100%" stopColor="#99278a" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              {/* Y-axis grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padding.top + ratio * plotHeight;
                const amount = Math.round(maxVal * (1 - ratio));
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      className="stroke-slate-100 dark:stroke-slate-800"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 4}
                      className="fill-slate-500 dark:fill-slate-400 font-mono text-[11px]"
                      textAnchor="end"
                    >
                      {amount >= 1000 ? `${Math.round(amount / 1000)}k` : amount}
                    </text>
                  </g>
                );
              })}

              {/* Bars */}
              {monthData.map((m, i) => {
                const barHeight = maxVal > 0 ? (m.amount / maxVal) * plotHeight : 0;
                const x = padding.left + i * (barWidth + barGap);
                const y = padding.top + plotHeight - barHeight;

                return (
                  <g key={m.month} className="group cursor-default">
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barHeight, m.amount > 0 ? 2 : 0)}
                      rx={4}
                      fill="url(#barGrad)"
                      className="opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                    {m.amount > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={y - 6}
                        className="fill-slate-600 dark:fill-slate-300 font-mono font-bold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        textAnchor="middle"
                      >
                        {currency}
                        {m.amount >= 1000
                          ? `${(m.amount / 1000).toFixed(m.amount >= 10000 ? 0 : 1)}k`
                          : m.amount}
                      </text>
                    )}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight - 12}
                      className="fill-slate-500 dark:fill-slate-400 font-medium text-[11px]"
                      textAnchor="middle"
                    >
                      {m.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
