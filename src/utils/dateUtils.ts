export class DateUtils {
  static parseDate(dateStr: string): Date {
    // Parse as local date to avoid timezone issues
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  static formatDate(date: Date): string {
    // Format as local date to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  static getDaysBetween(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  static generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  static isWeekday(date: Date, weekday: string): boolean {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayIndex = dayNames.indexOf(weekday);
    return date.getDay() === dayIndex;
  }

  static getWeekdayName(date: Date): string {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return dayNames[date.getDay()];
  }

  static isStudyDay(date: Date, availability: string[]): boolean {
    const weekday = this.getWeekdayName(date);
    return availability.includes(weekday);
  }

  static calculatePhaseInfo(totalStudyDays: number): {
    phase1: number;
    phase2: number;
    phase3: number;
  } {
    const phaseSize = Math.floor(totalStudyDays / 3);
    const remainder = totalStudyDays % 3;

    return {
      phase1: phaseSize + (remainder > 0 ? 1 : 0),
      phase2: phaseSize + (remainder > 1 ? 1 : 0),
      phase3: phaseSize,
    };
  }

  static distributeFullLengths(
    startDate: Date,
    testDate: Date,
    flWeekday: string,
    count: number = 6
  ): Date[] {
    const endDate = new Date(testDate);
    endDate.setDate(endDate.getDate() - 7); // Exclude last 7 days

    // Get ALL days that match the fl_weekday, not just study days
    const flDays = this.generateDateRange(startDate, endDate).filter((date) =>
      this.isWeekday(date, flWeekday)
    );

    if (flDays.length < count) {
      // If not enough days of the specified weekday, use any available days
      // This handles edge cases where the study period is short
      const allDays = this.generateDateRange(startDate, endDate);
      if (allDays.length < count) {
        throw new Error(
          `Not enough days for ${count} full lengths (only ${allDays.length} days available)`
        );
      }

      // Use all available days and distribute evenly
      const interval = Math.floor(allDays.length / count);
      const flDates: Date[] = [];

      for (let i = 0; i < count; i++) {
        const index = i * interval;
        if (index < allDays.length) {
          flDates.push(allDays[index]);
        }
      }

      return flDates.sort((a, b) => a.getTime() - b.getTime());
    }

    // Distribute evenly across available days of the specified weekday
    const interval = Math.floor(flDays.length / count);
    const flDates: Date[] = [];

    for (let i = 0; i < count; i++) {
      const index = i * interval;
      if (index < flDays.length) {
        flDates.push(flDays[index]);
      }
    }

    return flDates.sort((a, b) => a.getTime() - b.getTime());
  }

  static getPhaseForDay(
    dayIndex: number,
    phaseInfo: { phase1: number; phase2: number; phase3: number }
  ): number {
    if (dayIndex < phaseInfo.phase1) {
      return 1;
    } else if (dayIndex < phaseInfo.phase1 + phaseInfo.phase2) {
      return 2;
    } else {
      return 3;
    }
  }

  /**
   * Calculate dynamic time targets based on study duration
   * Shorter study periods need more aggressive time utilization
   */
  static calculateTimeTargets(totalStudyDays: number): {
    phase1Target: number;
    phase2Target: number;
    phase3Target: number;
    strategy: string;
  } {
    const daysPerPhase = totalStudyDays / 3;

    // Determine strategy based on study duration - more aggressive targets
    if (totalStudyDays <= 42) {
      // Short study period (≤6 weeks) - maximum utilization
      return {
        phase1Target: 230, // Use almost all of the 240 min budget
        phase2Target: 235, // Maximum utilization
        phase3Target: 240, // Use full budget
        strategy: "aggressive",
      };
    } else if (totalStudyDays <= 84) {
      // Medium study period (7-12 weeks) - high utilization
      return {
        phase1Target: 220, // High utilization
        phase2Target: 230, // High utilization
        phase3Target: 235, // Very high utilization
        strategy: "balanced",
      };
    } else {
      // Long study period (>12 weeks) - good utilization
      return {
        phase1Target: 210, // Good utilization
        phase2Target: 220, // Good utilization
        phase3Target: 230, // High utilization
        strategy: "conservative",
      };
    }
  }
}
