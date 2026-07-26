"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { billingService } from "../../services/billing.service";
import { customerService } from "../../services/customer.service";
import { settingsService } from "../../services/settings.service";
import { Bill, Settings, canAccessReports, hasElevatedAccess } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { FILTER_SEARCH_CLASS, TABLE } from "../../lib/ui-classes";
import { resolveBillCustomer } from "../../lib/bill-customer";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import {
  DateRange,
  DateRangePicker,
  makeDateRange,
} from "../../components/ui/DateRangePicker";
import {
  Search,
  Eye,
  Printer,
  FileSpreadsheet,
  IndianRupee,
  Clock,
  X,
  BarChart3,
  MapPin,
  RotateCcw,
} from "lucide-react";

import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";
import { ListPageSkeleton } from "../../components/skeletons/PageSkeletons";
import { BillCreatorCell } from "../../components/bills/BillCreatorCell";
import { InvoicePrintArea, InvoicePreviewContent, invoiceViewButtonClass } from "../../components/bills/InvoiceDocument";
import { useOrgMemberLookup } from "../../hooks/useOrgMemberLookup";
import { resolveBillCreator } from "../../lib/clerk-user";
import { downloadInvoicePdf } from "../../lib/invoice-pdf";

type EnrichedBill = Bill & {
  customerName?: string;
  customerMobile?: string;
  customerLocation?: string;
  customerState?: string;
};

function initDefaultDateRange(): DateRange {
  return makeDateRange("month");
}

function PaymentStatusLabel({ status }: { status?: string }) {
  const label =
    status === "PAID" ? "✓ Paid" : status === "PARTIAL_PAID" ? "Partial" : "Unpaid";
  const colorClass =
    status === "PAID"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
      : status === "PARTIAL_PAID"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none select-none cursor-default ${colorClass}`}
    >
      {label}
    </span>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const { orgId, isLoaded: isClerkLoaded } = useClerkAuth();
  const { user } = useAuth();
  const canViewReports = canAccessReports(user?.role);
  const elevated = hasElevatedAccess(user?.role);
  const { toast } = useToast();
  const memberLookup = useOrgMemberLookup();

  useEffect(() => {
    if (user && !canViewReports) {
      toast({ type: "error", title: "Access Denied", description: "Reports page is restricted to Admin and Business Operations Lead users." });
      router.replace("/billing");
    }
  }, [user, canViewReports, router, toast]);
  const [bills, setBills] = useState<EnrichedBill[]>([]);
  const [filteredBills, setFilteredBills] = useState<EnrichedBill[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>(() => initDefaultDateRange());
  const [paymentFilter, setPaymentFilter] = useState<"all" | "PAID" | "UNPAID">("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [locations, setLocations] = useState<string[]>([]);

  const [selectedBill, setSelectedBill] = useState<EnrichedBill | null>(null);

  const hasActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== "" ||
      dateRange.preset !== "month" ||
      paymentFilter !== "all" ||
      selectedLocation !== "all" ||
      minAmount !== ""
    );
  }, [searchQuery, dateRange.preset, paymentFilter, selectedLocation, minAmount]);

  const resetFilters = () => {
    setSearchQuery("");
    setDateRange(initDefaultDateRange());
    setPaymentFilter("all");
    setSelectedLocation("all");
    setMinAmount("");
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const rawBills = await billingService.getAll(orgId || undefined);
      const allBills = rawBills.filter(
        (b) => isBillCreatedByUser(b, user, elevated) && b.status === "APPROVED" && b.paymentStatus === "PAID"
      );
      const allCustomers = await customerService.getAll(orgId || undefined);
      const loadedSettings = await settingsService.get(orgId || undefined);
      setSettings(loadedSettings);

      const customerMap = new Map(allCustomers.map((c) => [c.id, c]));

      const enrichedBills = allBills.map((b) => ({
        ...b,
        ...resolveBillCustomer(b, customerMap, "Deleted Customer"),
      }));

      setBills(enrichedBills);
      setFilteredBills(enrichedBills);

      const uniqueLocations = Array.from(
        new Set(
          allCustomers
            .map((c) => c.location)
            .filter((v): v is string => typeof v === "string" && v !== "")
        )
      );
      setLocations(uniqueLocations);
    } catch {
      toast({
        type: "error",
        title: "Load Error",
        description: "Failed to load reports and billing records.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isClerkLoaded) return;
    loadData();
  }, [orgId, isClerkLoaded]);

  useEffect(() => {
    let result = [...bills];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.invoiceNumber.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerLocation?.toLowerCase().includes(q) ||
          b.customerState?.toLowerCase().includes(q) ||
          b.customerMobile?.toLowerCase().includes(q)
      );
    }

    if (dateRange.preset !== "all") {
      const { startDate, endDate } = dateRange;
      if (startDate || endDate) {
        result = result.filter((b) => {
          const billDate = b.date || "";
          if (!billDate) return false;
          if (startDate && billDate < startDate) return false;
          if (endDate && billDate > endDate) return false;
          return true;
        });
      }
    }

    if (selectedLocation !== "all") {
      result = result.filter((b) => b.customerLocation === selectedLocation);
    }

    if (paymentFilter !== "all") {
      result = result.filter((b) => (b.paymentStatus || "UNPAID") === paymentFilter);
    }

    if (minAmount) {
      const amt = parseFloat(minAmount);
      if (!isNaN(amt)) {
        result = result.filter((b) => b.grandTotal >= amt);
      }
    }

    setFilteredBills(result);
  }, [searchQuery, dateRange, selectedLocation, paymentFilter, minAmount, bills]);

  const handleExportExcel = () => {
    if (filteredBills.length === 0) {
      toast({
        type: "error",
        title: "Nothing to Export",
        description: "No invoices match the current filters.",
      });
      return;
    }

    setIsExporting(true);
    try {
      const rows = filteredBills.map((b) => ({
        "Invoice No": b.invoiceNumber,
        Date: b.date,
        Farmer: b.customerName || "",
        Mobile: b.customerMobile || "",
        Location: b.customerLocation || "",
        State: b.customerState || "",
        "Created By": resolveBillCreator(b, memberLookup).name,
        "Hours Used": b.hoursUsed,
        "Hourly Rate": b.hourlyRate,
        "Extra Charges": b.extraCharges.reduce((s, c) => s + c.amount, 0),
        Discount: b.discount || 0,
        "Grand Total": b.grandTotal,
        Payment: b.paymentStatus === "PAID" ? "Paid" : "Not Paid",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Billing Reports");

      const colWidths = Object.keys(rows[0]).map((key) => ({
        wch: Math.max(
          key.length,
          ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length)
        ) + 2,
      }));
      worksheet["!cols"] = colWidths;

      const stamp = new Date().toISOString().slice(0, 10);
      const fileName = `billing-reports-${stamp}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        type: "success",
        title: "Export Ready",
        description: `Downloaded ${filteredBills.length} invoice${filteredBills.length === 1 ? "" : "s"} as ${fileName}.`,
      });
    } catch {
      toast({
        type: "error",
        title: "Export Failed",
        description: "Could not generate the Excel file. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const triggerPrint = async () => {
    if (!selectedBill) return;
    setIsExportingPdf(true);
    try {
      await downloadInvoicePdf(selectedBill.invoiceNumber);
      toast({
        type: "success",
        title: "PDF Downloaded",
        description: `${selectedBill.invoiceNumber}.pdf saved successfully.`,
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

  const totalInvoiced = filteredBills.reduce((acc, b) => acc + b.grandTotal, 0);
  const paidRevenue = filteredBills.filter((b) => b.paymentStatus === "PAID").reduce((acc, b) => acc + b.grandTotal, 0);
  const unpaidRevenue = filteredBills.filter((b) => b.paymentStatus !== "PAID").reduce((acc, b) => acc + b.grandTotal, 0);
  const totalHours = filteredBills.reduce((acc, b) => acc + b.hoursUsed, 0);
  const currencySymbol = settings?.currencySymbol || "₹";

  if (!canViewReports || !isClerkLoaded || (isLoading && !settings)) {
    return <ListPageSkeleton withBadge statGridClassName="grid grid-cols-2 lg:grid-cols-4 gap-3" />;
  }

  return (
    <div className="space-y-6">
      {selectedBill && settings && (
        <InvoicePrintArea
          bill={selectedBill}
          settings={settings}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60 dark:border-emerald-800/50">
            <BarChart3 className="h-3 w-3" />
            Analytics
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Billing Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View and filter paid invoices by date, location, and amount — then export or print.
          </p>
        </div>
        <Button
          onClick={handleExportExcel}
          variant="primary"
          isLoading={isExporting}
          disabled={filteredBills.length === 0 || isExporting}
          className="w-full sm:w-auto gap-1.5 shadow-md shadow-emerald-600/20"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Excel ({filteredBills.length})
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Invoiced" value={`${currencySymbol}${totalInvoiced.toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color="emerald" />
        <StatCard label="Collected" value={`${currencySymbol}${paidRevenue.toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color="teal" />
        <StatCard label="Outstanding" value={`${currencySymbol}${unpaidRevenue.toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color="amber" />
        <StatCard label="Total Usage" value={`${totalHours.toLocaleString()} hrs`} icon={<Clock className="h-3.5 w-3.5" />} color="sky" />
      </div>

      {/* Filters + Results */}
      <Card className="shadow-sm overflow-visible">
        <div className="p-4 space-y-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-950">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice, farmer, location, mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={FILTER_SEARCH_CLASS}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-slate-400">
                <strong className="text-slate-700 dark:text-slate-200 font-mono">{filteredBills.length}</strong>
                <span className="mx-0.5">/</span>
                {bills.length} invoices
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Payment
              </label>
              <div className="flex h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1 gap-1">
                {([
                  { id: "all", label: "All" },
                  { id: "PAID", label: "Paid" },
                  { id: "UNPAID", label: "Unpaid" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentFilter(opt.id)}
                    className={`flex-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      paymentFilter === opt.id
                        ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Locations</option>
                  {locations.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Min Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">{currencySymbol}</span>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          {filteredBills.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 px-4">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No invoices match these filters</p>
              <p className="text-xs mt-1 text-slate-500">Try widening the date range or clearing filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 gap-3 p-3 md:hidden">
                {filteredBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2">
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                          {bill.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-slate-500">{bill.date}</span>
                      </div>
                      <PaymentStatusLabel status={bill.paymentStatus} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Farmer</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{bill.customerName}</p>
                        <p className="text-[10px] text-slate-500">{bill.customerLocation || "Direct"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Created By</span>
                        <BillCreatorCell bill={bill} lookup={memberLookup} compact />
                        <p className="text-[10px] text-slate-500">{bill.hoursUsed} hrs used</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {currencySymbol}
                        {bill.grandTotal}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className={invoiceViewButtonClass}
                          title="View Invoice Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-hidden">
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
                        <TableHead className="text-center w-16">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBills.map((bill) => (
                        <TableRow key={bill.id}>
                          <TableCell className={TABLE.invoice}>{bill.invoiceNumber}</TableCell>
                          <TableCell className={TABLE.name}>
                            {bill.customerName}
                          </TableCell>
                          <TableCell>
                            <BillCreatorCell bill={bill} lookup={memberLookup} compact />
                          </TableCell>
                          <TableCell>
                            {bill.customerLocation || bill.customerState ? (
                              <span className={`inline-flex items-center gap-1 ${TABLE.secondary}`}>
                                {bill.customerLocation || ""}
                                {bill.customerLocation && bill.customerState ? ", " : ""}
                                {bill.customerState || ""}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Direct</span>
                            )}
                          </TableCell>
                          <TableCell className={TABLE.muted}>{bill.date}</TableCell>
                          <TableCell className={`hidden md:table-cell ${TABLE.muted}`}>{bill.hoursUsed} hrs</TableCell>
                          <TableCell className={TABLE.money}>
                            {currencySymbol}
                            {bill.grandTotal}
                          </TableCell>
                          <TableCell>
                            <PaymentStatusLabel status={bill.paymentStatus} />
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => setSelectedBill(bill)}
                              className={invoiceViewButtonClass}
                              title="View Invoice Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
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

      <Dialog
        isOpen={selectedBill !== null}
        onClose={() => setSelectedBill(null)}
        title={`Invoice Receipt Details`}
        className="max-w-2xl text-left"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelectedBill(null)} className="cursor-pointer">
              Close
            </Button>
            <Button variant="success" onClick={triggerPrint} isLoading={isExportingPdf} disabled={isExportingPdf} className="cursor-pointer">
              <Printer className="h-4 w-4" />
              Download PDF (A4)
            </Button>
          </>
        }
      >
        {selectedBill && settings && (
          <InvoicePreviewContent
            bill={selectedBill}
            settings={settings}
            currencySymbol={currencySymbol}
          />
        )}
      </Dialog>
    </div>
  );
}
