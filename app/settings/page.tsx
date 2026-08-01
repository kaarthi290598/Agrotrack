"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { settingsService } from "../../services/settings.service";
import { Settings, canAccessSettings } from "../../types";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { useToast } from "../../components/ui/Toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { SettingsPageSkeleton } from "../../components/skeletons/PageSkeletons";
import {
  Building2,
  ImageIcon,
  Percent,
  ReceiptText,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "../../components/auth/AuthProvider";
import {
  formatInvoiceNumber,
  padInvoiceSequence,
  normalizeInvoiceDigits,
  MIN_INVOICE_NUMBER_DIGITS,
  MAX_INVOICE_NUMBER_DIGITS,
} from "../../lib/invoice-sequence";

const settingsSchema = z.object({
  hourlyRate: z
    .number({ message: "Hourly rate must be a number" })
    .positive("Hourly rate must be greater than zero"),
  businessName: z.string().min(1, "Business name is required"),
  businessAddress: z.string().min(1, "Business address is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  gstNumber: z.string().optional(),
  invoicePrefix: z.string().min(1, "Invoice prefix is required"),
  nextInvoiceNumber: z
    .number({ message: "Next invoice number must be a number" })
    .int("Next invoice number must be a whole number")
    .min(1, "Next invoice number must be at least 1"),
  invoiceNumberDigits: z
    .number({ message: "Digit count must be a number" })
    .int()
    .min(MIN_INVOICE_NUMBER_DIGITS)
    .max(MAX_INVOICE_NUMBER_DIGITS),
  currencySymbol: z.string().min(1, "Currency symbol is required"),
  defaultTax: z
    .number({ message: "Tax must be a number" })
    .min(0, "Tax cannot be negative")
    .max(100, "Tax cannot exceed 100%"),
  hsnCode: z.string().optional(),
  invoiceNotes: z.string().optional(),
  footerText: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { orgId, isLoaded: isClerkLoaded } = useClerkAuth();
  const { user } = useAuth();
  const canManageSettings = canAccessSettings(user?.role);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !canManageSettings) {
      toast({
        type: "error",
        title: "Access Denied",
        description: "Settings page is restricted to Admin users.",
      });
      router.replace("/billing");
    }
  }, [user, canManageSettings, router, toast]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [highestUsedInvoiceNumber, setHighestUsedInvoiceNumber] = useState(0);
  const [latestInvoiceNumber, setLatestInvoiceNumber] = useState<string | null>(
    null
  );
  const [nextNumberDisplay, setNextNumberDisplay] = useState("00001");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      hourlyRate: 1200,
      businessName: "",
      businessAddress: "",
      phoneNumber: "",
      gstNumber: "",
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1,
      invoiceNumberDigits: 5,
      currencySymbol: "₹",
      defaultTax: 0,
      hsnCode: "",
      invoiceNotes: "",
      footerText: "",
    },
  });

  const watchedPrefix = watch("invoicePrefix");
  const watchedNext = watch("nextInvoiceNumber");
  const watchedDigits = watch("invoiceNumberDigits");
  const digits = normalizeInvoiceDigits(watchedDigits);
  const previewInvoiceNumber = formatInvoiceNumber(
    watchedPrefix || "INV-",
    Number.isFinite(watchedNext) && watchedNext >= 1 ? watchedNext : 1,
    digits
  );

  useEffect(() => {
    if (!isClerkLoaded) return;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const data = await settingsService.get(orgId || undefined);
        reset({
          hourlyRate: data.hourlyRate,
          businessName: data.businessName,
          businessAddress: data.businessAddress,
          phoneNumber: data.phoneNumber,
          gstNumber: data.gstNumber || "",
          invoicePrefix: data.invoicePrefix,
          nextInvoiceNumber: data.nextInvoiceNumber || 1,
          invoiceNumberDigits: data.invoiceNumberDigits || 5,
          currencySymbol: data.currencySymbol,
          defaultTax: data.defaultTax,
          hsnCode: data.hsnCode || "",
          invoiceNotes: data.invoiceNotes || "",
          footerText: data.footerText || "",
        });
        setLogoUrl(data.logoUrl ?? null);
        setHighestUsedInvoiceNumber(data.highestUsedInvoiceNumber ?? 0);
        setLatestInvoiceNumber(data.latestInvoiceNumber ?? null);
        setNextNumberDisplay(
          padInvoiceSequence(
            data.nextInvoiceNumber || 1,
            data.invoiceNumberDigits || 5
          )
        );
      } catch {
        toast({
          type: "error",
          title: "Error Loading Settings",
          description: "Could not fetch configuration settings.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [reset, toast, orgId, isClerkLoaded]);

  const onSubmit = async (values: SettingsFormValues) => {
    setIsSaving(true);
    try {
      const payload: Settings = {
        ...values,
        gstNumber: values.gstNumber || undefined,
        hsnCode: values.hsnCode || undefined,
        invoiceNotes: values.invoiceNotes || undefined,
        footerText: values.footerText || undefined,
        logoUrl,
      };
      const saved = await settingsService.update(payload, orgId || undefined);
      setLogoUrl(saved.logoUrl ?? null);
      setHighestUsedInvoiceNumber(saved.highestUsedInvoiceNumber ?? 0);
      setLatestInvoiceNumber(saved.latestInvoiceNumber ?? null);
      setNextNumberDisplay(
        padInvoiceSequence(
          saved.nextInvoiceNumber || 1,
          saved.invoiceNumberDigits || 5
        )
      );
      reset({
        hourlyRate: saved.hourlyRate,
        businessName: saved.businessName,
        businessAddress: saved.businessAddress,
        phoneNumber: saved.phoneNumber,
        gstNumber: saved.gstNumber || "",
        invoicePrefix: saved.invoicePrefix,
        nextInvoiceNumber: saved.nextInvoiceNumber || 1,
        invoiceNumberDigits: saved.invoiceNumberDigits || 5,
        currencySymbol: saved.currencySymbol,
        defaultTax: saved.defaultTax,
        hsnCode: saved.hsnCode || "",
        invoiceNotes: saved.invoiceNotes || "",
        footerText: saved.footerText || "",
      });
      toast({
        type: "success",
        title: "Settings Saved",
        description: "Business configuration has been updated successfully.",
      });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Save Failed",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while saving settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const updated = await settingsService.uploadLogo(file);
      setLogoUrl(updated.logoUrl ?? null);
      toast({
        type: "success",
        title: "Logo Updated",
        description: "Your invoice logo has been uploaded.",
      });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Logo Upload Failed",
        description:
          error instanceof Error ? error.message : "Could not upload the logo.",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleClearLogo = async () => {
    setIsUploadingLogo(true);
    try {
      const updated = await settingsService.clearLogo();
      setLogoUrl(updated.logoUrl ?? null);
      toast({
        type: "success",
        title: "Logo Removed",
        description: "Invoice will print without a logo.",
      });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Remove Failed",
        description:
          error instanceof Error ? error.message : "Could not remove the logo.",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoading || !canManageSettings) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Business Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure brand identity, billing defaults, tax details, and invoice text.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Brand & identity */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              <CardTitle>Brand & identity</CardTitle>
            </div>
            <CardDescription>
              Company details and logo shown on Tax Invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Business logo"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                )}
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Invoice logo
                </p>
                <p className="text-xs text-slate-500">
                  PNG or SVG, max 2 MB. Appears on the top-left of Tax Invoices.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,.png,.svg"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={isUploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer"
                  >
                    {!isUploadingLogo && <Upload className="h-4 w-4" />}
                    Upload logo
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploadingLogo}
                      onClick={handleClearLogo}
                      className="cursor-pointer text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Business Name"
                type="text"
                placeholder="e.g. Arkit Vedham India"
                error={errors.businessName?.message}
                {...register("businessName")}
              />
              <Input
                label="Phone Number"
                type="text"
                placeholder="e.g. +91 9845012345"
                error={errors.phoneNumber?.message}
                {...register("phoneNumber")}
              />
            </div>
            <Textarea
              label="Business Address"
              placeholder="Enter full physical address..."
              error={errors.businessAddress?.message}
              {...register("businessAddress")}
            />
          </CardContent>
        </Card>

        {/* Billing defaults */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              <CardTitle>Billing defaults</CardTitle>
            </div>
            <CardDescription>
              Default rates and invoice numbering used when creating bills.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <Input
                label="Hourly Rate (₹)"
                type="number"
                min="0"
                step="0.01"
                error={errors.hourlyRate?.message}
                {...register("hourlyRate", { valueAsNumber: true })}
              />
              <Input
                label="Currency Symbol"
                type="text"
                placeholder="e.g. ₹"
                error={errors.currencySymbol?.message}
                {...register("currencySymbol")}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Invoice Prefix"
                type="text"
                placeholder="e.g. INV-"
                error={errors.invoicePrefix?.message}
                {...register("invoicePrefix")}
              />
              <div className="w-full space-y-1.5 text-left">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Digit count
                </label>
                <select
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={digits}
                  onChange={(e) => {
                    const nextDigits = normalizeInvoiceDigits(
                      Number(e.target.value)
                    );
                    setValue("invoiceNumberDigits", nextDigits, {
                      shouldValidate: true,
                    });
                    const current =
                      Number.isFinite(watchedNext) && watchedNext >= 1
                        ? watchedNext
                        : 1;
                    setNextNumberDisplay(
                      padInvoiceSequence(current, nextDigits)
                    );
                  }}
                >
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} digits
                    </option>
                  ))}
                </select>
                {errors.invoiceNumberDigits?.message && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {errors.invoiceNumberDigits.message}
                  </p>
                )}
              </div>
              <Input
                label="Next Invoice Number"
                type="text"
                inputMode="numeric"
                className="font-mono tracking-wider"
                value={nextNumberDisplay}
                error={errors.nextInvoiceNumber?.message}
                helperText="Includes leading zeros"
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, digits);
                  setNextNumberDisplay(raw);
                  const parsed = parseInt(raw, 10);
                  if (Number.isFinite(parsed) && parsed >= 1) {
                    setValue("nextInvoiceNumber", parsed, {
                      shouldValidate: true,
                    });
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(nextNumberDisplay, 10);
                  const safe =
                    Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
                  setValue("nextInvoiceNumber", safe, { shouldValidate: true });
                  setNextNumberDisplay(padInvoiceSequence(safe, digits));
                }}
              />
              <div className="w-full space-y-1.5 text-left">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Latest invoice
                </label>
                <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {latestInvoiceNumber ||
                    (highestUsedInvoiceNumber > 0
                      ? formatInvoiceNumber(
                          watchedPrefix || "INV-",
                          highestUsedInvoiceNumber,
                          digits
                        )
                      : "None yet")}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/50">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Next invoice will be:{" "}
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {previewInvoiceNumber}
                </span>
              </p>
              <p className="mt-1 text-slate-500">
                {highestUsedInvoiceNumber > 0
                  ? `Latest under this prefix: ${
                      latestInvoiceNumber ||
                      formatInvoiceNumber(
                        watchedPrefix || "INV-",
                        highestUsedInvoiceNumber,
                        digits
                      )
                    }. You can jump the next number forward for emergencies, but not below the next unused value.`
                  : "No invoices assigned under this prefix yet. Sequence starts at the next number above."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tax & compliance */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              <CardTitle>Tax & compliance</CardTitle>
            </div>
            <CardDescription>
              GST details applied on Tax Invoices and sales reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input
                label="GST Number"
                type="text"
                placeholder="e.g. 29AAAAA1111A1Z1"
                error={errors.gstNumber?.message}
                {...register("gstNumber")}
              />
              <Input
                label="Default Tax %"
                type="number"
                min="0"
                step="0.01"
                error={errors.defaultTax?.message}
                {...register("defaultTax", { valueAsNumber: true })}
              />
              <Input
                label="HSN / SAC Code"
                type="text"
                placeholder="e.g. 998599"
                error={errors.hsnCode?.message}
                {...register("hsnCode")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice text */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              <CardTitle>Invoice text</CardTitle>
            </div>
            <CardDescription>
              Notes and footer copy printed on every Tax Invoice.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Textarea
                label="Default Invoice Notes"
                placeholder="Notes to print on each invoice..."
                error={errors.invoiceNotes?.message}
                rows={3}
                {...register("invoiceNotes")}
              />
              <Textarea
                label="Footer Text"
                placeholder="Text for the footer of the invoice..."
                error={errors.footerText?.message}
                rows={3}
                {...register("footerText")}
              />
            </div>
          </CardContent>
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-b-xl">
            <Button
              type="submit"
              isLoading={isSaving}
              variant="primary"
              className="w-full sm:w-auto px-6 cursor-pointer"
            >
              {!isSaving && <Save className="h-4.5 w-4.5" />}
              Save configurations
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
