// Domain: Daily Sales Entity & Invariants
// Afaz Tobacco Sales & Stock Intelligence Platform

import { SubmissionStatus, SUBMISSION_STATUS } from '@/shared/constants';
import { ValidationError } from '@/shared/errors';

export interface CigaretteQuantities {
  wilson: number;
  shahara: number;
  express: number;
  nexus: number;
  sb: number;
  sm: number;
}

export interface ZardaQuantities {
  slb: number;
  qty_22_25: number;
  qty_99_14: number;
  qty_33_15: number;
}

export interface DailySalesRecordProps {
  id?: string;
  territoryId: string;
  reportingDate: string;
  status?: SubmissionStatus;
  remarks?: string;
  cigaretteSales: CigaretteQuantities;
  cigaretteStock: CigaretteQuantities;
  zardaSales: ZardaQuantities;
  zardaStock: ZardaQuantities;
  emptyPackets?: CigaretteQuantities;
  submittedBy?: string;
}

export class DailySalesEntry {
  public readonly territoryId: string;
  public readonly reportingDate: string;
  public status: SubmissionStatus;
  public remarks: string;
  public readonly cigaretteSales: CigaretteQuantities;
  public readonly cigaretteStock: CigaretteQuantities;
  public readonly zardaSales: ZardaQuantities;
  public readonly zardaStock: ZardaQuantities;
  public readonly emptyPackets?: CigaretteQuantities;
  public readonly submittedBy?: string;

  constructor(props: DailySalesRecordProps) {
    this.validate(props);
    this.territoryId = props.territoryId;
    this.reportingDate = props.reportingDate;
    this.status = props.status || SUBMISSION_STATUS.DRAFT;
    this.remarks = props.remarks || '';
    this.cigaretteSales = props.cigaretteSales;
    this.cigaretteStock = props.cigaretteStock;
    this.zardaSales = props.zardaSales;
    this.zardaStock = props.zardaStock;
    this.emptyPackets = props.emptyPackets;
    this.submittedBy = props.submittedBy;
  }

  private validate(props: DailySalesRecordProps): void {
    if (!props.territoryId) {
      throw new ValidationError('Territory ID is required');
    }
    if (!props.reportingDate || !/^\d{4}-\d{2}-\d{2}$/.test(props.reportingDate)) {
      throw new ValidationError('Valid reporting date (YYYY-MM-DD) is required');
    }

    // Invariant: Non-negative quantities
    const salesValues = Object.values(props.cigaretteSales || {});
    if (salesValues.some((v) => typeof v !== 'number' || v < 0)) {
      throw new ValidationError('Cigarette sales quantities must be non-negative numbers');
    }

    const stockValues = Object.values(props.cigaretteStock || {});
    if (stockValues.some((v) => typeof v !== 'number' || v < 0)) {
      throw new ValidationError('Cigarette stock quantities must be non-negative numbers');
    }
  }
}
