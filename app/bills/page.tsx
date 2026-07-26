"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { billingService } from "../../services/billing.service";
import { customerService } from "../../services/customer.service";
import { settingsService } from "../../services/settings.service";
import { Bill, Customer, Settings, hasElevatedAccess } from "../../types";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { TimePicker } from "../../components/ui/TimePicker";
import { DateRange, DateRangePicker, makeDateRange } from "../../components/ui/DateRangePicker";
import { StatCard } from "../../components/ui/StatCard";
import { ListPageSkeleton } from "../../components/skeletons/PageSkeletons";
import { BillCreatorCell } from "../../components/bills/BillCreatorCell";
import { InvoicePrintArea, InvoicePreviewContent, invoiceViewButtonClass } from "../../components/bills/InvoiceDocument";
import { useOrgMemberLookup } from "../../hooks/useOrgMemberLookup";
import { downloadInvoicePdf } from "../../lib/invoice-pdf";
import { FILTER_SEARCH_CLASS, TABLE } from "../../lib/ui-classes";
import { resolveBillCustomer } from "../../lib/bill-customer";
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
  Printer,
  Receipt,
  Eye,
  IndianRupee,
  Plus,
  ArrowUpDown,
  RotateCcw
} from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";

function BillsListInner() {
  const { orgId, isLoaded: isClerkLoaded } = useClerkAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = hasElevatedAccess(user?.role);
  const memberLookup = useOrgMemberLookup();

  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Filter & Search
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<"ALL" | "PAID" | "PARTIAL_PAID" | "UNPAID">("ALL");
  const [dateRange, setDateRange] = useState<DateRange>(() => makeDateRange("month"));
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const fetchAllData = async () => {
    try {
      let billsData = await billingService.getAll(orgId || undefined);

      if (billsData.some((b) => !b.customerName)) {
        const result = await billingService.backfillCustomerSnapshots();
        if (result.updated > 0) {
          billsData = await billingService.getAll(orgId || undefined);
        }
      }

      const [customersData, settingsData] = await Promise.all([
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
    if (!isClerkLoaded) return;
    fetchAllData();
  }, [searchParams, toast, orgId, isClerkLoaded]);

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

  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;
    if (!isAdmin) {
      toast({ type: "error", title: "Access Denied", description: "Only Admins can bulk delete bills." });
      return;
    }
    setIsBulkDelete(true);
    setBillToDelete(null);
    setIsDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await billingService.bulkDelete(selectedIds);
      toast({ type: "success", title: "Bulk Deleted", description: `Deleted ${selectedIds.length} bills.` });
      setSelectedIds([]);
      setIsDeleteOpen(false);
      setIsBulkDelete(false);
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

  const handleDeleteClick = (id: string) => {
    if (!isAdmin) {
      toast({ type: "error", title: "Access Denied", description: "Only Administrators can delete bills." });
      return;
    }
    setBillToDelete(id);
    setIsBulkDelete(false);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (isBulkDelete) {
      await handleBulkDelete();
      return;
    }
    if (!billToDelete) return;
    try {
      await billingService.delete(billToDelete);
      toast({ type: "success", title: "Bill Deleted", description: "Bill removed from system." });
      setIsDeleteOpen(false);
      setBillToDelete(null);
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to delete bill." });
    }
  };

  const handleOpenEditModal = (bill: Bill) => {
    router.push(`/billing?editBillId=${bill.id}`);
  };

  const handleViewInvoice = (bill: Bill) => {
    const map = new Map(customers.map((c) => [c.id, c]));
    setViewInvoice({
      ...bill,
      ...resolveBillCustomer(bill, map, "Unknown Farmer"),
    });
  };

  const handlePrint = async () => {
    if (!viewInvoice) return;
    setIsExportingPdf(true);
    try {
      await downloadInvoicePdf(viewInvoice.invoiceNumber);
      toast({
        type: "success",
        title: "PDF Downloaded",
        description: `${viewInvoice.invoiceNumber}.pdf saved successfully.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "PDF Export Failed",
        description: err instanceof Error ? err.message : "Could not generate the invoice PDF. Please try again.",
      });
    } finally {
      setIsExportingPdf(false);
    }
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
    return <ListPageSkeleton />;
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

      // Date range filtering
      if (dateRange.preset !== "all") {
        const { startDate, endDate } = dateRange;
        if (startDate || endDate) {
          if (!b.date) return false;
          if (startDate && b.date < startDate) return false;
          if (endDate && b.date > endDate) return false;
        }
      }

      if (searchQuery) {
        const cName = resolveBillCustomer(b, customerMap, "Unknown Farmer").customerName;
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
      {viewInvoice && settings && (
        <InvoicePrintArea
          bill={viewInvoice}
          settings={settings}
          currencySymbol={currencySymbol}
        />
      )}

      {/* ═══════════ Page Header ═══════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isAdmin ? "Bills & Approvals" : "My Bills"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
        <StatCard label="Total Bills" value={userBills.length} icon={<Receipt className="h-3.5 w-3.5" />} color="emerald" mono={false} />
        <StatCard label="Total Value" value={`${currencySymbol}${totalValue.toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color="blue" />
        <StatCard label="Paid" value={paidBillsCount} icon={<CheckCircle2 className="h-3.5 w-3.5" />} color="violet" mono={false} />
        <StatCard label="Pending" value={pendingCount} icon={<Clock className="h-3.5 w-3.5" />} color="amber" mono={false} />
      </div>

      {/* ═══════════ Filter & List Card ═══════════ */}
      <Card className="shadow-sm overflow-visible">
        
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
                className={FILTER_SEARCH_CLASS}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="shrink-0 w-full sm:w-48">
              <DateRangePicker value={dateRange} onChange={setDateRange} hideLabel />
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
              {(filterStatus !== "ALL" || paymentFilterStatus !== "ALL" || dateRange.preset !== "month" || searchQuery) && (
                <button type="button" onClick={() => { setFilterStatus("ALL"); setPaymentFilterStatus("ALL"); setDateRange(makeDateRange("month")); setSearchQuery(""); }} className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer">
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>
          </div>
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
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 px-4">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No bills match these filters</p>
              <p className="text-xs mt-1">Try adjusting filters or create a new bill.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800/80 md:hidden">
                {filteredBills.map((bill) => {
                  const resolved = resolveBillCustomer(bill, customerMap, "Unknown Farmer");
                  const isSelected = selectedIds.includes(bill.id);
                  return (
                    <div key={bill.id} className={`p-4 transition-colors ${isSelected ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelectBill(bill.id)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-0.5" />
                          <div>
                            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{bill.invoiceNumber}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{bill.date}</span>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{resolved.customerName}</p>
                            <div className="mt-1.5">
                              <BillCreatorCell bill={bill} lookup={memberLookup} compact className="gap-1.5" />
                            </div>
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
                          <button type="button" onClick={() => handleViewInvoice(bill)} className={invoiceViewButtonClass} title="View Invoice Detail"><Eye className="h-4 w-4" /></button>
                          {isAdmin && bill.status === "PENDING_APPROVAL" && (<><button type="button" onClick={() => handleApproveBill(bill.id)} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer" title="Approve"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => handleRejectBill(bill.id)} className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer" title="Reject"><X className="h-3.5 w-3.5" /></button></>)}
                          {(bill.status === "PENDING_APPROVAL" || bill.status === "REJECTED" || isAdmin) && (<button type="button" onClick={() => handleOpenEditModal(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer" title="Edit"><Edit3 className="h-3.5 w-3.5" /></button>)}
                          {isAdmin && (<button type="button" onClick={() => handleDeleteClick(bill.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>)}
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
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox" checked={selectedIds.length === filteredBills.length && filteredBills.length > 0} onChange={() => toggleSelectAll(filteredBills)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                      </TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((bill) => {
                      const resolved = resolveBillCustomer(bill, customerMap, "Unknown Farmer");
                      const isSelected = selectedIds.includes(bill.id);
                      return (
                        <TableRow key={bill.id} className={isSelected ? "bg-emerald-50/30 dark:bg-emerald-950/10" : undefined}>
                          <TableCell className="w-10"><input type="checkbox" checked={isSelected} onChange={() => toggleSelectBill(bill.id)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" /></TableCell>
                          <TableCell className={TABLE.invoice}>{bill.invoiceNumber}</TableCell>
                          <TableCell>
                            <p className={`${TABLE.name} truncate max-w-35`}>{resolved.customerName}</p>
                            <span className="text-[10px] text-slate-400">{resolved.customerMobile}</span>
                          </TableCell>
                          <TableCell>
                            <BillCreatorCell bill={bill} lookup={memberLookup} compact />
                          </TableCell>
                          <TableCell className={TABLE.muted}>
                            <div>{bill.date}</div>
                            {bill.startTime && <span className="text-[10px] text-slate-400">{bill.startTime} – {bill.endTime || "Live"}</span>}
                          </TableCell>
                          <TableCell className={TABLE.muted}>{bill.hoursUsed}h × {currencySymbol}{bill.hourlyRate}</TableCell>
                          <TableCell className={TABLE.money}>{currencySymbol}{bill.grandTotal}</TableCell>
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
                              <button type="button" onClick={() => handleViewInvoice(bill)} className={invoiceViewButtonClass} title="View Invoice Detail"><Eye className="h-4 w-4" /></button>
                              {isAdmin && bill.status === "PENDING_APPROVAL" && (<><button type="button" onClick={() => handleApproveBill(bill.id)} className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 cursor-pointer" title="Approve"><Check className="h-3.5 w-3.5" /></button><button type="button" onClick={() => handleRejectBill(bill.id)} className="p-1 bg-rose-600 text-white rounded-md hover:bg-rose-700 cursor-pointer" title="Reject"><X className="h-3.5 w-3.5" /></button></>)}
                              {(bill.status === "PENDING_APPROVAL" || bill.status === "REJECTED" || isAdmin) && (<button type="button" onClick={() => handleOpenEditModal(bill)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md cursor-pointer" title="Edit"><Edit3 className="h-3.5 w-3.5" /></button>)}
                              {isAdmin && (<button type="button" onClick={() => handleDeleteClick(bill.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md cursor-pointer" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>)}
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
      </Card>

      {/* Floating Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between sm:justify-center gap-2 sm:gap-3 bg-slate-900/95 text-white p-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in slide-in-from-bottom duration-200 text-xs font-semibold w-[calc(100%-1.5rem)] sm:w-auto max-w-lg">
          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-emerald-600 text-white px-2.5 py-1 rounded-full font-bold text-[11px] sm:text-xs">
              {selectedIds.length} <span className="hidden min-[380px]:inline">Selected</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white px-1.5 py-1 transition-colors cursor-pointer text-[11px] sm:text-xs hover:underline"
            >
              Clear
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              <button
                type="button"
                onClick={handleBulkApprove}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer text-xs font-medium shadow-sm"
                title="Approve Selected"
              >
                <Check className="h-3.5 w-3.5" />
                <span className="hidden min-[400px]:inline">Approve</span>
              </button>
              <button
                type="button"
                onClick={handleBulkReject}
                className="flex items-center gap-1 bg-rose-600 hover:bg-rose-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer text-xs font-medium shadow-sm"
                title="Reject Selected"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden min-[400px]:inline">Reject</span>
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteClick}
                className="flex items-center gap-1 bg-red-700 hover:bg-red-600 text-white px-2.5 sm:px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer text-xs font-medium shadow-sm"
                title="Delete Selected"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden min-[400px]:inline">Delete</span>
              </button>
            </div>
          )}
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

      <Dialog
        isOpen={viewInvoice !== null}
        onClose={() => setViewInvoice(null)}
        title="Invoice Receipt Details"
        className="max-w-2xl text-left"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewInvoice(null)} className="cursor-pointer">
              Close
            </Button>
            <Button variant="success" onClick={handlePrint} isLoading={isExportingPdf} disabled={isExportingPdf} className="cursor-pointer gap-2">
              <Printer className="h-4 w-4" /> Download PDF (A4)
            </Button>
          </>
        }
      >
        {viewInvoice && settings && (
          <InvoicePreviewContent
            bill={viewInvoice}
            settings={settings}
            currencySymbol={currencySymbol}
          />
        )}
      </Dialog>

      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setBillToDelete(null);
          setIsBulkDelete(false);
        }}
        title="Confirm Deletion"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setBillToDelete(null);
                setIsBulkDelete(false);
              }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="cursor-pointer">
              {isBulkDelete ? `Delete ${selectedIds.length} Bills` : "Delete Bill"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isBulkDelete ? (
              <>
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{selectedIds.length} bills</span>?
              </>
            ) : (
              <>
                Are you sure you want to delete invoice{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {bills.find((b) => b.id === billToDelete)?.invoiceNumber || "this bill"}
                </span>
                ?
              </>
            )}
          </p>
          <div className="rounded-lg bg-red-50 p-3.5 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300">
            <strong>Warning:</strong> This action cannot be undone. Deleted bills will be removed from billing records permanently.
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function BillsListPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <BillsListInner />
    </Suspense>
  );
}
