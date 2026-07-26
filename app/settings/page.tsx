"use client";

import React, { useEffect, useState } from "react";
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
import { Settings as SettingsIcon, Save, Sun, Moon } from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "../../components/auth/AuthProvider";

const settingsSchema = z.object({
  hourlyRate: z.number({ message: "Hourly rate must be a number" }).positive("Hourly rate must be greater than zero"),
  businessName: z.string().min(1, "Business name is required"),
  businessAddress: z.string().min(1, "Business address is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  gstNumber: z.string().optional(),
  invoicePrefix: z.string().min(1, "Invoice prefix is required"),
  currencySymbol: z.string().min(1, "Currency symbol is required"),
  defaultTax: z.number({ message: "Tax must be a number" }).min(0, "Tax cannot be negative").max(100, "Tax cannot exceed 100%"),
  invoiceNotes: z.string().optional(),
  footerText: z.string().optional()
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const { orgId, isLoaded: isClerkLoaded } = useClerkAuth();
  const { user } = useAuth();
  const canManageSettings = canAccessSettings(user?.role);
  const { toast } = useToast();

  useEffect(() => {
    if (user && !canManageSettings) {
      toast({ type: "error", title: "Access Denied", description: "Settings page is restricted to Admin users." });
      router.replace("/billing");
    }
  }, [user, canManageSettings, router, toast]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
  }, []);

  const switchTheme = (mode: "light" | "dark") => {
    setCurrentTheme(mode);
    if (typeof window !== "undefined") {
      if (mode === "dark") {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      hourlyRate: 1200,
      businessName: "",
      businessAddress: "",
      phoneNumber: "",
      gstNumber: "",
      invoicePrefix: "INV-",
      currencySymbol: "₹",
      defaultTax: 0,
      invoiceNotes: "",
      footerText: ""
    }
  });

  useEffect(() => {
    if (!isClerkLoaded) return;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const data = await settingsService.get(orgId || undefined);
        reset({
          ...data,
          gstNumber: data.gstNumber || "",
          invoiceNotes: data.invoiceNotes || "",
          footerText: data.footerText || ""
        });
      } catch (error) {
        toast({
          type: "error",
          title: "Error Loading Settings",
          description: "Could not fetch configuration settings."
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
      await settingsService.update(values as Settings, orgId || undefined);
      toast({
        type: "success",
        title: "Settings Saved",
        description: "Business configuration has been updated successfully."
      });
    } catch (error: any) {
      toast({
        type: "error",
        title: "Save Failed",
        description: error.message || "An error occurred while saving settings."
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !canManageSettings) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Business Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure business details, default pricing, taxes, and document layouts.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
              <CardTitle>Configuration Profile</CardTitle>
            </div>
            <CardDescription>Changes made here will be reflected across all billing processes and PDFs.</CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* Rates & Invoicing prefix */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 md:grid-cols-3">
              <Input
                label="Hourly Rate (₹)"
                type="number"
                min="0"
                step="0.01"
                error={errors.hourlyRate?.message}
                {...register("hourlyRate", { valueAsNumber: true })}
              />
              <Input
                label="Invoice Prefix"
                type="text"
                placeholder="e.g. INV-"
                error={errors.invoicePrefix?.message}
                {...register("invoicePrefix")}
              />
              <Input
                label="Currency Symbol"
                type="text"
                placeholder="e.g. ₹"
                error={errors.currencySymbol?.message}
                {...register("currencySymbol")}
              />
            </div>

            {/* Business Info */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Input
                label="Business Name"
                type="text"
                placeholder="e.g. Arkit Innovatives"
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

            {/* GST & Tax */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Input
                label="GST Number (Optional)"
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
            </div>

            {/* Address */}
            <Textarea
              label="Business Address"
              placeholder="Enter full physical address..."
              error={errors.businessAddress?.message}
              {...register("businessAddress")}
            />

            {/* Invoice Notes & Footer */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              Save Configurations
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
