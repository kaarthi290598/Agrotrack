"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customerService } from "../../services/customer.service";
import { billingService } from "../../services/billing.service";
import { settingsService } from "../../services/settings.service";
import { Customer, Bill, AdditionalCharge, Settings, BillStatus, PaymentMode, hasElevatedAccess } from "../../types";
import { customerSnapshotFromCustomer, resolveBillCustomer } from "../../lib/bill-customer";
import { calculateBillHours, isSameDayEndBeforeStart } from "../../lib/bill-hours";
import { mobileNumberSchema, normalizeMobileInput } from "../../lib/mobile";
import { formatRupee, roundRupee, roundRupeeNonNegative } from "../../lib/money";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { TimePicker } from "../../components/ui/TimePicker";
import { DatePicker } from "../../components/ui/DatePicker";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { BillingPageSkeleton } from "../../components/skeletons/PageSkeletons";
import { downloadInvoicePdf } from "../../lib/invoice-pdf";
import {
  InvoicePrintArea,
  InvoicePreviewContent,
} from "../../components/bills/InvoiceDocument";
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
  User,
  CheckCircle2,
  XCircle,
  Edit3,
  Check,
  X,
  Navigation,
  Send,
  Zap,
  Play,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  MapPin
} from "lucide-react";

// Schema for quick customer dialog
const quickCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: mobileNumberSchema,
  location: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional()
});

type QuickCustomerForm = z.infer<typeof quickCustomerSchema>;

function BillingFormInner() {
  const { orgId, isLoaded: isClerkLoaded } = useClerkAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = hasElevatedAccess(user?.role);

  // App Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  
  // Billing Mode Tab ("express" vs "sessions")
  const [activeTab, setActiveTab] = useState<"express" | "sessions">("express");

  // Billing Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [hoursUsed, setHoursUsed] = useState<string>("0");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID" | "PARTIAL_PAID">("UNPAID");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">("");
  const [partialPaidAmount, setPartialPaidAmount] = useState<string>("");
  const [ertNumber, setErtNumber] = useState<string>("");
  
  // Custom Charge Input States
  const [chargeName, setChargeName] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");

  // Edit Bill mode states
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingInvoiceNum, setEditingInvoiceNum] = useState<string>("");
  const [editingBillStatus, setEditingBillStatus] = useState<BillStatus | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // UI & Location States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  
  // Generated invoice preview modal
  const [generatedInvoice, setGeneratedInvoice] = useState<(Bill & { customerName?: string; customerMobile?: string; customerLocation?: string; customerState?: string }) | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Quick Add Customer Form
  const {
    register: registerQuickCust,
    handleSubmit: handleQuickCustSubmit,
    reset: resetQuickCust,
    setValue: setQuickCustValue,
    formState: { errors: quickCustErrors }
  } = useForm<QuickCustomerForm>({
    resolver: zodResolver(quickCustomerSchema)
  });

  const fetchBills = async () => {
    try {
      const data = await billingService.getAll(orgId || undefined);
      setBills(data);
    } catch (err) {
      console.error("Error fetching bills:", err);
    }
  };

  // Initial Data Loader
  useEffect(() => {
    if (!isClerkLoaded) return;

    async function loadData() {
      try {
        const settingsData = await settingsService.get(orgId || undefined);
        const customerData = await customerService.getAll(orgId || undefined);
        const billsData = await billingService.getAll(orgId || undefined);
        setSettings(settingsData);
        setCustomers(customerData);
        setBills(billsData);
        
        if (searchParams.get("tab") === "sessions") {
          setActiveTab("sessions");
        }

        // Check if editing a bill via query param /billing?editBillId=bill-123
        const editBillId = searchParams.get("editBillId");
        const forceCheckout = searchParams.get("checkout") === "1";
        if (editBillId) {
          const foundBill = billsData.find((b) => b.id === editBillId);
          if (foundBill) {
            // Supervisors cannot edit approved bills; Admin / Ops Lead can.
            if (foundBill.status === "APPROVED" && !isAdmin) {
              toast({
                type: "error",
                title: "Edit Not Allowed",
                description: "Supervisors cannot edit approved bills.",
              });
              router.replace("/bills");
              return;
            }
            const isLiveCheckout =
              forceCheckout || foundBill.status === "IN_PROGRESS";
            if (isLiveCheckout) {
              const cust = customerData.find((c) => c.id === foundBill.customerId);
              setSelectedCustomerId(foundBill.customerId);
              setCustomerSearchQuery(cust?.name || "");
              setStartTime(foundBill.startTime || "");
              setBillDate(
                foundBill.date || new Date().toISOString().split("T")[0]
              );
              const today = new Date().toISOString().split("T")[0];
              setEndDate(today);
              const now = new Date();
              const nowStr = `${now.getHours().toString().padStart(2, "0")}:${now
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;
              setEndTime(nowStr);
              if (foundBill.startTime) {
                const hours = calculateBillHours({
                  startDate: foundBill.date || today,
                  endDate: today,
                  startTime: foundBill.startTime,
                  endTime: nowStr,
                });
                if (hours !== null) setHoursUsed(hours.toString());
              }
              setEditingBillId(foundBill.id);
              setEditingInvoiceNum(foundBill.invoiceNumber || "");
              setEditingBillStatus(foundBill.status);
              setErtNumber(foundBill.ertNumber || "");
              setDiscount(foundBill.discount?.toString() || "0");
              setAdditionalCharges(foundBill.extraCharges || []);
              setPaymentStatus(foundBill.paymentStatus || "UNPAID");
              setPaymentMode(foundBill.paymentMode || "");
              setActiveTab("express");
            } else {
              setEditingBillId(foundBill.id);
              setEditingInvoiceNum(foundBill.invoiceNumber || "");
              setEditingBillStatus(foundBill.status);
              setErtNumber(foundBill.ertNumber || "");
              setSelectedCustomerId(foundBill.customerId);
              const foundCust = customerData.find(
                (c) => c.id === foundBill.customerId
              );
              if (foundCust) {
                setCustomerSearchQuery(foundCust.name);
              }
              if (foundBill.date) {
                setBillDate(foundBill.date);
                setEndDate(foundBill.endDate || foundBill.date);
              }
              setStartTime(foundBill.startTime || "");
              setEndTime(foundBill.endTime || "");
              setHoursUsed(foundBill.hoursUsed.toString());
              setDiscount(foundBill.discount.toString());
              setAdditionalCharges(foundBill.extraCharges || []);
              setPaymentStatus(foundBill.paymentStatus || "UNPAID");
              setPaymentMode(foundBill.paymentMode || "");
              if (foundBill.amountPaid !== undefined) {
                setPartialPaidAmount(String(foundBill.amountPaid));
              }
            }
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
  }, [orgId, isClerkLoaded, searchParams, toast, isAdmin, router]);

  // GPS Location Trigger for Quick Add Customer
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ type: "error", title: "GPS Unavailable", description: "Browser geolocation is not supported." });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`
          );
          const data = await res.json();
          const address = data.address || {};
          const town = address.village || address.suburb || address.town || address.city || address.county || "";
          const state = address.state || "";
          const pincode = address.postcode || "";

          if (town) setQuickCustValue("location", town);
          if (state) setQuickCustValue("state", state);
          if (pincode) setQuickCustValue("pincode", pincode);

          toast({
            type: "success",
            title: "Location Auto-Filled",
            description: `Detected: ${town}${state ? `, ${state}` : ""}${pincode ? ` (${pincode})` : ""}`
          });
        } catch (err) {
          toast({ type: "error", title: "Location Error", description: "Failed to reverse geocode GPS coordinates." });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        toast({ type: "error", title: "GPS Error", description: err.message || "Failed to fetch GPS coordinates." });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Farmer Filter for Dropdown
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.mobile.includes(customerSearchQuery) ||
      (c.location && c.location.toLowerCase().includes(customerSearchQuery.toLowerCase()))
  );

  const handleCustomerSelect = (c: Customer) => {
    setSelectedCustomerId(c.id);
    setCustomerSearchQuery(c.name);
    setIsDropdownOpen(false);
  };

  // Helper to add/subtract hours to a 24-hr time string "HH:mm"
  const computeTimeWithOffset = (baseTime: string, hoursOffset: number): string => {
    const base = baseTime || "09:00";
    const [hStr, mStr] = base.split(":");
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    if (isNaN(h)) h = 9;
    if (isNaN(m)) m = 0;

    let totalMins = Math.round(h * 60 + m + hoursOffset * 60);
    totalMins = (totalMins % (24 * 60) + 24 * 60) % (24 * 60);

    const newH = Math.floor(totalMins / 60);
    const newM = totalMins % 60;
    return `${newH < 10 ? `0${newH}` : `${newH}`}:${newM < 10 ? `0${newM}` : `${newM}`}`;
  };

  const recalculateHours = (
    nextStartDate = billDate,
    nextEndDate = endDate,
    nextStartTime = startTime,
    nextEndTime = endTime
  ) => {
    if (!nextStartTime || !nextEndTime) return;
    if (
      isSameDayEndBeforeStart(
        nextStartDate,
        nextEndDate,
        nextStartTime,
        nextEndTime
      )
    ) {
      setHoursUsed("0");
      return;
    }
    const hours = calculateBillHours({
      startDate: nextStartDate,
      endDate: nextEndDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
    });
    if (hours !== null) {
      setHoursUsed(hours.toString());
    }
  };

  // Time Sync Handlers
  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    if (val && endTime) {
      recalculateHours(billDate, endDate, val, endTime);
    } else if (val && parseFloat(hoursUsed) > 0) {
      const computedEnd = computeTimeWithOffset(val, parseFloat(hoursUsed));
      setEndTime(computedEnd);
    }
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (startTime && val) {
      recalculateHours(billDate, endDate, startTime, val);
    } else if (val && parseFloat(hoursUsed) > 0) {
      const computedStart = computeTimeWithOffset(val, -parseFloat(hoursUsed));
      setStartTime(computedStart);
    }
  };

  const handleBillDateChange = (val: string) => {
    setBillDate(val);
    const nextEnd = endDate < val ? val : endDate;
    if (nextEnd !== endDate) setEndDate(nextEnd);
    recalculateHours(val, nextEnd, startTime, endTime);
  };

  const handleEndDateChange = (val: string) => {
    const nextEnd = val < billDate ? billDate : val;
    setEndDate(nextEnd);
    recalculateHours(billDate, nextEnd, startTime, endTime);
  };

  // Add Custom Charge
  const handleAddCharge = () => {
    if (!chargeName.trim()) {
      toast({ type: "error", title: "Validation Error", description: "Charge name cannot be empty." });
      return;
    }
    const amount = roundRupee(parseFloat(chargeAmount));
    if (isNaN(amount) || amount < 0) {
      toast({ type: "error", title: "Validation Error", description: "Charge amount must be positive." });
      return;
    }

    const newCharge: AdditionalCharge = {
      id: `chg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: chargeName.trim(),
      amount
    };

    setAdditionalCharges([...additionalCharges, newCharge]);
    setChargeName("");
    setChargeAmount("");
  };

  // Add Preset Charge Pill
  const handleAddPresetCharge = (preset: { name: string; amount: number }) => {
    const amount = roundRupee(preset.amount);
    const newCharge: AdditionalCharge = {
      id: `chg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: preset.name,
      amount
    };
    setAdditionalCharges([...additionalCharges, newCharge]);
    toast({ type: "success", title: "Charge Added", description: `Added ${preset.name} (+${formatRupee(amount)}).` });
  };

  const handleDeleteCharge = (id: string) => {
    setAdditionalCharges(additionalCharges.filter((c) => c.id !== id));
  };

  // Calculations (money rounded to nearest rupee for UI + DB)
  const hourlyRate = roundRupee(settings?.hourlyRate || 1200);
  const hoursNum = parseFloat(hoursUsed) || 0;
  const usageCost = roundRupee(hoursNum * hourlyRate);
  const extraChargesCost = roundRupee(
    additionalCharges.reduce((acc, c) => acc + c.amount, 0)
  );
  const discountVal = roundRupeeNonNegative(parseFloat(discount) || 0);
  const grandTotal = roundRupeeNonNegative(
    usageCost + extraChargesCost - discountVal
  );
  const currencySymbol = settings?.currencySymbol || "₹";

  // Quick Add Customer Form Submit
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
        title: "Farmer Registered",
        description: `Selected ${newCust.name} for billing.`
      });
    } catch (err: any) {
      toast({ type: "error", title: "Quick Add Failed", description: err.message || "Failed to register customer." });
    }
  };

  const validateErtNumber = (): string | null => {
    const trimmed = ertNumber.trim().toUpperCase();
    if (!trimmed) {
      toast({ type: "error", title: "Validation Error", description: "ERT Number is required." });
      return null;
    }
    if (!/^[A-Za-z0-9-]+$/.test(trimmed)) {
      toast({
        type: "error",
        title: "Validation Error",
        description: "ERT Number may only contain letters, digits, and dashes.",
      });
      return null;
    }
    const duplicate = bills.some(
      (b) =>
        b.ertNumber &&
        b.ertNumber.toLowerCase() === trimmed.toLowerCase() &&
        b.id !== editingBillId
    );
    if (duplicate) {
      toast({
        type: "error",
        title: "Validation Error",
        description: `ERT Number "${trimmed}" is already used on another bill.`,
      });
      return null;
    }
    return trimmed;
  };

  // Save Check-In Session
  const handleSaveCheckIn = async () => {
    if (!selectedCustomerId) {
      toast({ type: "error", title: "Validation Error", description: "Please select a farmer first." });
      return;
    }
    if (!startTime) {
      toast({ type: "error", title: "Validation Error", description: "Please select a Start Time to check in." });
      return;
    }
    const validErt = validateErtNumber();
    if (!validErt) return;

    setIsGenerating(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const customerSnapshot = customerSnapshotFromCustomer(selectedCustomer);
      await billingService.create({
        customerId: selectedCustomerId,
        ...customerSnapshot,
        date: billDate || new Date().toISOString().split("T")[0],
        endDate: billDate || new Date().toISOString().split("T")[0],
        startTime,
        endTime: undefined,
        hoursUsed: 0,
        hourlyRate,
        extraCharges: [],
        discount: 0,
        grandTotal: 0,
        ertNumber: validErt,
        status: "IN_PROGRESS",
        paymentStatus: "UNPAID",
        createdBy: user?.fullName || user?.primaryEmailAddress || "Operator",
        createdByEmail: user?.primaryEmailAddress || ""
      }, orgId || undefined);

      toast({
        type: "success",
        title: "Check-In Started",
        description: `Recorded session for ${selectedCustomer?.name || 'Farmer'} at ${startTime}.`
      });

      fetchBills();
      handleResetForm();
    } catch (err: any) {
      toast({ type: "error", title: "Check-In Failed", description: err.message || "Could not save check-in session." });
    } finally {
      setIsGenerating(false);
    }
  };

  // Start Check-Out for an active IN_PROGRESS session
  const handleStartCheckOut = (bill: Bill) => {
    const cust = customers.find(c => c.id === bill.customerId);
    setSelectedCustomerId(bill.customerId);
    setCustomerSearchQuery(cust?.name || "");
    setStartTime(bill.startTime || "");
    setBillDate(bill.date || new Date().toISOString().split("T")[0]);
    const today = new Date().toISOString().split("T")[0];
    setEndDate(today);
    
    const now = new Date();
    const currentH = now.getHours().toString().padStart(2, "0");
    const currentM = now.getMinutes().toString().padStart(2, "0");
    const nowStr = `${currentH}:${currentM}`;
    setEndTime(nowStr);

    if (bill.startTime) {
      recalculateHours(bill.date || today, today, bill.startTime, nowStr);
    }

    setEditingBillId(bill.id);
    setEditingInvoiceNum(bill.invoiceNumber || "");
    setEditingBillStatus(bill.status);
    setErtNumber(bill.ertNumber || "");
    setActiveTab("express");

    toast({
      type: "info",
      title: "Completing Session Check-Out",
      description: `Session loaded for ${cust?.name || 'Farmer'}. Confirm details to complete bill.`
    });
  };

  // Main Bill Generation Submit
  const handleGenerateBill = async () => {
    if (!selectedCustomerId) {
      toast({ type: "error", title: "Validation Error", description: "Please select a farmer." });
      return;
    }

    const validErt = validateErtNumber();
    if (!validErt) return;

    if (hoursNum <= 0 || isNaN(hoursNum)) {
      toast({ type: "error", title: "Validation Error", description: "Select Start & End time or duration preset to calculate hours." });
      return;
    }

    if (
      startTime &&
      endTime &&
      isSameDayEndBeforeStart(billDate, endDate, startTime, endTime)
    ) {
      toast({
        type: "error",
        title: "Validation Error",
        description:
          "End time is before start time on the same day. Set End Date to the next day for overnight sessions.",
      });
      return;
    }

    if (endDate < billDate) {
      toast({
        type: "error",
        title: "Validation Error",
        description: "End date cannot be before start date.",
      });
      return;
    }

    if (discountVal < 0 || discountVal > (usageCost + extraChargesCost)) {
      toast({ type: "error", title: "Validation Error", description: "Discount cannot exceed the total bill amount." });
      return;
    }

    const parsedPartialPaid = parseFloat(partialPaidAmount) || 0;
    if (paymentStatus === "PARTIAL_PAID" && (parsedPartialPaid < 0 || parsedPartialPaid > grandTotal)) {
      toast({ type: "error", title: "Validation Error", description: "Partial paid amount must be between 0 and bill grand total." });
      return;
    }
    if (paymentStatus === "PAID" && !paymentMode) {
      toast({ type: "error", title: "Validation Error", description: "Select Cash or Online as the Payment Mode." });
      return;
    }

    const calculatedAmountPaid =
      paymentStatus === "PARTIAL_PAID"
        ? roundRupeeNonNegative(parsedPartialPaid)
        : paymentStatus === "PAID"
          ? grandTotal
          : 0;
    const calculatedBalance =
      paymentStatus === "PARTIAL_PAID"
        ? roundRupeeNonNegative(grandTotal - calculatedAmountPaid)
        : paymentStatus === "PAID"
          ? 0
          : grandTotal;

    setIsGenerating(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      // Approve only applies to Fully Paid invoices.
      const initialStatus =
        isAdmin && paymentStatus === "PAID" ? "APPROVED" : "PENDING_APPROVAL";
      const customerSnapshot = customerSnapshotFromCustomer(selectedCustomer);
      
      if (editingBillId) {
        if (editingBillStatus === "APPROVED" && !isAdmin) {
          toast({
            type: "error",
            title: "Edit Not Allowed",
            description: "Supervisors cannot edit approved bills.",
          });
          return;
        }
        // Update existing bill mode
        const updatedBill = await billingService.update(editingBillId, {
          customerId: selectedCustomerId,
          ...customerSnapshot,
          date: billDate || new Date().toISOString().split("T")[0],
          endDate: endDate || billDate || new Date().toISOString().split("T")[0],
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          hoursUsed: hoursNum,
          hourlyRate,
          extraCharges: additionalCharges,
          discount: discountVal,
          grandTotal,
          ertNumber: validErt,
          status: initialStatus,
          paymentStatus,
          paymentMode: paymentMode || undefined,
          amountPaid: calculatedAmountPaid,
          balanceAmount: calculatedBalance
        });

        if (paymentStatus === "PAID" && updatedBill.invoiceNumber) {
          setGeneratedInvoice({
            ...updatedBill,
            ...resolveBillCustomer(updatedBill, new Map(customers.map((c) => [c.id, c]))),
          });
        }

        const label = updatedBill.invoiceNumber
          ? `Invoice ${updatedBill.invoiceNumber}`
          : `ERT ${validErt}`;
        toast({
          type: "success",
          title:
            paymentStatus === "PAID"
              ? initialStatus === "APPROVED"
                ? "Invoice Completed & Approved"
                : "Invoice Completed (Pending Approval)"
              : "Bill Updated Successfully",
          description: `${label} saved.`
        });

        setEditingBillId(null);
        setEditingInvoiceNum("");
        setEditingBillStatus(null);
        fetchBills();
        handleResetForm();
        return;
      }

      // New bill creation mode
      const newBill = await billingService.create({
        customerId: selectedCustomerId,
        ...customerSnapshot,
        date: billDate || new Date().toISOString().split("T")[0],
        endDate: endDate || billDate || new Date().toISOString().split("T")[0],
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        hoursUsed: hoursNum,
        hourlyRate,
        extraCharges: additionalCharges,
        discount: discountVal,
        grandTotal,
        ertNumber: validErt,
        status: initialStatus,
        paymentStatus,
        paymentMode: paymentMode || undefined,
        amountPaid: calculatedAmountPaid,
        balanceAmount: calculatedBalance,
        createdBy: user?.fullName || user?.primaryEmailAddress || "Operator",
        createdByEmail: user?.primaryEmailAddress || ""
      }, orgId || undefined);

      if (paymentStatus === "PAID" && newBill.invoiceNumber) {
        setGeneratedInvoice({
          ...newBill,
          ...resolveBillCustomer(newBill, new Map(customers.map((c) => [c.id, c]))),
        });
      }
      
      toast({
        type: "success",
        title:
          paymentStatus === "PAID" && newBill.invoiceNumber
            ? initialStatus === "APPROVED"
              ? "Invoice Created & Approved"
              : "Invoice Created (Pending Approval)"
            : "Bill Saved Successfully",
        description:
          paymentStatus === "PAID" && newBill.invoiceNumber
            ? initialStatus === "APPROVED"
              ? `Invoice ${newBill.invoiceNumber} logged & approved!`
              : `Invoice ${newBill.invoiceNumber} submitted for Admin approval.`
            : `Bill ERT ${validErt} recorded (${paymentStatus === "PARTIAL_PAID" ? "Partial Paid" : "Unpaid"}). Invoice assigned when Fully Paid.`,
      });

      fetchBills();
      handleResetForm();
    } catch (err: any) {
      toast({ type: "error", title: "Billing Failed", description: err.message || "Failed to create invoice." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetForm = () => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedCustomerId("");
    setCustomerSearchQuery("");
    setBillDate(today);
    setEndDate(today);
    setStartTime("");
    setEndTime("");
    setHoursUsed("0");
    setDiscount("0");
    setAdditionalCharges([]);
    setPaymentStatus("UNPAID");
    setPaymentMode("");
    setPartialPaidAmount("");
    setErtNumber("");
    setEditingBillId(null);
    setEditingInvoiceNum("");
    setEditingBillStatus(null);
  };

  const handleApproveEditingBill = async () => {
    if (!editingBillId || !isAdmin) return;
    setIsApproving(true);
    try {
      await billingService.approve(editingBillId);
      toast({
        type: "success",
        title: "Bill Approved",
        description: `Invoice #${editingInvoiceNum} approved.`,
      });
      handleResetForm();
      router.push("/bills?status=APPROVED");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Error",
        description: err.message || "Failed to approve bill.",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectEditingBill = async () => {
    if (!editingBillId || !isAdmin) return;
    setIsApproving(true);
    try {
      await billingService.reject(editingBillId);
      toast({
        type: "info",
        title: "Bill Rejected",
        description: `Invoice #${editingInvoiceNum} rejected.`,
      });
      handleResetForm();
      router.push("/bills?status=REJECTED");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Error",
        description: err.message || "Failed to reject bill.",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handlePrint = async () => {
    if (!generatedInvoice) return;
    if (!generatedInvoice.invoiceNumber) {
      toast({
        type: "error",
        title: "Invoice Pending",
        description: "PDF download is available after the bill is Fully Paid and an invoice number is assigned.",
      });
      return;
    }
    setIsExportingPdf(true);
    try {
      await downloadInvoicePdf(generatedInvoice.invoiceNumber);
      toast({
        type: "success",
        title: "PDF Downloaded",
        description: `${generatedInvoice.invoiceNumber}.pdf saved successfully.`,
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

  if (!isLoaded || !settings) {
    return <BillingPageSkeleton />;
  }

  // Scoped bills for member vs admin
  const userBills = bills.filter((b) => isBillCreatedByUser(b, user, isAdmin));
  const activeSessions = userBills.filter((b) => b.status === "IN_PROGRESS");
  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Shared print target — same Tax Invoice layout as Bills / Reports */}
      {generatedInvoice && settings && (
        <InvoicePrintArea
          bill={generatedInvoice}
          settings={settings}
          currencySymbol={currencySymbol}
        />
      )}

      {/* Header Banner & Workflow Tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Operator Billing Console
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hourly tractor billing & express invoice generator. Current Rate: <strong className="text-emerald-600">{currencySymbol}{hourlyRate}/hr</strong>
          </p>
        </div>

        {/* Workflow Tabs Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("express")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "express"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            <span>Express Bill</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sessions")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "sessions"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-blue-500" />
            <span>Active Check-Ins</span>
            {activeSessions.length > 0 && (
              <span className="bg-blue-600 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                {activeSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {editingBillId && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 min-w-0">
            <Edit3 className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="min-w-0">
              {editingInvoiceNum
                ? <>Editing Invoice <strong>#{editingInvoiceNum}</strong></>
                : <>Editing bill{ertNumber ? <> (ERT <strong>{ertNumber}</strong>)</> : null} — invoice pending until Fully Paid</>}
              {editingBillStatus === "PENDING_APPROVAL" && (
                <span className="ml-2 inline-flex items-center rounded bg-amber-200/80 dark:bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  Pending Approval
                </span>
              )}
              . Make changes below and click <strong>Update Bill</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin &&
              editingBillStatus === "PENDING_APPROVAL" &&
              paymentStatus === "PAID" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="success"
                  isLoading={isApproving}
                  onClick={handleApproveEditingBill}
                  className="h-8 gap-1 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  isLoading={isApproving}
                  onClick={handleRejectEditingBill}
                  className="h-8 gap-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={handleResetForm}
              className="text-amber-700 dark:text-amber-300 font-bold hover:underline cursor-pointer text-xs px-1"
            >
              Cancel Edit
            </button>
          </div>
        </div>
      )}
      {activeTab === "express" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) - Fast Form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Step 1: Farmer Selection */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">1</span>
                    <CardTitle className="text-base font-semibold">Select Farmer</CardTitle>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsQuickAddOpen(true)}
                    className="h-8 text-xs gap-1 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
                    Quick Add Farmer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Farmer Search Input */}
                <div className="relative">
                  <Input
                    ref={customerSearchRef}
                    placeholder="Type farmer name, mobile number, or village..."
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="pr-8"
                  />
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />

                  {/* Autocomplete Dropdown */}
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
                      {filteredCustomers.length === 0 ? (
                        <p className="p-3 text-center text-xs text-slate-500">
                          No farmer found matching query. Click "Quick Add Farmer" above.
                        </p>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleCustomerSelect(c)}
                            className="flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {c.mobile} {c.location ? `| ${c.location}` : ""}
                              </span>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Farmer Info Card */}
                {selectedCustomerObj && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 p-3 border border-emerald-200/60 dark:border-emerald-800/60">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {selectedCustomerObj.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white">{selectedCustomerObj.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                          Mobile: {selectedCustomerObj.mobile} {selectedCustomerObj.location ? `• ${selectedCustomerObj.location}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId("");
                        setCustomerSearchQuery("");
                        setIsDropdownOpen(true);
                        requestAnimationFrame(() => {
                          customerSearchRef.current?.focus();
                        });
                      }}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Date & Duration */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">2</span>
                    <CardTitle className="text-base font-semibold">Date & Duration</CardTitle>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 font-mono">
                    Rate: {currencySymbol}{hourlyRate}/hr
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="ERT Number (Estimated Running Cost) *"
                  value={ertNumber}
                  onChange={(e) => setErtNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ERT-123"
                  className="font-mono"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <DatePicker
                    label="Start Date *"
                    value={billDate}
                    onChange={handleBillDateChange}
                  />
                  <DatePicker
                    label="End Date *"
                    value={endDate}
                    onChange={handleEndDateChange}
                  />
                  <Input
                    label="Total Hours (Auto) *"
                    type="number"
                    step="0.01"
                    value={hoursUsed}
                    disabled
                    readOnly
                    placeholder="0.00"
                    className="bg-slate-50 dark:bg-slate-800/60 cursor-not-allowed font-mono font-extrabold text-slate-900 dark:text-slate-100"
                  />
                  <TimePicker
                    label="Start Time"
                    value={startTime}
                    onChange={(val) => handleStartTimeChange(val)}
                  />
                  <TimePicker
                    label="End Time"
                    value={endTime}
                    onChange={(val) => handleEndTimeChange(val)}
                  />
                </div>
                {startTime &&
                  endTime &&
                  isSameDayEndBeforeStart(billDate, endDate, startTime, endTime) && (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      End time is before start on the same day. Choose a later End Date for overnight work.
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Step 3: Supplementary Charges */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold">3</span>
                  <CardTitle className="text-base font-semibold">Supplementary Charges (Optional)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {/* Custom Inline Charge Creator */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Custom Charge Name (e.g. Extra Fuel)"
                      value={chargeName}
                      onChange={(e) => setChargeName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Amount (₹)"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value.replace(/-/g, ""))}
                    />
                    <Button
                      type="button"
                      onClick={handleAddCharge}
                      variant="outline"
                      className="h-10 cursor-pointer shrink-0"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Added Charges Table */}
                {additionalCharges.length > 0 && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-slate-800">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Charge Name</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-center w-12">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {additionalCharges.map((chg) => (
                          <TableRow key={chg.id}>
                            <TableCell className="font-semibold text-xs text-slate-800 dark:text-slate-200">{chg.name}</TableCell>
                            <TableCell className="font-mono font-bold text-xs text-right text-emerald-600 dark:text-emerald-400">+{currencySymbol}{chg.amount}</TableCell>
                            <TableCell className="text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteCharge(chg.id)}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

          {/* Right Column (1 Col) - Live Summary & Actions */}
          <div className="space-y-6">
            <Card className="border-emerald-500/30 dark:border-emerald-500/20 shadow-md">
              <CardHeader className="bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    Live Bill Summary
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Usage Subtotal ({hoursNum} hrs × {currencySymbol}{hourlyRate}):</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{formatRupee(usageCost, currencySymbol)}</span>
                  </div>
                  {extraChargesCost > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Supplementary Charges:</span>
                      <span className="font-bold text-emerald-600 font-mono">+{formatRupee(extraChargesCost, currencySymbol)}</span>
                    </div>
                  )}
                </div>

                {/* Discount Entry */}
                <Input
                  label="Flat Discount Amount (₹)"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(/-/g, ""))}
                  placeholder="0"
                  error={discountVal > (usageCost + extraChargesCost) ? "Discount exceeds bill total" : undefined}
                />

                {/* Grand Total Display */}
                <div className="pt-2 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">Grand Invoice Total:</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatRupee(grandTotal, currencySymbol)}
                    </span>
                  </div>
                </div>

                {/* Payment Status Option */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Status Option
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus("UNPAID");
                        setPaymentMode("");
                      }}
                      className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentStatus === "UNPAID"
                          ? "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-200 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Unpaid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus("PARTIAL_PAID");
                        setPaymentMode("");
                        if (!partialPaidAmount && grandTotal > 0) {
                          setPartialPaidAmount(String(Math.round(grandTotal / 2)));
                        }
                      }}
                      className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentStatus === "PARTIAL_PAID"
                          ? "bg-orange-50 border-orange-300 text-orange-900 dark:bg-orange-950/60 dark:border-orange-700 dark:text-orange-200 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Partial
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatus("PAID");
                        setPartialPaidAmount(String(grandTotal));
                      }}
                      className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        paymentStatus === "PAID"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                      }`}
                    >
                      Paid
                    </button>
                  </div>

                  {paymentStatus === "PARTIAL_PAID" && (
                    <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                      <Input
                        label="Amount Received So Far (₹)"
                        type="number"
                        min="0"
                        value={partialPaidAmount}
                        onChange={(e) => {
                          const val = e.target.value.replace(/-/g, "");
                          setPartialPaidAmount(val);
                          const numVal = parseFloat(val) || 0;
                          if (grandTotal > 0 && numVal >= grandTotal) {
                            setPaymentStatus("PAID");
                          }
                        }}
                        placeholder="e.g. 3000"
                      />
                      {parseFloat(partialPaidAmount) >= 0 && (
                        <div className="flex justify-between items-center rounded-xl bg-orange-50 dark:bg-orange-950/30 p-2.5 border border-orange-200 dark:border-orange-800 text-xs font-semibold">
                          <span className="text-orange-900 dark:text-orange-300">Remaining Balance:</span>
                          <span className="font-mono text-orange-700 dark:text-orange-400 font-extrabold text-sm">
                            {formatRupee(
                              grandTotal - roundRupee(parseFloat(partialPaidAmount) || 0),
                              currencySymbol
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentStatus === "PAID" && (
                    <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Payment Mode *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["CASH", "ONLINE"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentMode(mode)}
                            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                              paymentMode === mode
                                ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-xs dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                            }`}
                          >
                            {mode === "CASH" ? "Cash" : "Online"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons (Desktop View) */}
                <div className="hidden md:flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {isAdmin &&
                    editingBillId &&
                    editingBillStatus === "PENDING_APPROVAL" &&
                    paymentStatus === "PAID" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="success"
                        isLoading={isApproving}
                        onClick={handleApproveEditingBill}
                        className="w-full h-10 text-sm font-bold cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        Approve Bill
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        isLoading={isApproving}
                        onClick={handleRejectEditingBill}
                        className="w-full h-10 text-sm font-bold cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {endTime && endTime.trim() !== "" ? (
                    <Button
                      type="button"
                      onClick={handleGenerateBill}
                      isLoading={isGenerating}
                      variant="primary"
                      className="w-full h-11 text-sm font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      {editingBillId
                        ? "Update & Save Bill"
                        : paymentStatus === "PAID"
                        ? "Generate & Save Invoice"
                        : "Save Bill"}
                    </Button>
                  ) : startTime && startTime.trim() !== "" ? (
                    <Button
                      type="button"
                      onClick={handleSaveCheckIn}
                      isLoading={isGenerating}
                      variant="primary"
                      className="w-full h-11 text-sm font-bold shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                    >
                      <Clock className="h-4 w-4" />
                      Start & Save Check-In Session
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleGenerateBill}
                      isLoading={isGenerating}
                      variant="primary"
                      className="w-full h-11 text-sm font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <Send className="h-4 w-4" />
                      {editingBillId
                        ? "Update & Save Bill"
                        : paymentStatus === "PAID"
                        ? "Generate & Save Invoice"
                        : "Save Bill"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Active Check-In Sessions View */
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Running Check-Ins</CardTitle>
                <CardDescription>Sessions started in the field currently awaiting check-out & final bill generation.</CardDescription>
              </div>
              <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold">
                {activeSessions.length} Running
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
                <Clock className="mx-auto h-8 w-8 text-slate-400" />
                <p className="font-semibold text-sm">No active check-in sessions running.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("express")}
                  className="cursor-pointer"
                >
                  Switch to Express Billing
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSessions.map((session) => {
                  const cust = customers.find((c) => c.id === session.customerId);
                  return (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-600 animate-spin" />
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {session.ertNumber || session.invoiceNumber || "Session"}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200">
                          LIVE RUNNING
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Farmer</span>
                          <p className="font-extrabold text-slate-900 dark:text-slate-100">{cust?.name || "Unknown Farmer"}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{cust?.mobile}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Check-In Time</span>
                          <p className="font-bold text-blue-700 dark:text-blue-400">{session.startTime || session.date}</p>
                          <p className="text-[10px] text-slate-500">Rate: {currencySymbol}{session.hourlyRate}/hr</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 flex justify-end">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleStartCheckOut(session)}
                          className="h-8 text-xs gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-500 text-white"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          Complete Check-Out & Generate Invoice
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Floating Sticky Mobile Submit Action Bar */}
      {activeTab === "express" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3.5 flex flex-col gap-2 shadow-2xl md:hidden">
          {isAdmin &&
            editingBillId &&
            editingBillStatus === "PENDING_APPROVAL" &&
            paymentStatus === "PAID" && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="success"
                size="sm"
                isLoading={isApproving}
                onClick={handleApproveEditingBill}
                className="flex-1 h-9 text-xs font-bold cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                isLoading={isApproving}
                onClick={handleRejectEditingBill}
                className="flex-1 h-9 text-xs font-bold cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              {endTime && endTime.trim() !== "" ? "Grand Total" : "Mode"}
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {endTime && endTime.trim() !== "" ? formatRupee(grandTotal, currencySymbol) : "Check-In"}
            </span>
          </div>

          {endTime && endTime.trim() !== "" ? (
            <Button
              type="button"
              onClick={handleGenerateBill}
              isLoading={isGenerating}
              variant="primary"
              className="flex-1 h-11 text-xs font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {editingBillId
                ? "Update Bill"
                : paymentStatus === "PAID"
                ? "Generate Invoice"
                : "Save Bill"}
            </Button>
          ) : startTime && startTime.trim() !== "" ? (
            <Button
              type="button"
              onClick={handleSaveCheckIn}
              isLoading={isGenerating}
              variant="primary"
              className="flex-1 h-11 text-xs font-bold shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              <Clock className="h-4 w-4" />
              Start Check-In
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleGenerateBill}
              isLoading={isGenerating}
              variant="primary"
              className="flex-1 h-11 text-xs font-bold shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              {editingBillId
                ? "Update Bill"
                : paymentStatus === "PAID"
                ? "Generate Invoice"
                : "Save Bill"}
            </Button>
          )}
          </div>
        </div>
      )}
      {/* Quick Add Customer Dialog */}
      <Dialog
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        title="Quick Register Farmer"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsQuickAddOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="primary" onClick={handleQuickCustSubmit(onQuickAddSubmit)} className="cursor-pointer">Save & Select</Button>
          </>
        }
      >
        <form onSubmit={handleQuickCustSubmit(onQuickAddSubmit)} className="space-y-4 text-xs">
          <Input
            label="Farmer Name *"
            placeholder="Full Name"
            error={quickCustErrors.name?.message}
            {...registerQuickCust("name")}
          />
          <Input
            label="Mobile Number *"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile"
            error={quickCustErrors.mobile?.message}
            {...registerQuickCust("mobile", {
              setValueAs: (v) => normalizeMobileInput(String(v ?? "")),
              onChange: (e) => {
                e.target.value = normalizeMobileInput(e.target.value);
              },
            })}
          />
          
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Location Info</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetLocation}
              isLoading={isLocating}
              className="h-7 text-[11px] gap-1 border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
            >
              <Navigation className="h-3 w-3 text-emerald-600" />
              Use GPS Location
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Town / Village"
              placeholder="e.g. Hebbal"
              error={quickCustErrors.location?.message}
              {...registerQuickCust("location")}
            />
            <Input
              label="State"
              placeholder="e.g. Karnataka"
              error={quickCustErrors.state?.message}
              {...registerQuickCust("state")}
            />
            <Input
              label="Pincode"
              placeholder="e.g. 560024"
              error={quickCustErrors.pincode?.message}
              {...registerQuickCust("pincode")}
            />
          </div>
        </form>
      </Dialog>

      {/* Invoice Generated Success Modal */}
      <Dialog
        isOpen={generatedInvoice !== null}
        onClose={() => setGeneratedInvoice(null)}
        title="Invoice Created Successfully"
        className="max-w-2xl text-left"
        footer={
          <>
            <Button variant="outline" onClick={() => setGeneratedInvoice(null)} className="cursor-pointer">Close Console</Button>
            <Button variant="success" onClick={handlePrint} isLoading={isExportingPdf} disabled={isExportingPdf} className="cursor-pointer">
              <Printer className="h-4 w-4" />
              Download PDF (A4)
            </Button>
          </>
        }
      >
        {generatedInvoice && settings && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300">
              {generatedInvoice.invoiceNumber ? (
                <>Invoice <strong>{generatedInvoice.invoiceNumber}</strong> saved to system records! Click <strong>Download PDF</strong> to save a clean invoice file.</>
              ) : (
                <>Bill saved (ERT <strong>{generatedInvoice.ertNumber}</strong>). Invoice number is assigned when Fully Paid.</>
              )}
            </div>
            <InvoicePreviewContent
              bill={generatedInvoice}
              settings={settings}
              currencySymbol={currencySymbol}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingPageSkeleton />}>
      <BillingFormInner />
    </Suspense>
  );
}
