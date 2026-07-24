"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customerService } from "../../services/customer.service";
import { billingService } from "../../services/billing.service";
import { settingsService } from "../../services/settings.service";
import { Customer, Bill, AdditionalCharge, Settings } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { TimePicker } from "../../components/ui/TimePicker";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { 
  Plus, 
  Search, 
  Trash2, 
  UserPlus, 
  Receipt, 
  IndianRupee, 
  Clock, 
  Sparkles,
  Printer, 
  Download,
  AlertTriangle,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit3,
  Filter,
  Check,
  X,
  ShieldCheck,
  Send
} from "lucide-react";

// Schema for quick customer dialog
const quickCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string()
    .min(10, "Mobile number must be at least 10 digits")
    .regex(/^[0-9+\s-()]+$/, "Invalid phone number"),
  location: z.string().optional(),
  state: z.string().optional()
});

type QuickCustomerForm = z.infer<typeof quickCustomerSchema>;

// Inner component that uses searchParams
function BillingFormInner() {
  const { orgId } = useClerkAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // App Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  
  // Billing States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [hoursUsed, setHoursUsed] = useState<string>("0");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  
  // Charge Input States
  const [chargeName, setChargeName] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");

  // Approval Table States
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [billSearchQuery, setBillSearchQuery] = useState("");

  // Edit Bill Modal State
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Edit Bill mode states
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingInvoiceNum, setEditingInvoiceNum] = useState<string>("");

  // UI States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Generated invoice preview state
  const [generatedInvoice, setGeneratedInvoice] = useState<(Bill & { customerName?: string; customerMobile?: string; customerLocation?: string; customerState?: string }) | null>(null);

  // Quick Add Form
  const {
    register: registerQuickCust,
    handleSubmit: handleQuickCustSubmit,
    reset: resetQuickCust,
    formState: { errors: quickCustErrors }
  } = useForm<QuickCustomerForm>({
    resolver: zodResolver(quickCustomerSchema)
  });

  const fetchBills = async () => {
    try {
      const data = await billingService.getAll(orgId || undefined);
      setBills(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch settings, customers & check editBillId prefill
  useEffect(() => {
    async function loadData() {
      try {
        const settingsData = await settingsService.get(orgId || undefined);
        const customerData = await customerService.getAll(orgId || undefined);
        const billsData = await billingService.getAll(orgId || undefined);
        setSettings(settingsData);
        setCustomers(customerData);
        setBills(billsData);
        
        // Check if editing a bill via query param /billing?editBillId=bill-123
        const editBillId = searchParams.get("editBillId");
        if (editBillId) {
          const foundBill = billsData.find((b) => b.id === editBillId);
          if (foundBill) {
            setEditingBillId(foundBill.id);
            setEditingInvoiceNum(foundBill.invoiceNumber);
            setSelectedCustomerId(foundBill.customerId);
            const foundCust = customerData.find((c) => c.id === foundBill.customerId);
            if (foundCust) {
              setCustomerSearchQuery(foundCust.name);
            }
            setStartTime(foundBill.startTime || "");
            setEndTime(foundBill.endTime || "");
            setHoursUsed(foundBill.hoursUsed.toString());
            setDiscount(foundBill.discount.toString());
            setAdditionalCharges(foundBill.extraCharges || []);
          }
        } else {
          // Auto-select customer if provided in query search params (e.g. from Dashboard)
          const queryCustId = searchParams.get("customerId");
          if (queryCustId) {
            const found = customerData.find((c) => c.id === queryCustId);
            if (found) {
              setSelectedCustomerId(found.id);
              setCustomerSearchQuery(found.name);
            }
          }
        }
      } catch (err) {
        toast({
          type: "error",
          title: "Setup Error",
          description: "Could not initialize billing resources."
        });
      } finally {
        setIsLoaded(true);
      }
    }
    loadData();
  }, [searchParams, toast, orgId]);

  // Approval Actions
  const handleApproveBill = async (id: string) => {
    try {
      await billingService.approve(id);
      toast({ type: "success", title: "Bill Approved", description: "Bill has been approved." });
      fetchBills();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to approve bill." });
    }
  };

  const handleRejectBill = async (id: string) => {
    try {
      await billingService.reject(id);
      toast({ type: "info", title: "Bill Rejected", description: "Bill has been marked as rejected." });
      fetchBills();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to reject bill." });
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!isAdmin) {
      toast({ type: "error", title: "Access Denied", description: "Only Administrators can delete bills." });
      return;
    }
    if (!confirm("Are you sure you want to delete this bill? This cannot be undone.")) return;
    try {
      await billingService.delete(id);
      toast({ type: "success", title: "Bill Deleted", description: "Bill removed successfully." });
      fetchBills();
    } catch (err: any) {
      toast({ type: "error", title: "Error", description: err.message || "Failed to delete bill." });
    }
  };

  const handleOpenEditModal = (bill: Bill) => {
    setEditingBill(bill);
    setEditHours(bill.hoursUsed.toString());
    setEditDiscount(bill.discount.toString());
    setEditStartTime(bill.startTime || "");
    setEditEndTime(bill.endTime || "");
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
      fetchBills();
    } catch (err: any) {
      toast({ type: "error", title: "Update Failed", description: err.message || "Could not update bill." });
    }
  };

  // Handle outside click to close customer search dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".customer-select-container")) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filtered customers for searching
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.mobile.includes(customerSearchQuery)
  );

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerSearchQuery(customer.name);
    setIsDropdownOpen(false);
  };

  // Helper to add/subtract hours to a 24-hr time string "HH:mm"
  const computeTimeWithOffset = (baseTime: string, hoursOffset: number): string => {
    if (!baseTime) return "";
    const [hStr, mStr] = baseTime.split(":");
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return "";

    let totalMins = Math.round(h * 60 + m + hoursOffset * 60);
    totalMins = (totalMins % (24 * 60) + 24 * 60) % (24 * 60);

    const newH = Math.floor(totalMins / 60);
    const newM = totalMins % 60;
    return `${newH < 10 ? `0${newH}` : `${newH}`}:${newM < 10 ? `0${newM}` : `${newM}`}`;
  };

  // Bidirectional Synchronization Handlers
  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (val && endTime) {
      autoCalculateHours(val, endTime);
    } else if (val && parseFloat(hoursUsed) > 0) {
      const computedEnd = computeTimeWithOffset(val, parseFloat(hoursUsed));
      setEndTime(computedEnd);
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (startTime && val) {
      autoCalculateHours(startTime, val);
    } else if (val && parseFloat(hoursUsed) > 0) {
      const computedStart = computeTimeWithOffset(val, -parseFloat(hoursUsed));
      setStartTime(computedStart);
    }
  };

  const handleHoursUsedChange = (val: string) => {
    setHoursUsed(val);
    const numHours = parseFloat(val);
    if (!isNaN(numHours) && numHours > 0) {
      if (startTime) {
        setEndTime(computeTimeWithOffset(startTime, numHours));
      } else if (endTime) {
        setStartTime(computeTimeWithOffset(endTime, numHours));
      }
    }
  };

  const autoCalculateHours = (start: string, end: string) => {
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return;

    let startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;

    let diffMins = endMins - startMins;
    if (diffMins < 0) {
      diffMins += 24 * 60; // Overnight operation
    }

    const calculatedHours = Number((diffMins / 60).toFixed(2));
    setHoursUsed(calculatedHours.toString());
  };

  // Add Inline Charge
  const handleAddCharge = () => {
    if (!chargeName.trim()) {
      toast({ type: "error", title: "Validation Error", description: "Charge name cannot be empty." });
      return;
    }
    const amount = parseFloat(chargeAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ type: "error", title: "Validation Error", description: "Charge amount must be positive." });
      return;
    }

    const newCharge: AdditionalCharge = {
      id: `chg-${Date.now()}`,
      name: chargeName.trim(),
      amount
    };

    setAdditionalCharges([...additionalCharges, newCharge]);
    setChargeName("");
    setChargeAmount("");
  };

  // Delete Inline Charge
  const handleDeleteCharge = (id: string) => {
    setAdditionalCharges(additionalCharges.filter((c) => c.id !== id));
  };

  // Live Calculations
  const hourlyRate = settings?.hourlyRate || 1200;
  const hoursNum = parseFloat(hoursUsed) || 0;
  const usageCost = hoursNum * hourlyRate;
  const extraChargesCost = additionalCharges.reduce((acc, c) => acc + c.amount, 0);
  const discountVal = parseFloat(discount) || 0;
  const grandTotal = usageCost + extraChargesCost - discountVal;

  // Quick Add Customer Dialog Submit
  const onQuickAddSubmit = async (values: QuickCustomerForm) => {
    try {
      const newCust = await customerService.create(values, orgId || undefined);
      setCustomers([...customers, newCust]);
      setSelectedCustomerId(newCust.id);
      setCustomerSearchQuery(newCust.name);
      setIsQuickAddOpen(false);
      resetQuickCust();
      toast({
        type: "success",
        title: "Customer Added",
        description: `Selected ${newCust.name} for current billing.`
      });
    } catch (err: any) {
      toast({
        type: "error",
        title: "Quick Add Failed",
        description: err.message || "Failed to add customer."
      });
    }
  };

  // Save Check-In (Start session with start time only)
  const handleSaveCheckIn = async () => {
    if (!selectedCustomerId) {
      toast({ type: "error", title: "Validation Error", description: "Please select a customer first." });
      return;
    }
    if (!startTime) {
      toast({ type: "error", title: "Validation Error", description: "Please select a Start Time to check in." });
      return;
    }

    setIsGenerating(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const newBill = await billingService.create({
        customerId: selectedCustomerId,
        date: new Date().toISOString().split("T")[0],
        startTime,
        endTime: undefined,
        hoursUsed: 0,
        hourlyRate,
        extraCharges: [],
        discount: 0,
        grandTotal: 0,
        status: "IN_PROGRESS",
        paymentStatus: "UNPAID",
        createdBy: user?.fullName || user?.primaryEmailAddress || "Operator",
        createdByEmail: user?.primaryEmailAddress || ""
      }, orgId || undefined);

      toast({
        type: "success",
        title: "Session Started (Checked-In)",
        description: `Check-in recorded for ${selectedCustomer?.name || 'Farmer'} at ${startTime}.`
      });

      fetchBills();

      // Clear input fields
      setSelectedCustomerId("");
      setCustomerSearchQuery("");
      setStartTime("");
      setEndTime("");
      setHoursUsed("0");
      setDiscount("0");
      setAdditionalCharges([]);
      setPaymentStatus("UNPAID");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Check-In Failed",
        description: err.message || "Could not save check-in session."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Start checkout for an active IN_PROGRESS session
  const handleStartCheckOut = (bill: Bill) => {
    const cust = customers.find(c => c.id === bill.customerId);
    setSelectedCustomerId(bill.customerId);
    setCustomerSearchQuery(cust?.name || "");
    setStartTime(bill.startTime || "");
    
    // Auto populate current time as default end time
    const now = new Date();
    const currentH = now.getHours().toString().padStart(2, "0");
    const currentM = now.getMinutes().toString().padStart(2, "0");
    const nowStr = `${currentH}:${currentM}`;
    setEndTime(nowStr);

    if (bill.startTime) {
      autoCalculateHours(bill.startTime, nowStr);
    }

    setEditingBillId(bill.id);
    setEditingInvoiceNum(bill.invoiceNumber);

    toast({
      type: "info",
      title: "Completing Check-Out",
      description: `Ending session for ${cust?.name || 'Farmer'}. Confirm end time and generate bill.`
    });
  };

  // Toggle Payment Status for any bill (Paid <-> Unpaid)
  const handleTogglePaymentStatus = async (id: string, current: "PAID" | "UNPAID") => {
    const nextStatus = current === "PAID" ? "UNPAID" : "PAID";
    try {
      await billingService.updatePaymentStatus(id, nextStatus);
      toast({
        type: "success",
        title: `Marked as ${nextStatus === "PAID" ? "Paid" : "Not Paid"}`,
        description: `Payment status updated to ${nextStatus}.`
      });
      fetchBills();
      if (generatedInvoice && generatedInvoice.id === id) {
        setGeneratedInvoice({ ...generatedInvoice, paymentStatus: nextStatus });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Update Failed", description: err.message || "Failed to update payment status." });
    }
  };

  // Generate Bill (Submit invoice details)
  const handleGenerateBill = async () => {
    if (!selectedCustomerId) {
      toast({ type: "error", title: "Validation Error", description: "Please select a customer." });
      return;
    }

    if (hoursNum <= 0 || isNaN(hoursNum)) {
      toast({ type: "error", title: "Validation Error", description: "Hours used must be greater than zero." });
      return;
    }

    if (discountVal < 0 || discountVal > (usageCost + extraChargesCost)) {
      toast({ type: "error", title: "Validation Error", description: "Discount cannot exceed the total bill amount." });
      return;
    }

    setIsGenerating(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const initialStatus = isAdmin ? "APPROVED" : "PENDING_APPROVAL";
      
      if (editingBillId) {
        // Update existing bill mode or complete in-progress bill
        const updatedBill = await billingService.update(editingBillId, {
          customerId: selectedCustomerId,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          hoursUsed: hoursNum,
          hourlyRate,
          extraCharges: additionalCharges,
          discount: discountVal,
          grandTotal,
          status: initialStatus,
          paymentStatus
        });

        setGeneratedInvoice({
          ...updatedBill,
          customerName: selectedCustomer?.name,
          customerMobile: selectedCustomer?.mobile,
          customerLocation: selectedCustomer?.location,
          customerState: selectedCustomer?.state
        });

        toast({
          type: "success",
          title: isAdmin ? "Invoice Completed & Approved" : "Invoice Completed (Pending Approval)",
          description: `Bill ${updatedBill.invoiceNumber} saved.`
        });

        setEditingBillId(null);
        setEditingInvoiceNum("");
        fetchBills();

        // Clear inputs
        setSelectedCustomerId("");
        setCustomerSearchQuery("");
        setStartTime("");
        setEndTime("");
        setHoursUsed("0");
        setDiscount("0");
        setAdditionalCharges([]);
        setPaymentStatus("UNPAID");
        return;
      }

      // New bill creation mode
      const newBill = await billingService.create({
        customerId: selectedCustomerId,
        date: new Date().toISOString().split("T")[0],
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        hoursUsed: hoursNum,
        hourlyRate,
        extraCharges: additionalCharges,
        discount: discountVal,
        grandTotal,
        status: initialStatus,
        paymentStatus,
        createdBy: user?.fullName || user?.primaryEmailAddress || "Operator",
        createdByEmail: user?.primaryEmailAddress || ""
      }, orgId || undefined);

      setGeneratedInvoice({
        ...newBill,
        customerName: selectedCustomer?.name,
        customerMobile: selectedCustomer?.mobile,
        customerLocation: selectedCustomer?.location,
        customerState: selectedCustomer?.state
      });
      
      toast({
        type: "success",
        title: isAdmin ? "Invoice Created & Approved" : "Invoice Created (Pending Approval)",
        description: isAdmin 
          ? `Bill ${newBill.invoiceNumber} approved and saved.`
          : `Bill ${newBill.invoiceNumber} created and sent for Admin approval.`
      });

      fetchBills();

      // Clear input fields for next billing cycle
      setSelectedCustomerId("");
      setCustomerSearchQuery("");
      setStartTime("");
      setEndTime("");
      setHoursUsed("0");
      setDiscount("0");
      setAdditionalCharges([]);
      setPaymentStatus("UNPAID");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Generation Failed",
        description: err.message || "Could not generate invoice."
      });
    } finally {
      setIsGenerating(false);
    }
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

  return (
    <div className="space-y-6">
      {/* Printable Invoice Container (ONLY visible during print) */}
      {generatedInvoice && (
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
              <p className="font-semibold text-slate-900 mt-1.5">{generatedInvoice.invoiceNumber}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Date: {generatedInvoice.date}</p>
            </div>
          </div>

          <div className="my-6 grid grid-cols-2 gap-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div>
              <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Bill To:</h3>
              <p className="font-bold text-slate-800 text-sm mt-1">{generatedInvoice.customerName}</p>
              <p className="text-slate-600 mt-0.5">Mobile: {generatedInvoice.customerMobile}</p>
              {generatedInvoice.customerLocation && (
                <p className="text-slate-600 mt-0.5">
                  Location: {generatedInvoice.customerLocation}{generatedInvoice.customerState ? `, ${generatedInvoice.customerState}` : ''}
                </p>
              )}
            </div>
            <div className="text-right flex flex-col justify-end">
              {generatedInvoice.startTime && generatedInvoice.endTime && (
                <p className="text-[10px] text-slate-600 font-semibold">Timing: {generatedInvoice.startTime} - {generatedInvoice.endTime}</p>
              )}
              <p className="text-[10px] text-slate-600">Hours Rent Rate: {currencySymbol}{generatedInvoice.hourlyRate} / hour</p>
              <p className="text-[10px] text-slate-600">Usage Duration: {generatedInvoice.hoursUsed} hr</p>
            </div>
          </div>

          {/* Pricing breakdown table */}
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
                <td className="p-2 text-center">{generatedInvoice.hoursUsed} hr × {currencySymbol}{generatedInvoice.hourlyRate}</td>
                <td className="p-2 text-right font-semibold">{currencySymbol}{generatedInvoice.hoursUsed * generatedInvoice.hourlyRate}</td>
              </tr>
              {generatedInvoice.extraCharges.map((chg) => (
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

          {/* Totals Box */}
          <div className="mt-8 flex justify-end">
            <div className="w-64 space-y-1.5 text-right border-t border-slate-200 pt-4">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Subtotal Usage:</span>
                <span>{currencySymbol}{generatedInvoice.hoursUsed * generatedInvoice.hourlyRate}</span>
              </div>
              {generatedInvoice.extraCharges.length > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Additional Charges:</span>
                  <span>+{currencySymbol}{generatedInvoice.extraCharges.reduce((s, c) => s + c.amount, 0)}</span>
                </div>
              )}
              {generatedInvoice.discount > 0 && (
                <div className="flex justify-between text-[10px] text-red-600 font-semibold">
                  <span>Discount Applied:</span>
                  <span>-{currencySymbol}{generatedInvoice.discount}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-emerald-600 pt-2 font-bold text-sm text-slate-800">
                <span>Grand Total:</span>
                <span className="text-emerald-700">{currencySymbol}{generatedInvoice.grandTotal}</span>
              </div>
            </div>
          </div>

          {/* Notes & Sign */}
          <div className="mt-16 grid grid-cols-2 gap-8 items-end border-t border-slate-100 pt-8">
            <div className="text-[9px] text-slate-500">
              <span className="font-bold uppercase tracking-wider block text-slate-600 mb-1">Invoice Notes</span>
              <p>{settings.invoiceNotes || "Please clear payment within due period."}</p>
              <p className="mt-4">{settings.footerText}</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="h-10 w-24 border-b border-slate-300"></div>
              <p className="text-[10px] font-semibold text-slate-700 mt-2">Authorized Signatory</p>
              <p className="text-[8px] text-slate-400 mt-0.5">Thank you for your business!</p>
            </div>
          </div>
        </div>
      )}

      {/* Screen layout */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Operator Billing Console</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create invoices by tracking hourly rentals, adding supplementary charges, and printing instantly.
          </p>
        </div>
        <Link href="/approvals">
          <Button variant="outline" size="sm" className="gap-2 cursor-pointer border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Approvals & History Queue
          </Button>
        </Link>
      </div>

      {/* Edit Mode Banner when prefilled from Approvals */}
      {editingBillId && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/50 p-4 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-blue-600 animate-ping shrink-0" />
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-200 text-sm">
                Editing Invoice {editingInvoiceNum}
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                Form prefilled. Updating this bill will resubmit it for Admin reapproval.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingBillId(null);
              setSelectedCustomerId("");
              setCustomerSearchQuery("");
              setStartTime("");
              setEndTime("");
              setHoursUsed("0");
              setDiscount("0");
              setAdditionalCharges([]);
              router.push("/billing");
            }}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            Cancel Edit Mode
          </button>
        </div>
      )}

      {/* Active Check-In Sessions Widget */}
      {bills.filter((b) => b.status === "IN_PROGRESS" && isBillCreatedByUser(b, user, isAdmin)).length > 0 && (
        <Card className="border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div>
                <CardTitle className="text-base text-amber-900 dark:text-amber-200">
                  Active Check-In Sessions ({bills.filter((b) => b.status === "IN_PROGRESS" && isBillCreatedByUser(b, user, isAdmin)).length})
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-400">
                  Farmers currently operating. Click "Check Out & Complete Bill" to enter end time & generate bill.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {bills.filter((b) => b.status === "IN_PROGRESS" && isBillCreatedByUser(b, user, isAdmin)).map((activeBill) => {
                const cust = customers.find((c) => c.id === activeBill.customerId);
                return (
                  <div key={activeBill.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 shadow-xs">
                    <div>
                      <p className="font-bold text-sm text-slate-850 dark:text-slate-100">{cust?.name || "Unknown Farmer"}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Checked In: {activeBill.startTime}
                        </span>
                        <span>• Date: {activeBill.date}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => handleStartCheckOut(activeBill)}
                      className="cursor-pointer gap-1 text-xs font-semibold"
                    >
                      Check Out & Bill
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Columns - Form Entry */}
        <div className="space-y-6 lg:col-span-2">
          {/* Customer Selection Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">1. Customer Identification</CardTitle>
                  <CardDescription>Select an existing farmer or open the Quick-Add dialog.</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickAddOpen(true)}
                  className="gap-1 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                  Quick Add Farmer
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Custom Searchable Select Dropdown */}
              <div className="relative customer-select-container">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Farmer *
                </label>
                <div className="relative">
                  <Search className="absolute top-3 left-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (selectedCustomerId) {
                        setSelectedCustomerId(""); // clear selection if editing search
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all shadow-xs"
                  />
                  {selectedCustomerId && (
                    <span className="absolute top-2.5 right-3 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <User className="h-3 w-3" /> Selected
                    </span>
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-3 text-center text-xs text-slate-500">
                        No farmer found. Use "Quick Add Farmer" button above.
                      </p>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleCustomerSelect(c)}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</p>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              Phone: {c.mobile} {c.location ? `| Location: ${c.location}${c.state ? `, ${c.state}` : ''}` : ""}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Machine Usage Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">2. Machine Usage details</CardTitle>
              <CardDescription>Select Start & End time for automatic hour calculation or enter hours directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TimePicker
                  label="Start Time (Check-In)"
                  value={startTime}
                  onChange={(val) => handleStartTimeChange(val)}
                  helperText="12-hr AM/PM picker"
                />
                <TimePicker
                  label="End Time (Check-Out)"
                  value={endTime}
                  onChange={(val) => handleEndTimeChange(val)}
                  helperText="12-hr AM/PM picker"
                />
                <Input
                  label="Hours Used *"
                  type="number"
                  step="0.01"
                  value={hoursUsed}
                  onChange={(e) => handleHoursUsedChange(e.target.value)}
                  placeholder="e.g. 2.5, 3.75, 5"
                />
              </div>

              {/* Clean Duration Breakdown Display */}
              {parseFloat(hoursUsed) > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between shadow-2xs">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Duration: {Math.floor(parseFloat(hoursUsed))} hr{Math.floor(parseFloat(hoursUsed)) !== 1 ? "s" : ""}{" "}
                      {Math.round((parseFloat(hoursUsed) % 1) * 60)} min{Math.round((parseFloat(hoursUsed) % 1) * 60) !== 1 ? "s" : ""} 
                      {" "}({parseFloat(hoursUsed).toFixed(2)} total hrs)
                    </span>
                    {(startTime || endTime || parseFloat(hoursUsed) > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStartTime("");
                          setEndTime("");
                          setHoursUsed("0");
                        }}
                        className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Reset Timings
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <Input
                  label="Rent Hourly Rate (From Settings)"
                  type="text"
                  value={`${currencySymbol} ${hourlyRate} / hour`}
                  disabled
                  helperText="Editable via Settings panel"
                />
                <div className="flex flex-col justify-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Calculation Summary:</span>
                  <span>
                    {startTime && endTime ? `Timing: ${startTime} to ${endTime} → ` : ""}
                    {hoursUsed} hrs × {currencySymbol}{hourlyRate} = <strong className="text-emerald-600 dark:text-emerald-400">{currencySymbol}{(parseFloat(hoursUsed) || 0) * hourlyRate}</strong>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Charges Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">3. Additional Charges Table</CardTitle>
              <CardDescription>Optional operation fees (diesel, transportation, service charges, maintenance).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <Input
                    label="Charge Title"
                    type="text"
                    placeholder="e.g. Diesel Charge, Transport Fee"
                    value={chargeName}
                    onChange={(e) => setChargeName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <Input
                    label="Amount"
                    type="number"
                    placeholder="0"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={handleAddCharge}
                    variant="outline"
                    className="h-10 cursor-pointer"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Dynamic charges list */}
              {additionalCharges.length > 0 && (
                <div className="rounded-lg border border-slate-200 overflow-hidden dark:border-slate-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operation Charge Name</TableHead>
                        <TableHead className="text-right">Amount ({currencySymbol})</TableHead>
                        <TableHead className="text-center w-16">Remove</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {additionalCharges.map((chg) => (
                        <TableRow key={chg.id}>
                          <TableCell className="font-medium">{chg.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs">₹{chg.amount}</TableCell>
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteCharge(chg.id)}
                              className="text-red-500 hover:text-red-700 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Action */}
        <div className="space-y-6">
          <Card className="border-emerald-500/20 dark:border-emerald-500/10">
            <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-emerald-600" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider">Live Summary Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Usage Rent Subtotal:</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{currencySymbol} {usageCost.toLocaleString()}</span>
                </div>
                {extraChargesCost > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Supplementary Charges:</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200">+{currencySymbol} {extraChargesCost.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Discount Entry */}
              <Input
                label="Flat Discount Amount"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                error={discountVal > (usageCost + extraChargesCost) ? "Discount exceeds bill total" : undefined}
              />

              {/* Grand Total */}
              <div className="pt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Grand Invoice Total:</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {currencySymbol} {Math.max(0, grandTotal).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment Status Selector (when completing bill) */}
              {!Boolean(startTime && (!endTime || endTime.trim() === "") && (hoursNum === 0 || isNaN(hoursNum))) && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Status upon Generation
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus("UNPAID")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        paymentStatus === "UNPAID"
                          ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-300 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Not Paid (Unpaid)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus("PAID")}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        paymentStatus === "PAID"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Paid (Complete)
                    </button>
                  </div>
                </div>
              )}

              {/* Check-In Mode Helper Banner */}
              {Boolean(startTime && (!endTime || endTime.trim() === "") && (hoursNum === 0 || isNaN(hoursNum))) && (
                <div className="flex gap-2 items-start rounded-lg bg-blue-50 dark:bg-blue-950/20 text-[11px] text-blue-800 dark:text-blue-300 p-3 border border-blue-100 dark:border-blue-900/30">
                  <Clock className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <span>Start time recorded. You can save this session as a <strong>Check-In</strong>, and enter End Time later when machine work finishes.</span>
                </div>
              )}

              {/* Validation warnings */}
              {!Boolean(startTime && (!endTime || endTime.trim() === "") && (hoursNum === 0 || isNaN(hoursNum))) && hoursNum <= 0 && (
                <div className="flex gap-2 items-start rounded-lg bg-amber-50 dark:bg-amber-950/20 text-[10px] text-amber-800 dark:text-amber-300 p-3 border border-amber-100 dark:border-amber-900/30">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>Rental hours must be specified and greater than zero to checkout.</span>
                </div>
              )}

              {/* Primary Action Button: Check-In vs Generate */}
              {Boolean(startTime && (!endTime || endTime.trim() === "") && (hoursNum === 0 || isNaN(hoursNum))) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveCheckIn}
                  isLoading={isGenerating}
                  disabled={!selectedCustomerId || !startTime}
                  className="w-full h-11 text-sm font-semibold border-amber-500 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/40 cursor-pointer gap-2"
                >
                  <Clock className="h-4.5 w-4.5 text-amber-600" />
                  Save Check-In (Start Session)
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={editingBillId ? "success" : "primary"}
                  onClick={handleGenerateBill}
                  isLoading={isGenerating}
                  disabled={!selectedCustomerId || hoursNum <= 0}
                  className="w-full h-11 text-sm font-semibold tracking-wide cursor-pointer"
                >
                  {!isGenerating && (editingBillId ? <Send className="h-4.5 w-4.5" /> : <Receipt className="h-4.5 w-4.5" />)}
                  {editingBillId ? `Update & Complete (${editingInvoiceNum})` : "Generate & Save Bill"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Add Farmer Modal */}
      <Dialog
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        title="Quick Register Farmer"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsQuickAddOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="primary" onClick={handleQuickCustSubmit(onQuickAddSubmit)} className="cursor-pointer">Register & Select</Button>
          </>
        }
      >
        <form onSubmit={handleQuickCustSubmit(onQuickAddSubmit)} className="space-y-4">
          <Input
            label="Farmer Name *"
            placeholder="Farmer full name"
            error={quickCustErrors.name?.message}
            {...registerQuickCust("name")}
          />
          <Input
            label="Mobile Number *"
            placeholder="10 digit phone number"
            error={quickCustErrors.mobile?.message}
            {...registerQuickCust("mobile")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location (Town/Village)"
              placeholder="e.g. Hebbal"
              error={quickCustErrors.location?.message}
              {...registerQuickCust("location")}
            />
            <Input
              label="State Name"
              placeholder="e.g. Karnataka"
              error={quickCustErrors.state?.message}
              {...registerQuickCust("state")}
            />
          </div>
        </form>
      </Dialog>

      {/* Invoice Created Dialog / Preview before close */}
      <Dialog
        isOpen={generatedInvoice !== null}
        onClose={() => setGeneratedInvoice(null)}
        title="Invoice Created Successfully"
        className="max-w-2xl text-left"
        footer={
          <>
            <Button variant="outline" onClick={() => setGeneratedInvoice(null)} className="cursor-pointer">Close Console</Button>
            <Button variant="success" onClick={handlePrint} className="cursor-pointer">
              <Printer className="h-4 w-4" />
              Print / Save PDF (A4)
            </Button>
          </>
        }
      >
        {generatedInvoice && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-3.5 border border-green-150 dark:bg-green-950/20 dark:border-green-900/30 text-xs text-green-800 dark:text-green-300">
              Your invoice <strong>{generatedInvoice.invoiceNumber}</strong> has been logged to records. 
              Click <strong>Print / Save PDF</strong> to output a professional A4 invoice layout or download pdf.
            </div>

            {/* Virtual A4 Screen preview */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px] space-y-4 shadow-inner max-h-[50vh] overflow-y-auto">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-xs text-emerald-650">{settings.businessName}</h3>
                  <p className="text-[10px] text-slate-500">{settings.businessAddress}</p>
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-xs uppercase text-slate-500">Invoice</h4>
                  <p className="font-bold">{generatedInvoice.invoiceNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Farmer Info</span>
                  <p className="font-bold">{generatedInvoice.customerName}</p>
                  <p>Mobile: {generatedInvoice.customerMobile}</p>
                  {generatedInvoice.customerLocation && (
                    <p>Location: {generatedInvoice.customerLocation}{generatedInvoice.customerState ? `, ${generatedInvoice.customerState}` : ''}</p>
                  )}
                </div>
                <div className="text-right flex flex-col justify-end">
                  {generatedInvoice.startTime && generatedInvoice.endTime && (
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">Timing: {generatedInvoice.startTime} - {generatedInvoice.endTime}</p>
                  )}
                  <p>Rent: {currencySymbol}{generatedInvoice.hourlyRate}/hour</p>
                  <p>Duration: {generatedInvoice.hoursUsed} hours</p>
                  <p>Date: {generatedInvoice.date}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-850 pb-1 text-[9px] uppercase">
                      <th>Description</th>
                      <th className="text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-50 dark:border-slate-900">
                      <td className="py-2">Machine Usage Rent ({generatedInvoice.hoursUsed} hr)</td>
                      <td className="text-right py-2">{currencySymbol}{generatedInvoice.hoursUsed * generatedInvoice.hourlyRate}</td>
                    </tr>
                    {generatedInvoice.extraCharges.map((chg) => (
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
                  <span>{currencySymbol}{usageCost + extraChargesCost}</span>
                </div>
                {generatedInvoice.discount > 0 && (
                  <div className="flex justify-between w-48 text-[10px] text-red-500">
                    <span className="font-semibold">Discount:</span>
                    <span>-{currencySymbol}{generatedInvoice.discount}</span>
                  </div>
                )}
                <div className="flex justify-between w-48 font-bold text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <span>Grand Total:</span>
                  <span className="text-emerald-600">{currencySymbol}{generatedInvoice.grandTotal}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    }>
      <BillingFormInner />
    </Suspense>
  );
}
