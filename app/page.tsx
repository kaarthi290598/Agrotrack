"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { billingService } from "../services/billing.service";
import { settingsService } from "../services/settings.service";
import { Customer, Bill, Settings } from "../types";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/Table";
import { 
  Users, 
  Receipt, 
  IndianRupee, 
  TrendingUp, 
  Calculator,
  Plus, 
  ArrowUpRight, 
  User, 
  MapPin
} from "lucide-react";
import { customerService } from "../services/customer.service";
import { Show, useAuth as useClerkAuth, useOrganization } from "@clerk/nextjs";
import { useAuth } from "../components/auth/AuthProvider";
import { LandingPage } from "../components/landing/LandingPage";

interface DashboardData {
  totalCustomers: number;
  totalBills: number;
  totalRevenue: number;
  todayRevenue: number;
  averageBilling: number;
  recentBills: (Bill & { customerName?: string })[];
  monthlyStats: { date: string; amount: number }[];
  locationStats: { location: string; amount: number }[];
}

export default function DashboardPage() {
  const { orgId, orgRole } = useClerkAuth();
  const { organization } = useOrganization();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const stats = await billingService.getStats(orgId || undefined, user, isAdmin);
        const settingsData = await settingsService.get(orgId || undefined);
        const custData = await customerService.getAll(orgId || undefined);
        
        setData(stats);
        setSettings(settingsData);
        setRecentCustomers(custData.slice(-4).reverse());
      } catch (error) {
        toast({
          type: "error",
          title: "Dashboard Error",
          description: "Could not load stats data."
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, [orgId, toast, user, isAdmin]);

  if (isLoading || !data || !settings) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
            <div className="h-4 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div className="h-10 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
                <div className="h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 lg:col-span-2"></div>
          <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
        </div>
      </div>
    );
  }

  const currency = settings.currencySymbol || "₹";

  const padding = 40;
  const chartHeight = 180;
  const chartWidth = 550;
  const maxVal = Math.max(...data.monthlyStats.map((s) => s.amount), 1000);

  const points = data.monthlyStats.map((stat, i) => {
    const x = padding + (i * (chartWidth - padding * 2)) / Math.max(data.monthlyStats.length - 1, 1);
    const y = chartHeight - padding - (stat.amount / maxVal) * (chartHeight - padding * 2);
    return { x, y, label: stat.date, val: stat.amount };
  });

  const pathD = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : "";

  return (
    <div className="space-y-8">
      {/* Active Clerk Organization ID Status Card */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900/90 via-teal-900 to-slate-900 p-5 text-white shadow-lg border border-emerald-500/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold">
              {organization?.name ? organization.name.charAt(0) : "O"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Active Clerk Organization</span>
                {orgRole && (
                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold uppercase">
                    {orgRole}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">
                {organization?.name || "Personal Workspace (No Org)"}
              </h2>
            </div>
          </div>
          <div className="sm:text-right font-mono bg-black/30 p-2.5 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Clerk Organization ID (`orgId`)</span>
            <span className="text-xs font-extrabold text-emerald-300 select-all">{orgId || "None (Personal Context)"}</span>
          </div>
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Operator Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Billing summary and recent statistics for <span className="font-semibold text-emerald-600 dark:text-emerald-500">{settings.businessName}</span>.
          </p>
        </div>
        <Link href="/billing" passHref>
          <Button variant="primary" className="cursor-pointer">
            <Plus className="h-4.5 w-4.5" />
            Generate New Bill
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Customers */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Farmers</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.totalCustomers}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Bills Generated */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Bills Created</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.totalBills}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Revenue</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{currency}{data.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Today's Revenue</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{currency}{data.todayRevenue.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Average Billing */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Avg Bill Value</span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{currency}{Math.round(data.averageBilling).toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <Calculator className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* SVG Revenue Line Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Revenue Trend (Last 7 Days)</CardTitle>
            <CardDescription>Daily billing revenue fluctuations in {currency}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex justify-center">
            <div className="w-full overflow-hidden">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48 select-none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = padding + ratio * (chartHeight - padding * 2);
                  const amount = Math.round(maxVal * (1 - ratio));
                  return (
                    <g key={idx}>
                      <line 
                        x1={padding} 
                        y1={y} 
                        x2={chartWidth - padding} 
                        y2={y} 
                        className="stroke-slate-100 dark:stroke-slate-800" 
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text 
                        x={padding - 8} 
                        y={y + 3} 
                        className="fill-slate-400 dark:fill-slate-500 font-mono text-[9px]" 
                        textAnchor="end"
                      >
                        {amount}
                      </text>
                    </g>
                  );
                })}

                {/* Fill Area */}
                {areaD && <path d={areaD} fill="url(#chartGrad)" />}

                {/* Stroke Path */}
                {pathD && (
                  <path 
                    d={pathD} 
                    fill="none" 
                    className="stroke-emerald-500 dark:stroke-emerald-400" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                  />
                )}

                {/* Data Points / Circles */}
                {points.map((p, idx) => (
                  <g key={idx} className="group cursor-pointer">
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="4" 
                      className="fill-white dark:fill-slate-900 stroke-emerald-500 dark:stroke-emerald-400" 
                      strokeWidth="2" 
                    />
                    <text 
                      x={p.x} 
                      y={p.y - 8} 
                      className="fill-slate-700 dark:fill-slate-300 font-mono font-bold text-[8px] text-center opacity-0 group-hover:opacity-100 transition-opacity" 
                      textAnchor="middle"
                    >
                      {currency}{p.val}
                    </text>
                    <text 
                      x={p.x} 
                      y={chartHeight - 12} 
                      className="fill-slate-400 dark:fill-slate-500 font-medium text-[8.5px]" 
                      textAnchor="middle"
                    >
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Top Locations Progress Bars */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Locations (Revenue)</CardTitle>
            <CardDescription>Major agricultural hubs contributing to revenue</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4.5">
            {data.locationStats.length === 0 ? (
              <p className="text-xs text-slate-455 text-center py-8">No location revenue data available.</p>
            ) : (
              data.locationStats.map((lStat, idx) => {
                const totalLocRev = data.locationStats[0].amount;
                const percentage = totalLocRev > 0 ? (lStat.amount / totalLocRev) * 100 : 0;
                
                const barColors = [
                  "bg-emerald-600 dark:bg-emerald-500",
                  "bg-teal-600 dark:bg-teal-500",
                  "bg-sky-600 dark:bg-sky-500",
                  "bg-amber-600 dark:bg-amber-500",
                  "bg-slate-600 dark:bg-slate-500"
                ];

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{lStat.location}</span>
                      <span className="font-mono text-slate-550 dark:text-slate-400 font-bold">{currency}{lStat.amount.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColors[idx % barColors.length]}`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid for Table and Shortcuts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Bills list */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle className="text-base font-semibold">Recent Billings</CardTitle>
              <CardDescription>Last 5 invoices generated by operator</CardDescription>
            </div>
            <Link href="/reports" className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-0.5">
              View All Bills <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentBills.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">No invoices generated yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Farmer</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-bold text-xs">{bill.invoiceNumber}</TableCell>
                      <TableCell className="font-medium text-slate-850 dark:text-slate-200">
                        {bill.customerName}
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                          {bill.createdBy || "Operator"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">{bill.hoursUsed} hr</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          bill.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        }`}>
                          {bill.paymentStatus === "PAID" ? "Paid" : "Not Paid"}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-right text-emerald-700 dark:text-emerald-400">
                        {currency}{bill.grandTotal}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Quick billing shortcuts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Quick Bill Shortcuts</CardTitle>
            <CardDescription>Instantly draft invoice for active farmers</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {recentCustomers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Add farmers to unlock shortcut billing.</p>
            ) : (
              recentCustomers.map((cust) => (
                <Link key={cust.id} href={`/billing?customerId=${cust.id}`} passHref>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-slate-800 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/10 cursor-pointer transition-all group">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-400 transition-colors">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-850 dark:text-slate-200 truncate leading-none">{cust.name}</p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 mt-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {cust.location ? `${cust.location}${cust.state ? `, ${cust.state}` : ''}` : "No Location"}
                        </span>
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
