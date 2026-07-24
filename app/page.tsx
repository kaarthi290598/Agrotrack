"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { billingService } from "../services/billing.service";
import { settingsService } from "../services/settings.service";
import { Customer, Bill, Settings } from "../types";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/Card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../components/ui/Table";
import { DashboardSkeleton } from "../components/skeletons/PageSkeletons";
import { TABLE } from "../lib/ui-classes";
import {
  Users,
  Receipt,
  IndianRupee,
  TrendingUp,
  Calculator,
  Plus,
  ArrowUpRight,
  User,
  MapPin,
} from "lucide-react";
import { customerService } from "../services/customer.service";
import { Show, useAuth as useClerkAuth, useOrganization } from "@clerk/nextjs";
import { useAuth } from "../components/auth/AuthProvider";
import { LandingPage } from "../components/landing/LandingPage";
import { MonthlyRevenueChart } from "../components/dashboard/MonthlyRevenueChart";
import { StatCard } from "../components/ui/StatCard";

interface DashboardData {
  totalCustomers: number;
  totalBills: number;
  totalRevenue: number;
  todayRevenue: number;
  averageBilling: number;
  recentBills: (Bill & { customerName?: string })[];
  monthlyRevenue: { year: number; month: number; amount: number }[];
  availableYears: number[];
  locationStats: { location: string; amount: number }[];
}

export default function DashboardPage() {
  const { orgId, orgRole, isLoaded: isClerkLoaded } = useClerkAuth();
  const { organization } = useOrganization();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Wait for Clerk so we don't fetch unscoped/all-org data before orgId is ready
    if (!isClerkLoaded) return;

    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const stats = await billingService.getStats(
          orgId || undefined,
          user,
          isAdmin,
        );
        const settingsData = await settingsService.get(orgId || undefined);
        const custData = await customerService.getAll(orgId || undefined);

        setData(stats);
        setSettings(settingsData);
        setRecentCustomers(custData.slice(-4).reverse());
      } catch (error) {
        toast({
          type: "error",
          title: "Dashboard Error",
          description: "Could not load stats data.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboardData();
  }, [orgId, isClerkLoaded, toast, user, isAdmin]);

  if (isLoading || !data || !settings) {
    return <DashboardSkeleton />;
  }

  const currency = settings.currencySymbol || "₹";

  return (
    <div className="space-y-8">
      {/* Active Clerk Organization ID Status Card */}
      <div className="rounded-2xl bg-linear-to-r from-emerald-900/90 via-teal-900 to-slate-900 p-5 text-white shadow-lg border border-emerald-500/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold">
              {organization?.name ? organization.name.charAt(0) : "O"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Active Organization
                </span>
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
        </div>
      </div>

      {/* Welcome Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Operator Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Billing summary and recent statistics for{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-500">
              {settings.businessName}
            </span>
            .
          </p>
        </div>
        <Link href="/billing" passHref className="w-full sm:w-auto">
          <Button variant="primary" className="w-full sm:w-auto cursor-pointer shadow-md shadow-emerald-600/20">
            <Plus className="h-4.5 w-4.5" />
            Generate New Bill
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Farmers" value={data.totalCustomers} icon={<Users className="h-3.5 w-3.5" />} color="emerald" mono={false} />
        <StatCard label="Bills Created" value={data.totalBills} icon={<Receipt className="h-3.5 w-3.5" />} color="blue" mono={false} />
        <StatCard label="Total Revenue" value={`${currency}${data.totalRevenue.toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color="amber" />
        <StatCard label="Today's Revenue" value={`${currency}${data.todayRevenue.toLocaleString()}`} icon={<TrendingUp className="h-3.5 w-3.5" />} color="indigo" />
        <StatCard label="Avg Bill Value" value={`${currency}${Math.round(data.averageBilling).toLocaleString()}`} icon={<Calculator className="h-3.5 w-3.5" />} color="pink" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MonthlyRevenueChart
          data={data.monthlyRevenue}
          availableYears={data.availableYears}
          currency={currency}
        />

        {/* Top Locations Progress Bars */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Top Locations (Revenue)
            </CardTitle>
            <CardDescription>
              Major agricultural hubs contributing to revenue
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4.5">
            {data.locationStats.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No location revenue data available.
              </p>
            ) : (
              data.locationStats.map((lStat, idx) => {
                const totalLocRev = data.locationStats[0].amount;
                const percentage =
                  totalLocRev > 0 ? (lStat.amount / totalLocRev) * 100 : 0;

                const barColors = [
                  "bg-emerald-600 dark:bg-emerald-500",
                  "bg-teal-600 dark:bg-teal-500",
                  "bg-sky-600 dark:bg-sky-500",
                  "bg-amber-600 dark:bg-amber-500",
                  "bg-slate-600 dark:bg-slate-500",
                ];

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {lStat.location}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 font-bold">
                        {currency}
                        {lStat.amount.toLocaleString()}
                      </span>
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
              <CardTitle className="text-base font-semibold">
                Recent Billings
              </CardTitle>
              <CardDescription>
                Last 5 invoices generated by operator
              </CardDescription>
            </div>
            <Link
              href="/bills"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-0.5"
            >
              View All Bills <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentBills.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No invoices generated yet.
              </p>
            ) : (
              <div className="p-3 sm:p-4">
                {/* Mobile Cards List */}
                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                  {data.recentBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {bill.invoiceNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            bill.paymentStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : bill.paymentStatus === "PARTIAL_PAID"
                                ? "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {bill.paymentStatus === "PAID"
                            ? "Paid"
                            : bill.paymentStatus === "PARTIAL_PAID"
                              ? "Partial Paid"
                              : "Not Paid"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {bill.customerName}
                        </span>
                        <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          {currency}
                          {bill.grandTotal}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>Farmer</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">
                          Grand Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentBills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell className={TABLE.invoice}>
                            {bill.invoiceNumber}
                          </TableCell>
                          <TableCell className={TABLE.name}>
                            {bill.customerName}
                          </TableCell>
                          <TableCell className={TABLE.name}>
                            {bill.createdBy || "Unknown"}
                          </TableCell>
                          <TableCell className={TABLE.muted}>
                            {bill.hoursUsed} hr
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                bill.paymentStatus === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : bill.paymentStatus === "PARTIAL_PAID"
                                    ? "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              }`}
                            >
                              {bill.paymentStatus === "PAID"
                                ? "Paid"
                                : bill.paymentStatus === "PARTIAL_PAID"
                                  ? "Partial Paid"
                                  : "Not Paid"}
                            </span>
                          </TableCell>
                          <TableCell className={TABLE.moneyRight}>
                            {currency}
                            {bill.grandTotal}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick billing shortcuts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Quick Bill Shortcuts
            </CardTitle>
            <CardDescription>
              Instantly draft invoice for active farmers
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {recentCustomers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Add farmers to unlock shortcut billing.
              </p>
            ) : (
              recentCustomers.map((cust) => (
                <Link
                  key={cust.id}
                  href={`/billing?customerId=${cust.id}`}
                  passHref
                >
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:border-emerald-500 hover:bg-emerald-50/20 dark:border-slate-800 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/10 cursor-pointer transition-all group">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-400 transition-colors">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-none">
                          {cust.name}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 mt-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {cust.location
                            ? `${cust.location}${cust.state ? `, ${cust.state}` : ""}`
                            : "No Location"}
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
