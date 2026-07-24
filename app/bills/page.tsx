"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { billingService } from "../../services/billing.service";
import { customerService } from "../../services/customer.service";
import { settingsService } from "../../services/settings.service";
import { Bill, Customer, Settings } from "../../types";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { TimePicker } from "../../components/ui/TimePicker";
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Send, 
  Search, 
  Loader2,
  Printer,
  Receipt,
  IndianRupee,
  Plus,
  ArrowUpDown,
  Calendar
} from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";

function BillsListInner() {
  const { orgId } = useClerkAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter & Search
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<"ALL" | "PAID" | "PARTIAL_PAID" | "UNPAID">("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("CURRENT_MONTH");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "AMOUNT_HIGH" | "AMOUNT_LOW" | "INVOICE_NO">("NEWEST");
  const [searchQuery, setSearchQuery] = useState("");

  // Multi-Select Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Partial Payment Modal State
  const [paymentModalBill, setPaymentModalBill] = useState<Bill | null>(null);
  const [partialPaymentStatus, setPartialPaymentStatus] = useState<"PAID" | "UNPAID" | "PARTIAL_PAID">("UNPAID");
  const [partialPaidAmount, setPartialPaidAmount] = useState<string>("");

  // Edit Bill Modal State
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Printable Invoice Modal State
  const [viewInvoice, setViewInvoice] = useState<(Bill & { customerName?: string; customerMobile?: string; customerLocation?: string; customerState?: string }) | null>(null);

  const fetchAllData = async () => {
    try {
      const [billsData, customersData, settingsData] = await Promise.all([
        billingService.getAll(orgId || undefined),
        customerService.getAll(orgId || undefined),
        settingsService.get(orgId || undefined)
      ]);
      setBills(billsData);
      setCustomers(customersData);
      setSettings(settingsData);

      // Check if filter status passed via URL query
      const urlStatus = searchParams.get("status");
      if (urlStatus === "PENDING_APPROVAL" || urlStatus === "APPROVED" || urlStatus === "REJECTED") {
        setFilterStatus(urlStatus);
      }
    } catch (err) {
      toast({ type: "error", title: "Error", description: "Failed to load records." });
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [searchParams, toast, orgId]);

  // Bulk Selection Handlers
  const toggleSelectAll = (visibleBills: Bill[]) => {
    if (selectedIds.length === visibleBills.length && visibleBills.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleBills.map((b) => b.id));
    }
  };

  const toggleSelectBill = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      await billingService.bulkApprove(selectedIds);
      toast({ type: "success", title: "Bulk Approved", description: `Approved ${selectedIds.length} bills.` });
      setSelectedIds([]);
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Bulk Error", description: err.message || "Failed to approve bills." });
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    try {
      await billingService.bulkReject(selectedIds);
      toast({ type: "info", title: "Bulk Rejected", description: `Rejected ${selectedIds.length} bills.` });
      setSelectedIds([]);
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Bulk Error", description: err.message || "Failed to reject bills." });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!isAdmin) {
      toast({ type: "error", title: "Access Denied", description: "Only Admins can bulk delete bills." });
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} bills?`)) return;
    try {
      await billingService.bulkDelete(selectedIds);
      toast({ type: "success", title: "Bulk Deleted", description: `Deleted ${selectedIds.length} bills.` });
      setSelectedIds([]);
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Bulk Error", description: err.message || "Failed to delete bills." });
    }
  };

  // Payment Status & Partial Payment Modal Handlers
  const handleOpenPaymentModal = (bill: Bill) => {
    setPaymentModalBill(bill);
    setPartialPaymentStatus(bill.paymentStatus || "UNPAID");
    setPartialPaidAmount(bill.amountPaid !== undefined ? String(bill.amountPaid) : "");
  };

  // Approval & Single Bill Handlers
  const handleApproveBill = async (id: string) => {
    try {
      await billingService.approve(id);
      toast({ type: "success", title: "Bill Approved", description: "Bill status updated to Approved." });
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to approve bill." });
    }
  };

  const handleRejectBill = async (id: string) => {
    try {
      await billingService.reject(id);
      toast({ type: "info", title: "Bill Rejected", description: "Bill status updated to Rejected." });
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to reject bill." });
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!isAdmin) {
      toast({ type: "error", title: "Access Denied", description: "Only Administrators can delete bills." });
      return;
    }
    if (!confirm("Are you sure you want to delete this bill? This action cannot be undone.")) return;
    try {
      await billingService.delete(id);
      toast({ type: "success", title: "Bill Deleted", description: "Bill removed from system." });
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to delete bill." });
    }
  };

  const handleOpenEditModal = (bill: Bill) => {
    router.push(`/billing?editBillId=${bill.id}`);
  };

  const handleViewInvoice = (bill: Bill) => {
    const cust = customerMap.get(bill.customerId);
    setViewInvoice({
      ...bill,
      customerName: cust?.name || "Unknown Farmer",
      customerMobile: cust?.mobile || "N/A",
      customerLocation: cust?.location,
      customerState: cust?.state
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Save Payment Status (Full / Unpaid / Partial)
  const handleSavePaymentStatus = async () => {
    if (!paymentModalBill) return;
    const paidNum = parseFloat(partialPaidAmount) || 0;
    if (partialPaymentStatus === "PARTIAL_PAID" && (paidNum < 0 || paidNum > paymentModalBill.grandTotal)) {
      toast({ type: "error", title: "Validation Error", description: "Partial paid amount must be between 0 and bill Grand Total." });
      return;
    }
    try {
      await billingService.updatePaymentStatus(paymentModalBill.id, partialPaymentStatus, paidNum);
      toast({
        type: "success",
        title: "Payment Updated",
        description: `Marked bill ${paymentModalBill.invoiceNumber} as ${partialPaymentStatus.replace("_", " ")}.`
      });
      setPaymentModalBill(null);
      fetchAllData();
      if (viewInvoice && viewInvoice.id === paymentModalBill.id) {
        setViewInvoice({
          ...viewInvoice,
          paymentStatus: partialPaymentStatus,
          amountPaid: partialPaymentStatus === "PARTIAL_PAID" ? paidNum : partialPaymentStatus === "PAID" ? viewInvoice.grandTotal : 0,
          balanceAmount: partialPaymentStatus === "PARTIAL_PAID" ? Math.max(0, viewInvoice.grandTotal - paidNum) : partialPaymentStatus === "PAID" ? 0 : viewInvoice.grandTotal
        });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to update payment status." });
    }
  };

  if (!isLoaded || !settings) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const currencySymbol = settings.currencySymbol || "₹";
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // First scope bills based on user role (Admin sees all, Member sees their own)
  const userBills = bills.filter((b) => isBillCreatedByUser(b, user, isAdmin));

  // Filter bills by search, approval status, payment status, and month/date range
  const filteredBills = userBills
    .filter((b) => {
      if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
      if (paymentFilterStatus !== "ALL" && b.paymentStatus !== paymentFilterStatus) return false;

      // Month & Date Filtering
      if (monthFilter === "CURRENT_MONTH") {
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        if (!b.date || !b.date.startsWith(currentMonthPrefix)) return false;
      } else if (monthFilter === "LAST_MONTH") {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const lastMonthPrefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!b.date || !b.date.startsWith(lastMonthPrefix)) return false;
      } else if (monthFilter === "CUSTOM") {
        if (startDate && b.date < startDate) return false;
        if (endDate && b.date > endDate) return false;
      } else if (monthFilter !== "ALL_TIME" && monthFilter) {
        if (!b.date || !b.date.startsWith(monthFilter)) return false;
      }

      if (searchQuery) {
        const cName = customerMap.get(b.customerId)?.name || "";
        return (
          b.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "NEWEST") {
        return (b.createdAt || 0) - (a.createdAt || 0) || b.invoiceNumber.localeCompare(a.invoiceNumber);
      }
      if (sortBy === "OLDEST") {
        return (a.createdAt || 0) - (b.createdAt || 0) || a.invoiceNumber.localeCompare(b.invoiceNumber);
      }
      if (sortBy === "AMOUNT_HIGH") {
        return b.grandTotal - a.grandTotal;
      }
      if (sortBy === "AMOUNT_LOW") {
        return a.grandTotal - b.grandTotal;
      }
      if (sortBy === "INVOICE_NO") {
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      }
      return 0;
    });

  const totalValue = userBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const paidBillsCount = userBills.filter(b => b.paymentStatus === "PAID").length;
  const pendingCount = userBills.filter(b => b.status === "PENDING_APPROVAL").length;

  return (
    <div className="space-y-6">
      {/* Printable Invoice Modal Component */}
      {viewInvoice && (
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
              <p className="font-semibold text-slate-900 mt-1.5">{viewInvoice.invoiceNumber}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Date: {viewInvoice.date}</p>
              <p className="text-[10px] font-bold text-emerald-600 mt-0.5 uppercase">Status: {viewInvoice.status}</p>
            </div>
          </div>

          <div className="my-6 grid grid-cols-2 gap-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Bill To:</h3>
              <p className="font-bold text-slate-800 text-sm mt-1">{viewInvoice.customerName}</p>
              <p className="text-slate-600 mt-0.5">Mobile: {viewInvoice.customerMobile}</p>
              {viewInvoice.customerLocation && (
                <p className="text-slate-600 mt-0.5">Location: {viewInvoice.customerLocation}, {viewInvoice.customerState}</p>
              )}
            </div>
            <div className="text-right">
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Billing Summary:</h3>
              <p className="text-slate-600 mt-1">Operator: <span className="font-medium">{viewInvoice.createdBy || "Operator"}</span></p>
              <p className="text-slate-600 mt-0.5">Rental Duration: <span className="font-bold text-slate-900">{viewInvoice.hoursUsed} hrs</span></p>
              <p className="text-slate-600 mt-0.5">Hourly Rate: {currencySymbol}{viewInvoice.hourlyRate}/hr</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse my-6">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 font-bold text-slate-700">
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3 text-right">Hours / Rate</th>
                <th className="py-2 px-3 text-right">Total ({currencySymbol})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-slate-800">Machinery Rental Usage</span>
                  {viewInvoice.startTime && viewInvoice.endTime && (
                    <span className="block text-[10px] text-slate-500">Timing: {viewInvoice.startTime} - {viewInvoice.endTime}</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">{viewInvoice.hoursUsed} hrs @ {currencySymbol}{viewInvoice.hourlyRate}/hr</td>
                <td className="py-2.5 px-3 text-right font-medium">{(viewInvoice.hoursUsed * viewInvoice.hourlyRate).toLocaleString()}</td>
              </tr>

              {viewInvoice.extraCharges && viewInvoice.extraCharges.map((chg, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-3 text-slate-700">{chg.name}</td>
                  <td className="py-2 px-3 text-right text-slate-500">Extra Charge</td>
                  <td className="py-2 px-3 text-right font-medium">{chg.amount.toLocaleString()}</td>
                </tr>
              ))}

              {viewInvoice.discount > 0 && (
                <tr className="text-emerald-700">
                  <td className="py-2 px-3 font-medium">Special Discount</td>
                  <td className="py-2 px-3 text-right">-</td>
                  <td className="py-2 px-3 text-right font-medium">-{viewInvoice.discount.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-between items-end border-t border-slate-300 pt-4 mt-6">
            <div>
              <p className="text-[10px] text-slate-500">{settings.invoiceNotes || "Thank you for using our service!"}</p>
              <div className="mt-4 pt-4 border-t border-dashed border-slate-300 w-48 text-center">
                <p className="text-[9px] text-slate-400">Authorized Signature</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8 text-sm font-bold text-slate-900 border-b border-slate-200 pb-1">
                <span>Grand Total:</span>
                <span>{currencySymbol}{viewInvoice.grandTotal.toLocaleString()}</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-600 mt-1">Payment Status: <span className={viewInvoice.paymentStatus === "PAID" ? "text-emerald-700 uppercase" : "text-amber-700 uppercase"}>{viewInvoice.paymentStatus}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Page Header ═══════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {isAdmin ? "Bills & Approvals" : "My Bills"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin 
              ? "Review, approve, and manage all billing invoices" 
              : "Track your generated bills and their status"}
          </p>
        </div>
        <Link href="/billing" passHref className="w-full sm:w-auto shrink-0">
          <Button variant="primary" className="w-full sm:w-auto cursor-pointer gap-2 shadow-md shadow-emerald-600/20">
            <Plus className="h-4 w-4" /> New Bill
          </Button>
        </Link>
      </div>

      {/* ═══════════ Stat Cards ═══════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40 p-3.5">
          <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider">Total Bills</p>
          <p className="text-xl font-extrabold text-emerald-900 dark:text-emerald-300 mt-1 font-mono">{userBills.length}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border border-blue-200/60 dark:border-blue-800/40 p-3.5">
          <p className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider">Total Value</p>
          <p className="text-xl font-extrabold text-blue-900 dark:text-blue-300 mt-1 font-mono">{currencySymbol}{totalValue.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20 border border-violet-200/60 dark:border-violet-800/40 p-3.5">
          <p className="text-[10px] font-bold text-violet-600/70 dark:text-violet-400/70 uppercase tracking-wider">Paid</p>
          <p className="text-xl font-extrabold text-violet-900 dark:text-violet-300 mt-1 font-mono">{paidBillsCount}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 p-3.5">
          <p className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider">Pending</p>
          <p className="text-xl font-extrabold text-amber-900 dark:text-amber-300 mt-1 font-mono">{pendingCount}</p>
        </div>
      </div>

      {/* ═══════════ Filter & List Card ═══════════ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        
        {/* ── Search & Controls Row ── */}
        <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice or farmer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 pl-9 pr-8 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-xs shrink-0">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer text-xs">
                <option value="CURRENT_MONTH">This Month</option>
                <option value="LAST_MONTH">Last Month</option>
                <option value="ALL_TIME">All Time</option>
                <option value="CUSTOM">Custom Range</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-2 text-xs shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer text-xs">
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="AMOUNT_HIGH">Amount ↓</option>
                <option value="AMOUNT_LOW">Amount ↑</option>
                <option value="INVOICE_NO">Invoice #</option>
              </select>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-slate-400"><strong className="text-slate-600 dark:text-slate-300 font-mono">{filteredBills.length}</strong>/{userBills.length}</span>
              {(filterStatus !== "ALL" || paymentFilterStatus !== "ALL" || monthFilter !== "CURRENT_MONTH" || searchQuery) && (
                <button type="button" onClick={() => { setFilterStatus("ALL"); setPaymentFilterStatus("ALL"); setMonthFilter("CURRENT_MONTH"); setSearchQuery(""); setStartDate(""); setEndDate(""); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">Reset</button>
              )}
            </div>
          </div>
          {monthFilter === "CUSTOM" && (
            <div className="flex items-center gap-2 pl-1 animate-in fade-in duration-200">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300" />
              <span className="text-slate-400 text-[10px] font-bold">→</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300" />
            </div>
          )}
        </div>

        {/* ── Filter Pill Row ── */}
        <div className="flex flex-col sm:flex-row gap-3 px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mr-1 shrink-0">Status</span>
            {(["ALL", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const).map((st) => {
              const count = userBills.filter((b) => st === "ALL" || b.status === st).length;
              const isActive = filterStatus === st;
              const label = st === "ALL" ? "All" : st === "PENDING_APPROVAL" ? "Pending" : st === "APPROVED" ? "Approved" : "Rejected";
              return (
                <button key={st} type="button" onClick={() => setFilterStatus(st)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${isActive ? "bg-emerald-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
                  {label} <span className={`text-[9px] font-mono ${isActive ? "text-emerald-200" : "text-slate-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="hidden sm:block w-px bg-slate-200 dark:bg-slate-800 self-stretch" />
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mr-1 shrink-0">Payment</span>
            {(["ALL", "PAID", "PARTIAL_PAID", "UNPAID"] as const).map((pst) => {
              const count = userBills.filter((b) => pst === "ALL" || b.paymentStatus === pst).length;
              const isActive = paymentFilterStatus === pst;
              const label = pst === "ALL" ? "All" : pst === "PAID" ? "Paid" : pst === "PARTIAL_PAID" ? "Partial" : "Unpaid";
              return (
                <button key={pst} type="button" onClick={() => setPaymentFilterStatus(pst)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${isActive ? "bg-emerald-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
                  {label} <span className={`text-[9px] font-mono ${isActive ? "text-emerald-200" : "text-slate-400"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════ Bill List Content ═══════════ */}
        <div>
          {filteredBills.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Receipt className="h-5 w-5 text-slate-400" />
              </div>
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">No bills found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or create a new bill</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800/80 md:hidden">
                {filteredBills.map((bill) => {
                  const cust = customerMap.get(bill.customerId);
                  const isSelected = selectedIds.includes(bill.id);
                  return (
                    <div key={bill.id} className={`p-4 transition-colors ${isSelected ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelectBill(bill.id)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5" />
                          <div>
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{bill.invoiceNumber}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{bill.date}</span>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{cust?.name || "Unknown"}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{currencySymbol}{bill.grandTotal}</span>
                          {bill.status === "APPROVED" ? (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">Approved</span>
                          ) : bill.status === "PENDING_APPROVAL" ? (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">Pending</span>
                          ) : bill.status === "IN_PROGRESS" ? (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded">Live</span>
                          ) : (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">Rejected</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
                        <button type="button" onClick={() => handleOpenPaymentModal(bill)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer ${bill.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : bill.paymentStatus === "PARTIAL_PAID" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"}`}>
                          {bill.paymentStatus === "PAID" ? "✓ Paid" : bill.paymentStatus === "PARTIAL_PAID" ? "Partial" : "Unpaid"}
                        </button>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleViewInvoice(bill)} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer" title="View Invoice"><Receipt className="h-3.5 w-3.5" /></button>
                          {isAdmin && bill.status === "PENDING_APPROVAL" && (<><button type="button" onClick={() => handleApproveBill(bill.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer" title="Approve"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => handleRejectBill(bill.id)} className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer" title="Reject"><X className="h-3.5 w-3.5" /></button></>)}
                          {(bill.status === "PENDING_APPROVAL" || bill.status === "REJECTED" || isAdmin) && (<button type="button" onClick={() => handleOpenEditModal(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer" title="Edit"><Edit3 className="h-3.5 w-3.5" /></button>)}
                          {isAdmin && (<button type="button" onClick={() => handleDeleteBill(bill.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-900/60">
                      <TableHead className="w-10">
                        <input type="checkbox" checked={selectedIds.length === filteredBills.length && filteredBills.length > 0} onChange={() => toggleSelectAll(filteredBills)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                      </TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Invoice</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Farmer</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Operator</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Date</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Usage</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Amount</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Status</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Payment</TableHead>
                      <TableHead className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((bill) => {
                      const cust = customerMap.get(bill.customerId);
                      const isSelected = selectedIds.includes(bill.id);
                      return (
                        <TableRow key={bill.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors ${isSelected ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}>
                          <TableCell className="w-10"><input type="checkbox" checked={isSelected} onChange={() => toggleSelectBill(bill.id)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" /></TableCell>
                          <TableCell><span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{bill.invoiceNumber}</span></TableCell>
                          <TableCell>
                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{cust?.name || "Unknown"}</p>
                            <span className="text-[10px] text-slate-400">{cust?.mobile}</span>
                          </TableCell>
                          <TableCell><span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">{bill.createdBy || "Operator"}</span></TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            <div>{bill.date}</div>
                            {bill.startTime && <span className="text-[10px] text-slate-400">{bill.startTime} – {bill.endTime || "Live"}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">{bill.hoursUsed}h × {currencySymbol}{bill.hourlyRate}</TableCell>
                          <TableCell><span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">{currencySymbol}{bill.grandTotal}</span></TableCell>
                          <TableCell>
                            {bill.status === "APPROVED" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Approved</span>
                            ) : bill.status === "PENDING_APPROVAL" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Clock className="h-3 w-3" /> Pending</span>
                            ) : bill.status === "IN_PROGRESS" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Clock className="h-3 w-3 animate-spin" /> Live</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"><XCircle className="h-3 w-3" /> Rejected</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <button type="button" onClick={() => handleOpenPaymentModal(bill)} className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${bill.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400" : bill.paymentStatus === "PARTIAL_PAID" ? "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-400" : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-400"}`} title="Manage payment">
                              {bill.paymentStatus === "PAID" ? "✓ Paid" : bill.paymentStatus === "PARTIAL_PAID" ? "Partial" : "Unpaid"}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => handleViewInvoice(bill)} className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer" title="View Invoice"><Receipt className="h-3.5 w-3.5" /></button>
                              {isAdmin && bill.status === "PENDING_APPROVAL" && (<><button type="button" onClick={() => handleApproveBill(bill.id)} className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer" title="Approve"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => handleRejectBill(bill.id)} className="p-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 cursor-pointer" title="Reject"><X className="h-3.5 w-3.5" /></button></>)}
                              {(bill.status === "PENDING_APPROVAL" || bill.status === "REJECTED" || isAdmin) && (<button type="button" onClick={() => handleOpenEditModal(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md cursor-pointer" title="Edit"><Edit3 className="h-3.5 w-3.5" /></button>)}
                              {isAdmin && (<button type="button" onClick={() => handleDeleteBill(bill.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom duration-200 text-xs font-semibold max-w-[95vw]">
          <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-full font-bold">
            {selectedIds.length} Selected
          </span>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleBulkApprove}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" /> Approve
              </button>
              <button
                type="button"
                onClick={handleBulkReject}
                className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1 bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-slate-400 hover:text-white px-2 py-1 transition-colors cursor-pointer ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Partial Payment Modal */}
      <Dialog
        isOpen={paymentModalBill !== null}
        onClose={() => setPaymentModalBill(null)}
        title="Manage Payment & Partial Amount"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaymentModalBill(null)} className="cursor-pointer">Cancel</Button>
            <Button variant="primary" onClick={handleSavePaymentStatus} className="cursor-pointer">Save Payment Status</Button>
          </>
        }
      >
        {paymentModalBill && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex justify-between font-bold">
                <span>Invoice #{paymentModalBill.invoiceNumber}</span>
                <span className="text-emerald-600 font-mono text-sm">Total: {currencySymbol}{paymentModalBill.grandTotal}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Select Status Option</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPartialPaymentStatus("UNPAID")}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    partialPaymentStatus === "UNPAID"
                      ? "bg-amber-50 border-amber-400 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                  }`}
                >
                  Unpaid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPartialPaymentStatus("PARTIAL_PAID");
                    if (!partialPaidAmount && paymentModalBill) {
                      setPartialPaidAmount(String(Math.round(paymentModalBill.grandTotal / 2)));
                    }
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    partialPaymentStatus === "PARTIAL_PAID"
                      ? "bg-orange-50 border-orange-400 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                  }`}
                >
                  Partial Paid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPartialPaymentStatus("PAID");
                    if (paymentModalBill) {
                      setPartialPaidAmount(String(paymentModalBill.grandTotal));
                    }
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    partialPaymentStatus === "PAID"
                      ? "bg-emerald-50 border-emerald-400 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                      : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                  }`}
                >
                  Fully Paid
                </button>
              </div>
            </div>

            {partialPaymentStatus === "PARTIAL_PAID" && (
              <div className="space-y-3 pt-2 animate-in fade-in duration-200">
                <Input
                  label="Amount Received So Far (₹) *"
                  type="number"
                  min="0"
                  value={partialPaidAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/-/g, "");
                    setPartialPaidAmount(val);
                    const num = parseFloat(val) || 0;
                    if (paymentModalBill && num >= paymentModalBill.grandTotal && paymentModalBill.grandTotal > 0) {
                      setPartialPaymentStatus("PAID");
                    }
                  }}
                  placeholder="e.g. 3000"
                />
                {parseFloat(partialPaidAmount) >= 0 && (
                  <div className="flex justify-between items-center rounded-xl bg-orange-50 dark:bg-orange-950/30 p-3 border border-orange-200 dark:border-orange-800 text-xs font-semibold">
                    <span className="text-orange-900 dark:text-orange-300">Remaining Balance Due:</span>
                    <span className="font-mono text-orange-700 dark:text-orange-400 font-extrabold text-sm">
                      {currencySymbol}{Math.max(0, paymentModalBill.grandTotal - (parseFloat(partialPaidAmount) || 0)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Screen Invoice Dialog */}
      <Dialog
        isOpen={viewInvoice !== null}
        onClose={() => setViewInvoice(null)}
        title={`Tax Invoice ${viewInvoice?.invoiceNumber}`}
      >
        {viewInvoice && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">{settings.businessName}</h3>
                <p className="text-slate-500">{settings.businessAddress}</p>
                <p className="text-slate-500">Phone: {settings.phoneNumber}</p>
              </div>
              <div className="text-right">
                <span className="text-emerald-600 font-bold uppercase tracking-wider block text-[10px]">Tax Invoice</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{viewInvoice.invoiceNumber}</span>
                <p className="text-slate-500 mt-0.5">Date: {viewInvoice.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg">
              <div>
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Customer Details:</span>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{viewInvoice.customerName}</p>
                <p className="text-slate-600 dark:text-slate-400">Mobile: {viewInvoice.customerMobile}</p>
                {viewInvoice.customerLocation && (
                  <p className="text-slate-600 dark:text-slate-400">Location: {viewInvoice.customerLocation}</p>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-400 uppercase text-[9px] block">Billing Details:</span>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">Operator: <span className="font-semibold text-slate-800 dark:text-slate-200">{viewInvoice.createdBy || "Operator"}</span></p>
                <p className="text-slate-600 dark:text-slate-400">Hours: <span className="font-bold text-slate-900 dark:text-white">{viewInvoice.hoursUsed} hrs</span></p>
                <p className="text-slate-600 dark:text-slate-400">Rate: {currencySymbol}{viewInvoice.hourlyRate}/hr</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 dark:bg-slate-800">
                    <TableHead className="font-bold">Item</TableHead>
                    <TableHead className="font-bold text-right">Hours / Rate</TableHead>
                    <TableHead className="font-bold text-right">Amount ({currencySymbol})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">Machinery Usage Charge</TableCell>
                    <TableCell className="text-right">{viewInvoice.hoursUsed} hrs x {currencySymbol}{viewInvoice.hourlyRate}</TableCell>
                    <TableCell className="text-right font-bold">{(viewInvoice.hoursUsed * viewInvoice.hourlyRate).toLocaleString()}</TableCell>
                  </TableRow>
                  {viewInvoice.extraCharges && viewInvoice.extraCharges.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-slate-600">{c.name}</TableCell>
                      <TableCell className="text-right text-slate-400">Extra</TableCell>
                      <TableCell className="text-right font-medium">{c.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {viewInvoice.discount > 0 && (
                    <TableRow className="text-emerald-600 font-semibold">
                      <TableCell>Discount Applied</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-{viewInvoice.discount.toLocaleString()}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => handleOpenPaymentModal(viewInvoice)}
                className={`text-xs font-bold px-3 py-1 rounded-full border cursor-pointer ${
                  viewInvoice.paymentStatus === "PAID" 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800" 
                    : viewInvoice.paymentStatus === "PARTIAL_PAID"
                    ? "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                }`}
              >
                Payment: {viewInvoice.paymentStatus === "PAID"
                  ? "✓ Paid"
                  : viewInvoice.paymentStatus === "PARTIAL_PAID"
                  ? "Partial Paid"
                  : "Unpaid"}
              </button>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Grand Total</span>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {currencySymbol}{viewInvoice.grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setViewInvoice(null)} className="cursor-pointer">Close</Button>
              <Button variant="primary" onClick={handlePrint} className="cursor-pointer gap-2">
                <Printer className="h-4 w-4" /> Print Invoice
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default function BillsListPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    }>
      <BillsListInner />
    </Suspense>
  );
}
