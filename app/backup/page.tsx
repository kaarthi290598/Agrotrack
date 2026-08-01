"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  FileArchive,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../components/auth/AuthProvider";
import { canAccessBackup } from "../../types";
import { backupService } from "../../services/backup.service";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { useToast } from "../../components/ui/Toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  DateRange,
  DateRangePicker,
  makeDateRange,
} from "../../components/ui/DateRangePicker";

type PendingImport =
  | { format: "csv"; files: File[] }
  | { format: "excel"; file: File };

export default function BackupPage() {
  const router = useRouter();
  const { user, isLoaded } = useAuth();
  const { toast } = useToast();
  const canBackup = canAccessBackup(user?.role);

  const [dateRange, setDateRange] = useState<DateRange>(() =>
    makeDateRange("all")
  );
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const exportFilter =
    dateRange.preset === "all"
      ? {}
      : {
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        };

  useEffect(() => {
    if (!isLoaded) return;
    if (user && !canBackup) {
      toast({
        type: "error",
        title: "Access Denied",
        description: "Backup & Restore is restricted to Admin users.",
      });
      router.replace("/billing");
    }
  }, [isLoaded, user, canBackup, router, toast]);

  const handleDownloadCsv = async () => {
    if (dateRange.preset !== "all" && !dateRange.startDate && !dateRange.endDate) {
      toast({
        type: "error",
        title: "Date Range Required",
        description: "Select a start and/or end date, or choose All Time.",
      });
      return;
    }
    setIsExportingCsv(true);
    try {
      const filename = await backupService.downloadCsv(exportFilter);
      toast({
        type: "success",
        title: "CSV Backup Ready",
        description: `Downloaded ${filename} (customers, bills, settings).`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Backup Failed",
        description:
          err instanceof Error ? err.message : "Could not export CSV backup.",
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (dateRange.preset !== "all" && !dateRange.startDate && !dateRange.endDate) {
      toast({
        type: "error",
        title: "Date Range Required",
        description: "Select a start and/or end date, or choose All Time.",
      });
      return;
    }
    setIsExportingExcel(true);
    try {
      const filename = await backupService.downloadExcel(exportFilter);
      toast({
        type: "success",
        title: "Excel Backup Ready",
        description: `Downloaded ${filename}.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Backup Failed",
        description:
          err instanceof Error ? err.message : "Could not export Excel backup.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const clearFileInputs = () => {
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  const closeImportConfirm = () => {
    setPendingImport(null);
    clearFileInputs();
  };

  const handleImportCsvSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingImport({ format: "csv", files: Array.from(files) });
  };

  const handleImportExcelSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setPendingImport({ format: "excel", file });
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const pending = pendingImport;
    const isCsv = pending.format === "csv";

    if (isCsv) setIsImportingCsv(true);
    else setIsImportingExcel(true);

    try {
      const result = isCsv
        ? await backupService.restoreFromCsvFiles(pending.files)
        : await backupService.restoreFromExcel(pending.file);
      toast({
        type: "success",
        title: "Restore Complete",
        description: `Replaced existing data with backup: ${result.customersRestored} customers and ${result.billsRestored} bills${
          result.settingsRestored ? " (settings updated)" : ""
        }.`,
      });
      setPendingImport(null);
      clearFileInputs();
    } catch (err) {
      toast({
        type: "error",
        title: "Import Failed",
        description:
          err instanceof Error
            ? err.message
            : `Could not import ${isCsv ? "CSV" : "Excel"} backup.`,
      });
    } finally {
      setIsImportingCsv(false);
      setIsImportingExcel(false);
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!canBackup) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <DatabaseBackup className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Backup & Restore
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Admin-only manual export and import of customers, bills, and settings.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30 px-3.5 py-3 text-xs text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Import fully replaces all customers and bills in this organization with
          the backup file. A date-range backup removes data outside that range.
          Use a full ZIP or Excel export (Customers + Bills). Members and login
          accounts are not included.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4 text-emerald-600" />
            Download Backup
          </CardTitle>
          <CardDescription>
            Choose a date range first. Bills are filtered by invoice / billing
            date. Customers exported are only those linked to those invoices.
            Settings are always included. Use All Time for a full backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            label="Backup date range"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer justify-start sm:flex-1"
              isLoading={isExportingCsv}
              onClick={handleDownloadCsv}
            >
              <FileArchive className="h-4 w-4 mr-2" />
              Download Backup (CSV)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer justify-start sm:flex-1"
              isLoading={isExportingExcel}
              onClick={handleDownloadExcel}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Backup (Excel)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-600" />
            Import Backup
          </CardTitle>
          <CardDescription>
            Import a full backup ZIP or Excel workbook with both Customers and
            Bills sheets (Settings optional). Single-entity CSV files are
            rejected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <input
            ref={csvInputRef}
            type="file"
            accept=".zip,.csv,application/zip,text/csv"
            multiple
            className="hidden"
            onChange={(e) => handleImportCsvSelect(e.target.files)}
          />
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => handleImportExcelSelect(e.target.files)}
          />
          <Button
            type="button"
            className="cursor-pointer justify-start sm:flex-1"
            isLoading={isImportingCsv}
            onClick={() => csvInputRef.current?.click()}
          >
            <FileArchive className="h-4 w-4 mr-2" />
            Import Backup (CSV)
          </Button>
          <Button
            type="button"
            className="cursor-pointer justify-start sm:flex-1"
            isLoading={isImportingExcel}
            onClick={() => excelInputRef.current?.click()}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Import Backup (Excel)
          </Button>
        </CardContent>
      </Card>

      <Dialog
        isOpen={pendingImport !== null}
        onClose={() => {
          if (isImportingCsv || isImportingExcel) return;
          closeImportConfirm();
        }}
        title="Confirm Restore"
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeImportConfirm}
              className="cursor-pointer"
              disabled={isImportingCsv || isImportingExcel}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmImport}
              className="cursor-pointer"
              isLoading={isImportingCsv || isImportingExcel}
            >
              Restore Backup
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Restore from{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {pendingImport?.format === "csv"
                ? pendingImport.files.length === 1
                  ? pendingImport.files[0].name
                  : `${pendingImport.files.length} CSV files`
                : pendingImport?.file.name}
            </span>
            ?
          </p>
          <div className="rounded-lg bg-red-50 p-3.5 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300">
            <strong>Warning:</strong> This fully replaces all current customers
            and bills in this organization with the file contents. A date-range
            backup removes data outside that range. Settings are overwritten if
            present. Members and login accounts are not changed. This cannot be
            undone.
          </div>
        </div>
      </Dialog>
    </div>
  );
}
