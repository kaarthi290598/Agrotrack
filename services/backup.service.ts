import { api } from "../convex/_generated/api";
import { getAuthedConvexClient } from "../lib/convex-client";
import type {
  BackupDateFilter,
  BackupSnapshot,
  RestorePayload,
} from "../lib/backup-format";
import {
  downloadCsvBackup,
  downloadExcelBackup,
  parseCsvBackupFiles,
  parseExcelBackup,
} from "../lib/backup-io";
import { billingService } from "./billing.service";
import { customerService } from "./customer.service";

export const backupService = {
  exportSnapshot: async (
    filter: BackupDateFilter = {}
  ): Promise<BackupSnapshot> => {
    const convex = await getAuthedConvexClient();
    return (await convex.query(api.backup.exportData, {
      startDate: filter.startDate || undefined,
      endDate: filter.endDate || undefined,
    })) as BackupSnapshot;
  },

  downloadExcel: async (filter: BackupDateFilter = {}): Promise<string> => {
    const snapshot = await backupService.exportSnapshot(filter);
    return downloadExcelBackup(snapshot);
  },

  downloadCsv: async (filter: BackupDateFilter = {}): Promise<string> => {
    const snapshot = await backupService.exportSnapshot(filter);
    return downloadCsvBackup(snapshot);
  },

  restoreFromExcel: async (file: File) => {
    const payload = parseExcelBackup(await file.arrayBuffer());
    return backupService.restore(payload);
  },

  restoreFromCsvFiles: async (files: FileList | File[]) => {
    const payload = await parseCsvBackupFiles(files);
    return backupService.restore(payload);
  },

  restore: async (payload: RestorePayload) => {
    const convex = await getAuthedConvexClient();
    const result = await convex.mutation(api.backup.restoreData, {
      customers: payload.customers,
      bills: payload.bills,
      settings: payload.settings,
    });

    // Refresh localStorage caches so lists match Convex immediately.
    await Promise.all([
      billingService.getAll(),
      customerService.getAll(),
    ]);

    return result;
  },
};
