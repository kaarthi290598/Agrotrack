"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { billingService } from "../../services/billing.service";
import { customerService } from "../../services/customer.service";
import { settingsService } from "../../services/settings.service";
import { Bill, Customer, Settings, PaymentStatus } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { 
  Search, 
  Eye, 
  Printer, 
  Trash2, 
  FileSpreadsheet, 
  Calendar, 
  IndianRupee, 
  Clock,
  Filter,
  X,
  AlertTriangle,
  BarChart3
} from "lucide-react";

import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";

export default function ReportsPage() {
  const router = useRouter();
  const { orgId } = useClerkAuth();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();

  useEffect(() => {
    if (user && !isAdmin) {
      toast({ type: "error", title: "Access Denied", description: "Reports page is restricted to Admin users." });
      router.replace("/billing");
    }
  }, [user, isAdmin, router, toast]);
  const [bills, setBills] = useState<(Bill & { customerName?: string; customerMobile?: string; customerLocation?: string; customerState?: string })[]>([]);
  const [filteredBills, setFilteredBills] = useState<(Bill & { customerName?: string; customerMobile?: string; customerLocation?: string; customerState?: string })[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "PAID" | "UNPAID">("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [locations, setLocations] = useState<string[]>([]);

  // Dialog states
  const [selectedBill, setSelectedBill] = useState<(Bill & { customerName?: string; customerMobile?: string; customerLocation?: string; customerState?: string }) | null>(null);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleTogglePaymentStatus = async (id: string, currentStatus: PaymentStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus = currentStatus === "PAID" ? "UNPAID" : "PAID";
    try {
      await billingService.updatePaymentStatus(id, nextStatus);
      toast({
        type: "success",
        title: `Marked as ${nextStatus === "PAID" ? "Paid" : "Not Paid"}`,
        description: `Payment status updated to ${nextStatus}.`
      });
      loadData();
      if (selectedBill && selectedBill.id === id) {
        setSelectedBill({ ...selectedBill, paymentStatus: nextStatus });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to update payment status." });
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const rawBills = await billingService.getAll(orgId || undefined);
      const allBills = rawBills.filter((b) => isBillCreatedByUser(b, user, isAdmin) && b.status === "APPROVED" && b.paymentStatus === "PAID");
      const allCustomers = await customerService.getAll(orgId || undefined);
      const loadedSettings = await settingsService.get(orgId || undefined);
      setSettings(loadedSettings);

      const customerMap = new Map(allCustomers.map((c) => [c.id, c]));
      
      // Map customer names/details onto bills
      const enrichedBills = allBills.map((b) => {
        const cust = customerMap.get(b.customerId);
        return {
          ...b,
          customerName: cust?.name || "Deleted Customer",
          customerMobile: cust?.mobile || "",
          customerLocation: cust?.location || "",
          customerState: cust?.state || ""
        };
      });

      setBills(enrichedBills);
      setFilteredBills(enrichedBills);

      // Extract unique locations
      const uniqueLocations = Array.from(
        new Set(
          allCustomers
            .map((c) => c.location)
            .filter((v): v is string => typeof v === "string" && v !== "")
        )
      );
      setLocations(uniqueLocations);
    } catch (err) {
      toast({
        type: "error",
        title: "Load Error",
        description: "Failed to load reports and billing records."
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  // Filter application logic
  useEffect(() => {
    let result = [...bills];

    // Search query filter (matches Invoice number, customer name, location, state)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.invoiceNumber.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerLocation?.toLowerCase().includes(q) ||
          b.customerState?.toLowerCase().includes(q)
      );
    }

    // Date range filter
    if (dateFilter !== "all") {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      let threshold = now.getTime();

      if (dateFilter === "week") {
        threshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === "month") {
        threshold = now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }

      result = result.filter((b) => b.createdAt >= threshold);
    }

    // Location filter
    if (selectedLocation !== "all") {
      result = result.filter((b) => b.customerLocation === selectedLocation);
    }

    // Payment status filter
    if (paymentFilter !== "all") {
      result = result.filter((b) => (b.paymentStatus || "UNPAID") === paymentFilter);
    }

    // Amount filter
    if (minAmount) {
      const amt = parseFloat(minAmount);
      if (!isNaN(amt)) {
        result = result.filter((b) => b.grandTotal >= amt);
      }
    }

    setFilteredBills(result);
  }, [searchQuery, dateFilter, selectedLocation, paymentFilter, minAmount, bills]);

  // Handle delete invoice
  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening preview modal
    setBillToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    try {
      await billingService.delete(billToDelete);
      toast({
        type: "success",
        title: "Invoice Deleted",
        description: "Billing record has been removed successfully."
      });
      setIsDeleteOpen(false);
      setBillToDelete(null);
      loadData();
    } catch (err) {
      toast({
        type: "error",
        title: "Delete Failed",
        description: "Failed to remove invoice records."
      });
    }
  };

  const handleExportExcel = () => {
    toast({
      type: "info",
      title: "Feature Offline",
      description: "Excel Export is a placeholder and will be enabled upon Convex cloud DB release."
    });
  };

  const triggerPrint = () => {
    window.print();
  };

  // Metrics summarizing current filters
  const totalInvoiced = filteredBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const paidRevenue = filteredBills.filter(b => b.paymentStatus === "PAID").reduce((acc, b) => acc + b.grandTotal, 0);
  const unpaidRevenue = filteredBills.filter(b => b.paymentStatus !== "PAID").reduce((acc, b) => acc + b.grandTotal, 0);
  const totalHours = filteredBills.reduce((acc, b) => acc + b.hoursUsed, 0);
  const currencySymbol = settings?.currencySymbol || "₹";

  return (
    <div className="space-y-6">
      {/* Hidden print area identical to billing print layout */}
      {selectedBill && settings && (
        <div id="print-area" className="hidden print:block print:p-8 bg-white text-black font-sans text-xs w-[210mm] min-h-[297mm]">
          <div className="border-b-2 border-slate-350 pb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase leading-none">{settings.businessName}</h1>
              <p className="text-[10px] text-slate-500 mt-1 max-w-xs">{settings.businessAddress}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Phone: {settings.phoneNumber}</p>
              {settings.gstNumber && <p className="text-[10px] text-slate-700 font-semibold mt-0.5">GSTIN: {settings.gstNumber}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-sm font-bold text-emerald-700 tracking-wide uppercase">Tax Invoice</h2>
              <p className="font-semibold text-slate-900 mt-1.5">{selectedBill.invoiceNumber}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Date: {selectedBill.date}</p>
              <p className={`text-[10px] font-bold mt-1 uppercase border px-1.5 py-0.5 inline-block ${
                selectedBill.paymentStatus === "PAID" ? "border-emerald-600 text-emerald-700 bg-emerald-50" : "border-amber-600 text-amber-800 bg-amber-50"
              }`}>
                Payment: {selectedBill.paymentStatus === "PAID" ? "PAID" : "NOT PAID / UNPAID"}
              </p>
            </div>
          </div>

          <div className="my-6 grid grid-cols-2 gap-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Bill To:</h3>
              <p className="font-bold text-slate-800 text-sm mt-1">{selectedBill.customerName}</p>
              <p className="text-slate-600 mt-0.5">Mobile: {selectedBill.customerMobile}</p>
              {selectedBill.customerLocation && (
                <p className="text-slate-600 mt-0.5">Location: {selectedBill.customerLocation}{selectedBill.customerState ? `, ${selectedBill.customerState}` : ''}</p>
              )}
            </div>
            <div className="text-right flex flex-col justify-end">
              <p className="text-[10px] text-slate-600">Hours Rent Rate: {currencySymbol}{selectedBill.hourlyRate} / hour</p>
              <p className="text-[10px] text-slate-600">Usage Duration: {selectedBill.hoursUsed} hr</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-slate-200 mt-6">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-2">Description</th>
                <th className="p-2 text-center">Unit / Rate</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-150">
                <td className="p-2">
                  <p className="font-semibold">Machine Rental Usage</p>
                  <span className="text-[10px] text-slate-450">Tillage / Harvesting services on hourly charges</span>
                </td>
                <td className="p-2 text-center">{selectedBill.hoursUsed} hr × {currencySymbol}{selectedBill.hourlyRate}</td>
                <td className="p-2 text-right font-semibold">{currencySymbol}{selectedBill.hoursUsed * selectedBill.hourlyRate}</td>
              </tr>
              {selectedBill.extraCharges.map((chg) => (
                <tr key={chg.id} className="border-b border-slate-150">
                  <td className="p-2">
                    <p className="font-semibold">{chg.name}</p>
                    <span className="text-[10px] text-slate-450">Additional service/operating fees</span>
                  </td>
                  <td className="p-2 text-center">Lump sum</td>
                  <td className="p-2 text-right font-semibold">{currencySymbol}{chg.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-1.5 text-right border-t border-slate-200 pt-4">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Subtotal Usage:</span>
                <span>{currencySymbol}{selectedBill.hoursUsed * selectedBill.hourlyRate}</span>
              </div>
              {selectedBill.extraCharges.length > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Additional Charges:</span>
                  <span>+{currencySymbol}{selectedBill.extraCharges.reduce((s, c) => s + c.amount, 0)}</span>
                </div>
              )}
              {selectedBill.discount > 0 && (
                <div className="flex justify-between text-[10px] text-red-600 font-semibold">
                  <span>Discount Applied:</span>
                  <span>-{currencySymbol}{selectedBill.discount}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-emerald-600 pt-2 font-bold text-sm text-slate-800">
                <span>Grand Total:</span>
                <span className="text-emerald-700">{currencySymbol}{selectedBill.grandTotal}</span>
              </div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-8 items-end border-t border-slate-100 pt-8">
            <div className="text-[9px] text-slate-500">
              <span className="font-bold uppercase tracking-wider block text-slate-600 mb-1">Invoice Notes</span>
              <p>{settings.invoiceNotes || "Please clear payment within due period."}</p>
              <p className="mt-4">{settings.footerText}</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="h-10 w-24 border-b border-slate-300"></div>
              <p className="text-[10px] font-semibold text-slate-700 mt-2">Authorized Signatory</p>
            </div>
          </div>
        </div>
      )}

      {/* Screen layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Billing Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Query generated invoices, filter by customer location, payment status, dates, or scale.
          </p>
        </div>
        <Button
          onClick={handleExportExcel}
          variant="outline"
          className="w-full sm:w-auto gap-1.5 cursor-pointer"
        >
          <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-600" />
          Export to Excel
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute top-3 left-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by invoice ID, customer name, location, state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Date Range Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Date Range</label>
              <select
                value={dateFilter}
                onChange={(e: any) => setDateFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 cursor-pointer h-10"
              >
                <option value="all">All Dates</option>
                <option value="today">Today's Billings</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payment Status</label>
              <select
                value={paymentFilter}
                onChange={(e: any) => setPaymentFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 cursor-pointer h-10 font-medium"
              >
                <option value="all">All Payment Statuses</option>
                <option value="PAID">Paid Only</option>
                <option value="UNPAID">Not Paid / Unpaid Only</option>
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 cursor-pointer h-10"
              >
                <option value="all">All Locations</option>
                {locations.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Min Amount filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Minimum Bill amount</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Min Amount (e.g. 5000)"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 pl-7 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 h-10"
                />
                <span className="absolute top-2.5 left-3 text-xs text-slate-400 font-mono">{currencySymbol}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <IndianRupee className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold leading-none">Total Invoiced</span>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{currencySymbol}{totalInvoiced.toLocaleString()}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 flex items-center justify-center shrink-0">
            <IndianRupee className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 uppercase font-semibold leading-none">Collected (Paid)</span>
            <p className="text-base font-bold text-teal-700 dark:text-teal-300 mt-0.5">{currencySymbol}{paidRevenue.toLocaleString()}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IndianRupee className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold leading-none">Outstanding (Unpaid)</span>
            <p className="text-base font-bold text-amber-800 dark:text-amber-300 mt-0.5">{currencySymbol}{unpaidRevenue.toLocaleString()}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold leading-none">Total Usage</span>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{totalHours.toLocaleString()} hrs</p>
          </div>
        </div>
      </div>

      {/* Invoices List Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800 w-full"></div>
              <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800 w-full"></div>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <Clock className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="font-semibold text-sm">No report records found for current filters.</p>
            </div>
          ) : (
            <div>
              {/* Mobile Cards List (No Horizontal Scrolling) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredBills.map((bill) => (
                  <div
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs cursor-pointer hover:border-emerald-500 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                          {bill.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-slate-500">{bill.date}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePaymentStatus(bill.id, bill.paymentStatus || "UNPAID", e)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                          bill.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            : bill.paymentStatus === "PARTIAL_PAID"
                            ? "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300 dark:border-orange-800"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {bill.paymentStatus === "PAID"
                          ? "Paid"
                          : bill.paymentStatus === "PARTIAL_PAID"
                          ? `Partial (${currencySymbol}${bill.amountPaid || 0})`
                          : "Not Paid"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Farmer</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{bill.customerName}</p>
                        <p className="text-[10px] text-slate-500">{bill.customerLocation || "Direct"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created By</span>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400 truncate">{bill.createdBy || "Operator"}</p>
                        <p className="text-[10px] text-slate-500">{bill.hoursUsed} hrs used</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {currencySymbol}{bill.grandTotal}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer"
                          title="View Invoice Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(bill.id, e)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg border border-rose-200 dark:border-rose-900 cursor-pointer"
                          title="Delete Invoice Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>Farmer</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Location & State</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="hidden md:table-cell">Hours Used</TableHead>
                        <TableHead>Grand Total</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead className="text-center w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((bill) => (
                        <TableRow 
                          key={bill.id}
                          onClick={() => setSelectedBill(bill)}
                          className="cursor-pointer"
                        >
                          <TableCell className="font-bold text-xs">{bill.invoiceNumber}</TableCell>
                          <TableCell className="font-semibold text-slate-900 dark:text-white">{bill.customerName}</TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                              {bill.createdBy || "Operator"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {bill.customerLocation || bill.customerState ? (
                              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 text-xs">
                                {bill.customerLocation || ''}{bill.customerLocation && bill.customerState ? ', ' : ''}{bill.customerState || ''}
                              </span>
                            ) : (
                              <span className="text-slate-450 text-xs italic">Direct</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">{bill.date}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{bill.hoursUsed} hrs</TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol}{bill.grandTotal}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleTogglePaymentStatus(bill.id, bill.paymentStatus || "UNPAID", e)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                                bill.paymentStatus === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100"
                              }`}
                              title="Click to toggle Payment Status (Both User & Admin)"
                            >
                              {bill.paymentStatus === "PAID" ? "Paid" : "Not Paid"}
                            </button>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedBill(bill)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="View Invoice Detail"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(bill.id, e)}
                                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Delete Invoice Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog
        isOpen={selectedBill !== null}
        onClose={() => setSelectedBill(null)}
        title={`Invoice Receipt Details`}
        className="max-w-2xl text-left"
        footer={
          <>
            {selectedBill && (
              <Button
                variant="outline"
                onClick={() => handleTogglePaymentStatus(selectedBill.id, selectedBill.paymentStatus || "UNPAID")}
                className="cursor-pointer border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50"
              >
                Mark as {selectedBill.paymentStatus === "PAID" ? "Not Paid" : "Paid"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedBill(null)} className="cursor-pointer">Close</Button>
            <Button variant="success" onClick={triggerPrint} className="cursor-pointer">
              <Printer className="h-4 w-4" />
              Print / Save PDF (A4)
            </Button>
          </>
        }
      >
        {selectedBill && settings && (
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px] space-y-4 shadow-inner max-h-[50vh] overflow-y-auto">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-xs text-emerald-650">{settings.businessName}</h3>
                  <p className="text-[10px] text-slate-500">{settings.businessAddress}</p>
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs uppercase text-slate-400">Invoice</h4>
                  <p className="font-bold">{selectedBill.invoiceNumber}</p>
                  <p className={`text-[9px] font-bold mt-1 inline-block px-1.5 py-0.2 rounded ${
                    selectedBill.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {selectedBill.paymentStatus === "PAID" ? "PAID" : "NOT PAID"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Farmer Info</span>
                  <p className="font-bold">{selectedBill.customerName}</p>
                  <p>Mobile: {selectedBill.customerMobile}</p>
                  {selectedBill.customerLocation && (
                    <p>Location: {selectedBill.customerLocation}{selectedBill.customerState ? `, ${selectedBill.customerState}` : ''}</p>
                  )}
                </div>
                <div className="text-right flex flex-col justify-end">
                  <p>Rent Rate: {currencySymbol}{selectedBill.hourlyRate}/hour</p>
                  <p>Duration: {selectedBill.hoursUsed} hours</p>
                  <p>Date: {selectedBill.date}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-850 pb-1 text-[9px] uppercase">
                      <th>Description</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 dark:border-slate-900">
                      <td className="py-2">Machine Rental Usage Rent ({selectedBill.hoursUsed} hr)</td>
                      <td className="text-right py-2">{currencySymbol}{selectedBill.hoursUsed * selectedBill.hourlyRate}</td>
                    </tr>
                    {selectedBill.extraCharges.map((chg) => (
                      <tr key={chg.id} className="border-b border-slate-50 dark:border-slate-900">
                        <td className="py-2">{chg.name}</td>
                        <td className="text-right py-2">+{currencySymbol}{chg.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-end pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex justify-between w-48 text-[10px]">
                  <span className="text-slate-400">Subtotal:</span>
                  <span>{currencySymbol}{selectedBill.hoursUsed * selectedBill.hourlyRate + selectedBill.extraCharges.reduce((s, c) => s + c.amount, 0)}</span>
                </div>
                {selectedBill.discount > 0 && (
                  <div className="flex justify-between w-48 text-[10px] text-red-500">
                    <span className="font-semibold">Discount:</span>
                    <span>-{currencySymbol}{selectedBill.discount}</span>
                  </div>
                )}
                <div className="flex justify-between w-48 font-bold text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <span>Grand Total:</span>
                  <span className="text-emerald-600">{currencySymbol}{selectedBill.grandTotal}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Billing Record"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} className="cursor-pointer">Permanently Delete</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete this invoice record? This action cannot be undone.
          </p>
          <div className="rounded-lg bg-red-50 p-3.5 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>This will delete this bill from the reporting database. It will not delete the related farmer.</span>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
