export class DateUtils {
  static parseDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
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
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIndex = dayNames.indexOf(weekday);
    return date.getDay() === dayIndex;
  }

  static getWeekdayName(date: Date): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[date.getDay()];
  }

  static isStudyDay(date: Date, availability: string[]): boolean {
    const weekday = this.getWeekdayName(date);
    return availability.includes(weekday);
  }

  static calculatePhaseInfo(totalStudyDays: number): { phase1: number; phase2: number; phase3: number } {
    const phaseSize = Math.floor(totalStudyDays / 3);
    const remainder = totalStudyDays % 3;
    
    return {
      phase1: phaseSize + (remainder > 0 ? 1 : 0),
      phase2: phaseSize + (remainder > 1 ? 1 : 0),
      phase3: phaseSize
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
    
    const studyDays = this.generateDateRange(startDate, endDate)
      .filter(date => this.isWeekday(date, flWeekday));
    
    if (studyDays.length < count) {
      throw new Error(`Not enough ${flWeekday} days for ${count} full lengths`);
    }
    
    const interval = Math.floor(studyDays.length / (count - 1));
    const flDates: Date[] = [];
    
    for (let i = 0; i < count; i++) {
      const index = i * interval;
      if (index < studyDays.length) {
        flDates.push(studyDays[index]);
      }
    }
    
    return flDates.sort((a, b) => a.getTime() - b.getTime());
  }

  static getPhaseForDay(dayIndex: number, phaseInfo: { phase1: number; phase2: number; phase3: number }): number {
    if (dayIndex < phaseInfo.phase1) {
      return 1;
    } else if (dayIndex < phaseInfo.phase1 + phaseInfo.phase2) {
      return 2;
    } else {
      return 3;
    }
  }
}
