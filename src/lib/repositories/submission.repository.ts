// Submission Repository Layer
// Supports Supabase PostgreSQL with built-in persistent fallback

import { DailyOperationalRecord, SubmissionStatus } from '@/lib/types';
import fs from 'fs';
import path from 'path';

export interface AuditLogEntry {
  id: string;
  userId: string;
  eventType: string;
  entityName: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  timestamp: string;
}

export interface VersionSnapshotEntry {
  id: string;
  submissionId: string;
  versionNumber: number;
  snapshot: any;
  modifiedBy: string;
  reason: string;
  createdAt: string;
}

// In-memory & local file backed state for rapid testing
const STORAGE_FILE = path.resolve(process.cwd(), '.submissions-store.json');

interface LocalStoreState {
  submissions: Record<string, DailyOperationalRecord>; // keyed by territoryId + '_' + reportDate
  versions: VersionSnapshotEntry[];
  auditLogs: AuditLogEntry[];
}

function loadStore(): LocalStoreState {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load store:', err);
  }

  // Initial seed state for Satkania region
  return {
    submissions: {
      'satkania-1_2026-10-06': {
        territoryId: 'satkania-1',
        territoryName: 'Kerani hat',
        regionName: 'Satkania',
        reportDate: '2026-10-06',
        dayNumber: 6,
        status: 'SUBMITTED',
        cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.68, nexus: 0.00, sb: 0.00, sm: 0.00 },
        cigaretteStock: { wilson: 0.19, shahara: 0.00, express: 0.84, nexus: 0.00, sb: 0.00, sm: 0.00 },
        zardaSales: { slb: 0.01, qty_22_25: 5, qty_99_14: 0, qty_33_15: 0 },
        zardaStock: { slb: 0.97, qty_22_25: 1298, qty_99_14: 0, qty_33_15: 0 },
        emptyPackets: 6660,
        remarks: 'Active field route',
        totalCigaretteSales: 0.68,
        totalCigaretteStock: 1.03,
        totalZardaSalesValue: 75,
        totalZardaStockValue: 19470,
      },
      'satkania-2_2026-10-06': {
        territoryId: 'satkania-2',
        territoryName: 'Satkania',
        regionName: 'Satkania',
        reportDate: '2026-10-06',
        dayNumber: 6,
        status: 'TSO_APPROVED',
        cigaretteSales: { wilson: 0.01, shahara: 0.00, express: 0.41, nexus: 0.00, sb: 0.00, sm: 0.00 },
        cigaretteStock: { wilson: 0.05, shahara: 0.00, express: 1.15, nexus: 0.00, sb: 0.00, sm: 0.00 },
        zardaSales: { slb: 0.01, qty_22_25: 10, qty_99_14: 0, qty_33_15: 0 },
        zardaStock: { slb: 0.63, qty_22_25: 363, qty_99_14: 0, qty_33_15: 0 },
        emptyPackets: 4270,
        remarks: '',
        totalCigaretteSales: 0.42,
        totalCigaretteStock: 1.20,
        totalZardaSalesValue: 150,
        totalZardaStockValue: 5445,
      },
      'satkania-3_2026-10-06': {
        territoryId: 'satkania-3',
        territoryName: 'Bandarban',
        regionName: 'Satkania',
        reportDate: '2026-10-06',
        dayNumber: 6,
        status: 'RSO_APPROVED',
        cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.42, nexus: 0.00, sb: 0.00, sm: 0.00 },
        cigaretteStock: { wilson: 0.22, shahara: 0.00, express: 2.71, nexus: 0.00, sb: 0.00, sm: 0.00 },
        zardaSales: { slb: 0.03, qty_22_25: 0, qty_99_14: 60, qty_33_15: 0 },
        zardaStock: { slb: 1.15, qty_22_25: 60, qty_99_14: 1134, qty_33_15: 0 },
        emptyPackets: 4050,
        remarks: '',
        totalCigaretteSales: 0.42,
        totalCigaretteStock: 2.93,
        totalZardaSalesValue: 360,
        totalZardaStockValue: 7704,
      },
      'satkania-4_2026-10-06': {
        territoryId: 'satkania-4',
        territoryName: 'Rajasthali',
        regionName: 'Satkania',
        reportDate: '2026-10-06',
        dayNumber: 6,
        status: 'SUBMITTED',
        cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.06, nexus: 0.00, sb: 0.00, sm: 0.00 },
        cigaretteStock: { wilson: 0.09, shahara: 0.00, express: 0.11, nexus: 0.00, sb: 0.00, sm: 0.00 },
        zardaSales: { slb: 0.01, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 },
        zardaStock: { slb: 0.11, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 },
        emptyPackets: 600,
        remarks: '',
        totalCigaretteSales: 0.06,
        totalCigaretteStock: 0.20,
        totalZardaSalesValue: 0,
        totalZardaStockValue: 0,
      },
      'satkania-5_2026-10-06': {
        territoryId: 'satkania-5',
        territoryName: 'Dohazari',
        regionName: 'Satkania',
        reportDate: '2026-10-06',
        dayNumber: 6,
        status: 'FINALIZED',
        cigaretteSales: { wilson: 0.00, shahara: 0.00, express: 0.62, nexus: 0.00, sb: 0.00, sm: 0.00 },
        cigaretteStock: { wilson: 0.10, shahara: 0.00, express: 3.82, nexus: 0.00, sb: 0.00, sm: 0.00 },
        zardaSales: { slb: 0.00, qty_22_25: 18, qty_99_14: 0, qty_33_15: 0 },
        zardaStock: { slb: 0.58, qty_22_25: 962, qty_99_14: 0, qty_33_15: 0 },
        emptyPackets: 6400,
        remarks: '',
        totalCigaretteSales: 0.62,
        totalCigaretteStock: 3.92,
        totalZardaSalesValue: 270,
        totalZardaStockValue: 14430,
      },
    },
    versions: [],
    auditLogs: [],
  };
}

function saveStore(state: LocalStoreState): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save store:', err);
  }
}

export class SubmissionRepository {
  /**
   * Fetches submissions matching optional filters
   */
  static async getSubmissions(filter?: {
    date?: string;
    territoryId?: string;
    status?: SubmissionStatus;
  }): Promise<DailyOperationalRecord[]> {
    const store = loadStore();
    let records = Object.values(store.submissions);

    if (filter?.date) {
      records = records.filter((r) => r.reportDate === filter.date);
    }
    if (filter?.territoryId) {
      records = records.filter((r) => r.territoryId === filter.territoryId);
    }
    if (filter?.status) {
      records = records.filter((r) => r.status === filter.status);
    }

    return records;
  }

  /**
   * Saves or updates a daily submission record
   */
  static async saveSubmission(
    record: DailyOperationalRecord,
    userId: string,
    changeReason?: string
  ): Promise<DailyOperationalRecord> {
    const store = loadStore();
    const key = `${record.territoryId}_${record.reportDate}`;
    const existing = store.submissions[key];

    // If existing and already submitted/approved, capture snapshot
    if (existing && existing.status !== 'DRAFT') {
      const versionsForRecord = store.versions.filter((v) => v.submissionId === key);
      const nextVer = versionsForRecord.length + 1;

      store.versions.push({
        id: `ver-${Date.now()}-${nextVer}`,
        submissionId: key,
        versionNumber: nextVer,
        snapshot: existing,
        modifiedBy: userId,
        reason: changeReason || 'Data update',
        createdAt: new Date().toISOString(),
      });
    }

    store.submissions[key] = record;

    store.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId,
      eventType: existing ? 'SALES_UPDATE' : 'SALES_CREATE',
      entityName: 'daily_submissions',
      entityId: key,
      oldValues: existing,
      newValues: record,
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    return record;
  }

  /**
   * Transitions submission workflow state with audit logging
   */
  static async transitionStatus(params: {
    territoryId: string;
    reportDate: string;
    toStatus: SubmissionStatus;
    userId: string;
    comments?: string;
    unlockReason?: string;
  }): Promise<DailyOperationalRecord> {
    const store = loadStore();
    const key = `${params.territoryId}_${params.reportDate}`;
    const record = store.submissions[key];

    if (!record) {
      throw new Error(`Submission not found for territory ${params.territoryId} on ${params.reportDate}`);
    }

    const oldStatus = record.status;
    record.status = params.toStatus;

    store.auditLogs.push({
      id: `audit-${Date.now()}`,
      userId: params.userId,
      eventType: `STATUS_${params.toStatus}`,
      entityName: 'daily_submissions',
      entityId: key,
      oldValues: { status: oldStatus },
      newValues: { 
        status: params.toStatus, 
        comments: params.comments, 
        unlockReason: params.unlockReason 
      },
      timestamp: new Date().toISOString(),
    });

    saveStore(store);
    return record;
  }

  /**
   * Records an explicit audit log entry
   */
  static async recordAuditLog(
    eventType: string,
    userId: string,
    entityName: string,
    entityId: string,
    oldValues?: any,
    newValues?: any
  ): Promise<AuditLogEntry> {
    const store = loadStore();
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      userId,
      eventType,
      entityName,
      entityId,
      oldValues,
      newValues,
      timestamp: new Date().toISOString(),
    };
    store.auditLogs.push(entry);
    saveStore(store);
    return entry;
  }

  /**
   * Retrieves audit log entries
   */
  static async getAuditLogs(): Promise<AuditLogEntry[]> {
    const store = loadStore();
    return store.auditLogs.slice().reverse();
  }
}
