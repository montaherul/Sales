// Domain Layer: Core Entities, Value Objects & Business Logic
// Pure business logic independent of presentation and infrastructure details
// AGENTS1.md Rule 4 & Rule 7 (Domain Layer)

export * from '@/modules/identity/domain/types';
export * from '@/modules/organization/domain/types';
export * from '@/modules/product/domain/types';
export * from '@/modules/target/domain/types';
export * from '@/modules/daily-sales/domain/DailySalesEntry';
export * from '@/modules/approval/domain/ApprovalStateMachine';
export * from '@/modules/audit/domain/AuditEvent';
export * from '@/modules/reporting/domain/types';
export * from '@/modules/excel-import/domain/ImportValidationPipeline';

// Authoritative Business Calculations
export class CalculationEngine {
  /**
   * Calculates Sales-to-Date (STD) total across daily inputs.
   */
  public static calculateSTD(dailyValues: number[]): number {
    return dailyValues.reduce((sum, val) => sum + (val || 0), 0);
  }

  /**
   * Calculates Average Daily Sales (ADS) based on active days passed.
   */
  public static calculateADS(stdTotal: number, daysPassed: number): number {
    if (daysPassed <= 0) return 0;
    return Number((stdTotal / daysPassed).toFixed(2));
  }

  /**
   * Calculates target achievement percentage.
   */
  public static calculateAchievement(actual: number, target: number): number {
    if (target <= 0) return 0;
    return Number(((actual / target) * 100).toFixed(2));
  }

  /**
   * Calculates month-end projection based on ADS and total working days.
   */
  public static calculateProjection(ads: number, totalWorkingDays: number): number {
    return Number((ads * totalWorkingDays).toFixed(2));
  }

  /**
   * Calculates growth percentage between two periods.
   */
  public static calculateGrowth(current: number, baseline: number): number {
    if (baseline <= 0) return 0;
    return Number((((current - baseline) / baseline) * 100).toFixed(2));
  }
}
