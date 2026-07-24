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
  Plus
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
  const [searchQuery, setSearchQuery] = useState("");

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

  // Approval Handlers
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

  const handleTogglePaymentStatus = async (id: string, currentStatus: "PAID" | "UNPAID") => {
    const nextStatus = currentStatus === "PAID" ? "UNPAID" : "PAID";
    try {
      await billingService.updatePaymentStatus(id, nextStatus);
      toast({
        type: "success",
        title: `Marked as ${nextStatus === "PAID" ? "Paid" : "Not Paid"}`,
        description: `Payment status updated to ${nextStatus}.`
      });
      fetchAllData();
      if (viewInvoice && viewInvoice.id === id) {
        setViewInvoice({ ...viewInvoice, paymentStatus: nextStatus });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to update payment status." });
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

  const handleSaveEditedBill = async () => {
    if (!editingBill) return;
    const hoursNum = parseFloat(editHours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      toast({ type: "error", title: "Validation Error", description: "Hours used must be greater than zero." });
      return;
    }

    const discountVal = parseFloat(editDiscount) || 0;
    const extraTotal = editingBill.extraCharges.reduce((s, c) => s + c.amount, 0);
    const usageCost = hoursNum * editingBill.hourlyRate;
    const grandTotal = usageCost + extraTotal - discountVal;

    try {
      await billingService.update(editingBill.id, {
        hoursUsed: hoursNum,
        startTime: editStartTime || undefined,
        endTime: editEndTime || undefined,
        discount: discountVal,
        grandTotal,
        status: "PENDING_APPROVAL" // Always send for reapproval when edited
      });

      toast({
        type: "success",
        title: "Bill Updated",
        description: "Bill updated and sent for Admin reapproval."
      });

      setEditingBill(null);
      fetchAllData();
    } catch (err: any) {
      toast({ type: "error", title: "Update Failed", description: err.message || "Could not update bill." });
    }
  };

  const handleViewInvoice = (bill: Bill) => {
    const cust = customers.find(c => c.id === bill.customerId);
    setViewInvoice({
      ...bill,
      customerName: cust?.name || "Unknown Farmer",
      customerMobile: cust?.mobile || "",
      customerLocation: cust?.location || "",
      customerState: cust?.state || ""
    });
  };

  const handlePrint = () => {
    window.print();
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

  // Filter bills by search & status tab
  const filteredBills = userBills.filter((b) => {
    if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
    if (searchQuery) {
      const cName = customerMap.get(b.customerId)?.name || "";
      return (
        b.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
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

      {/* Screen Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isAdmin ? "Bills List & Approvals Queue" : "My Generated Bills"}
            </h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2.5 py-0.5 text-xs font-bold border border-purple-200 dark:border-purple-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin 
              ? "Comprehensive record of all billing invoices. Review, approve, or reject."
              : "List of all machinery rental bills generated by you. View details and track status."
            }
          </p>
        </div>

        <Link href="/billing" passHref>
          <Button variant="primary" className="cursor-pointer gap-2">
            <Plus className="h-4 w-4" />
            Generate New Bill
          </Button>
        </Link>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Bills</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{userBills.length}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Value</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{currencySymbol}{totalValue.toLocaleString()}</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Paid / Pending Approval</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{paidBillsCount} Paid / {pendingCount} Pending</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Approval Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by invoice # or farmer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 text-xs">
              {(["ALL", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const).map((st) => {
                const count = userBills.filter((b) => st === "ALL" || b.status === st).length;
                const isActive = filterStatus === st;
                let label = st === "ALL" ? "All" : st === "PENDING_APPROVAL" ? "Pending" : st === "APPROVED" ? "Approved" : "Rejected";
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      st === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" :
                      st === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300" :
                      st === "REJECTED" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300" :
                      "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBills.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <Clock className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="font-semibold text-sm">No bills found in this section.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Farmer</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Usage / Rate</TableHead>
                      <TableHead>Grand Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((bill) => {
                      const cust = customerMap.get(bill.customerId);
                      return (
                        <TableRow key={bill.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                            {bill.invoiceNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{cust?.name || "Unknown Customer"}</p>
                              <span className="text-[10px] text-slate-400">{cust?.mobile}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                              {bill.createdBy || "Operator"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            <div>{bill.date}</div>
                            {bill.startTime && (
                              <span className="text-[10px] text-slate-500">{bill.startTime} - {bill.endTime || "Live"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {bill.hoursUsed} hrs × {currencySymbol}{bill.hourlyRate}
                          </TableCell>
                          <TableCell className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {currencySymbol}{bill.grandTotal}
                          </TableCell>
                          <TableCell>
                            {bill.status === "APPROVED" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                              </span>
                            ) : bill.status === "PENDING_APPROVAL" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            ) : bill.status === "IN_PROGRESS" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                                <Clock className="h-3 w-3 animate-spin text-blue-500" /> Live
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                                <XCircle className="h-3 w-3" /> Rejected
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleTogglePaymentStatus(bill.id, bill.paymentStatus || "UNPAID")}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                                bill.paymentStatus === "PAID"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100"
                              }`}
                              title="Click to toggle payment status (Both User & Admin)"
                            >
                              {bill.paymentStatus === "PAID" ? "✓ Paid" : "Unpaid"}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Print Invoice Button */}
                              <button
                                type="button"
                                onClick={() => handleViewInvoice(bill)}
                                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                title="View & Print Invoice"
                              >
                                <Receipt className="h-4 w-4" />
                              </button>

                              {/* Admin Approve & Reject Buttons */}
                              {isAdmin && bill.status === "PENDING_APPROVAL" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveBill(bill.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                    title="Approve Bill"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectBill(bill.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
                                    title="Reject Bill"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}

                              {/* User/Admin Edit & Resubmit */}
                              {(bill.status === "PENDING_APPROVAL" || bill.status === "REJECTED" || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(bill)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                  title={isAdmin ? "Edit Bill Details" : "Edit & Resubmit for Reapproval"}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              )}

                              {/* Admin Only Delete Button */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBill(bill.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                  title="Delete Bill (Admin Only)"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                onClick={() => handleTogglePaymentStatus(viewInvoice.id, viewInvoice.paymentStatus)}
                className={`text-xs font-bold px-3 py-1 rounded-full border cursor-pointer ${
                  viewInvoice.paymentStatus === "PAID" 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300" 
                    : "bg-red-50 text-red-700 border-red-300"
                }`}
              >
                Payment: {viewInvoice.paymentStatus === "PAID" ? "✓ Paid" : "Unpaid (Click to toggle)"}
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
