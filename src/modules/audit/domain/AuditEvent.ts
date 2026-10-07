// Domain: Audit Event Model
// Centralized immutable audit trail

import { AuditAction } from '@/shared/constants';

export interface AuditRecordProps {
  id?: string;
  userId: string;
  userEmail?: string;
  eventType: AuditAction | string;
  entityName: string;
  entityId: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  timestamp?: string;
  ipAddress?: string;
}

export class AuditEvent {
  public readonly userId: string;
  public readonly eventType: string;
  public readonly entityName: string;
  public readonly entityId: string;
  public readonly oldValues?: Record<string, any> | null;
  public readonly newValues?: Record<string, any> | null;
  public readonly timestamp: string;

  constructor(props: AuditRecordProps) {
    this.userId = props.userId;
    this.eventType = props.eventType;
    this.entityName = props.entityName;
    this.entityId = props.entityId;
    this.oldValues = props.oldValues || null;
    this.newValues = props.newValues || null;
    this.timestamp = props.timestamp || new Date().toISOString();
  }
}
