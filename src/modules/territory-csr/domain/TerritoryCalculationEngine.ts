// Calculation Engine: Territory CSR & Route Sales Intelligence
// Matches the exact calculation logic and formula behaviors from authoritative Excel sheet

export class TerritoryCalculationEngine {
  /**
   * Determine performance tier based on achievement ratio
   * >= 1.01 => 'Top Performer'
   * >= 1.00 => 'Achieved'
   * >= 0.98 => 'Near Target'
   * < 0.98  => 'Needs Pacing'
   */
  public static getPerformanceTier(
    achievementRatio: number
  ): 'Top Performer' | 'Achieved' | 'Near Target' | 'Needs Pacing' {
    if (achievementRatio >= 1.01) return 'Top Performer';
    if (achievementRatio >= 1.0) return 'Achieved';
    if (achievementRatio >= 0.98) return 'Near Target';
    return 'Needs Pacing';
  }

  /**
   * Calculate daily target from monthly target and working days
   */
  public static calculateDailyTarget(monthlyTarget: number, workingDays: number = 26): number {
    if (!workingDays || workingDays <= 0) return 0;
    return Number((monthlyTarget / workingDays).toFixed(2));
  }

  /**
   * Calculate elapsed working days in a given month up to selectedDay (excluding Fridays)
   */
  public static calculateElapsedWorkingDays(year: number, month: number, selectedDay: number): number {
    let workingDays = 0;
    const maxDay = Math.min(selectedDay, new Date(year, month, 0).getDate());

    for (let d = 1; d <= maxDay; d++) {
      const date = new Date(year, month - 1, d);
      // Friday is day 5 in JavaScript (0 = Sunday, 5 = Friday, 6 = Saturday)
      if (date.getDay() !== 5) {
        workingDays++;
      }
    }
    return Math.max(1, workingDays);
  }

  /**
   * Calculate total working days in a month (excluding Fridays)
   */
  public static calculateTotalWorkingDays(year: number, month: number): number {
    let count = 0;
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getDay() !== 5) {
        count++;
      }
    }
    return count > 0 ? count : 26;
  }
}
