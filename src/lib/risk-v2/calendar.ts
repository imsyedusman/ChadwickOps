import { WorkingPattern, DayCapacity, PeriodCapacity, CapacitySettingsV2 } from './types';

export const SYDNEY_TIMEZONE = 'Australia/Sydney';

export const DEFAULT_WORKING_PATTERN: WorkingPattern = {
  mon: 10,
  tue: 10,
  wed: 10,
  thu: 8,
  fri: 0,
  sat: 0,
  sun: 0,
};

/**
 * Returns the current date in 'YYYY-MM-DD' format in Australia/Sydney timezone.
 */
export function getSydneyTodayDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SYDNEY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Parses a 'YYYY-MM-DD' date string as a local date (midnight UTC to avoid DST day drift).
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats a Date object as 'YYYY-MM-DD'.
 */
export function formatDateString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds N days to a YYYY-MM-DD date string and returns the new YYYY-MM-DD string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = parseDateString(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateString(d);
}

/**
 * Computes Easter Sunday for a given year using Meeus/Jones/Butcher Gregorian algorithm.
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Calculates all official NSW Public Holidays for a given calendar year.
 * Returns a map of 'YYYY-MM-DD' -> Holiday Name.
 */
export function getNswPublicHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  const addDate = (y: number, m: number, d: number, name: string) => {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    holidays.set(key, name);
  };

  // Helper to find Nth occurrence of a specific weekday in a month
  // weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const getNthWeekday = (y: number, m: number, weekday: number, nth: number): number => {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const dt = new Date(Date.UTC(y, m - 1, day));
      if (dt.getUTCMonth() !== m - 1) break;
      if (dt.getUTCDay() === weekday) {
        count++;
        if (count === nth) return day;
      }
    }
    return 1;
  };

  // 1. New Year's Day (Jan 1)
  // If Jan 1 is Saturday -> additional holiday Monday Jan 3
  // If Jan 1 is Sunday -> additional holiday Monday Jan 2
  const newYearDay = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  addDate(year, 1, 1, "New Year's Day");
  if (newYearDay === 6) {
    addDate(year, 1, 3, "New Year's Day (Additional Day)");
  } else if (newYearDay === 0) {
    addDate(year, 1, 2, "New Year's Day (Additional Day)");
  }

  // 2. Australia Day (Jan 26)
  // If Jan 26 is Saturday or Sunday -> substitute holiday on following Monday
  const ausDay = new Date(Date.UTC(year, 0, 26)).getUTCDay();
  if (ausDay === 6) {
    addDate(year, 1, 28, "Australia Day (Observed)");
  } else if (ausDay === 0) {
    addDate(year, 1, 27, "Australia Day (Observed)");
  } else {
    addDate(year, 1, 26, "Australia Day");
  }

  // 3. Easter (Good Friday, Easter Saturday, Easter Sunday, Easter Monday)
  const easter = getEasterSunday(year);
  const easterSundayDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
  
  const goodFriday = new Date(easterSundayDate);
  goodFriday.setUTCDate(easterSundayDate.getUTCDate() - 2);
  addDate(goodFriday.getUTCFullYear(), goodFriday.getUTCMonth() + 1, goodFriday.getUTCDate(), 'Good Friday');

  const easterSaturday = new Date(easterSundayDate);
  easterSaturday.setUTCDate(easterSundayDate.getUTCDate() - 1);
  addDate(easterSaturday.getUTCFullYear(), easterSaturday.getUTCMonth() + 1, easterSaturday.getUTCDate(), 'Easter Saturday');

  addDate(easterSundayDate.getUTCFullYear(), easterSundayDate.getUTCMonth() + 1, easterSundayDate.getUTCDate(), 'Easter Sunday');

  const easterMonday = new Date(easterSundayDate);
  easterMonday.setUTCDate(easterSundayDate.getUTCDate() + 1);
  addDate(easterMonday.getUTCFullYear(), easterMonday.getUTCMonth() + 1, easterMonday.getUTCDate(), 'Easter Monday');

  // 4. Anzac Day (April 25)
  addDate(year, 4, 25, 'Anzac Day');

  // 5. King's Birthday (2nd Monday in June)
  const kingsBirthdayDay = getNthWeekday(year, 6, 1, 2);
  addDate(year, 6, kingsBirthdayDay, "King's Birthday");

  // 6. Labour Day (1st Monday in October)
  const labourDay = getNthWeekday(year, 10, 1, 1);
  addDate(year, 10, labourDay, 'Labour Day');

  // 7. Christmas Day (Dec 25) & Boxing Day (Dec 26)
  const xmasDayOfWeek = new Date(Date.UTC(year, 11, 25)).getUTCDay();
  addDate(year, 12, 25, 'Christmas Day');
  addDate(year, 12, 26, 'Boxing Day');

  if (xmasDayOfWeek === 5) {
    // Friday Christmas -> Boxing Day on Saturday -> additional Boxing Day holiday on Monday 28 Dec
    addDate(year, 12, 28, 'Boxing Day (Additional Day)');
  } else if (xmasDayOfWeek === 6) {
    // Saturday Christmas -> Monday 27 is Christmas (additional), Tuesday 28 is Boxing Day (additional)
    addDate(year, 12, 27, 'Christmas Day (Additional Day)');
    addDate(year, 12, 28, 'Boxing Day (Additional Day)');
  } else if (xmasDayOfWeek === 0) {
    // Sunday Christmas -> Tuesday 27 is Christmas (additional) (since Boxing Day is Monday 26)
    addDate(year, 12, 27, 'Christmas Day (Additional Day)');
  }

  return holidays;
}

/**
 * Cache for NSW public holidays by year.
 */
const nswHolidayCache = new Map<number, Map<string, string>>();

export function getCachedNswPublicHolidays(year: number): Map<string, string> {
  if (!nswHolidayCache.has(year)) {
    nswHolidayCache.set(year, getNswPublicHolidays(year));
  }
  return nswHolidayCache.get(year)!;
}

/**
 * Returns standard hours per person for a given day of the week according to the working pattern.
 */
export function getStandardHoursForDayOfWeek(dayOfWeek: number, pattern: WorkingPattern = DEFAULT_WORKING_PATTERN): number {
  switch (dayOfWeek) {
    case 1: return pattern.mon; // Monday
    case 2: return pattern.tue; // Tuesday
    case 3: return pattern.wed; // Wednesday
    case 4: return pattern.thu; // Thursday
    case 5: return pattern.fri; // Friday
    case 6: return pattern.sat; // Saturday
    case 0: return pattern.sun; // Sunday
    default: return 0;
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Evaluates the working capacity of an individual calendar day.
 */
export function evaluateDayCapacity(
  dateStr: string,
  settings: CapacitySettingsV2
): DayCapacity {
  const dt = parseDateString(dateStr);
  const year = dt.getUTCFullYear();
  const dayOfWeek = dt.getUTCDay();
  const dayName = DAY_NAMES[dayOfWeek];

  const standardHours = getStandardHoursForDayOfWeek(dayOfWeek, settings.workingPattern);

  // Check public holiday
  const holidays = getCachedNswPublicHolidays(year);
  const holidayName = holidays.get(dateStr);
  const isPublicHoliday = Boolean(holidayName);

  // Check factory closure
  const isFactoryClosure = settings.factoryClosures.includes(dateStr);

  // Effective working hours per person
  const effectiveHours = (isPublicHoliday || isFactoryClosure) ? 0 : standardHours;

  const workshopGrossHours = effectiveHours * settings.headcount;
  const workshopNetHours = workshopGrossHours * settings.efficiency;

  return {
    date: dateStr,
    dayOfWeek,
    dayName,
    standardHoursPerPerson: standardHours,
    isPublicHoliday,
    holidayName,
    isFactoryClosure,
    closureReason: isFactoryClosure ? 'Configured Factory Closure' : undefined,
    effectiveWorkingHoursPerPerson: effectiveHours,
    workshopGrossHours,
    workshopNetHours,
  };
}

/**
 * Generates an array of all date strings ('YYYY-MM-DD') in a month.
 */
export function getDaysInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const daysCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= daysCount; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

/**
 * Calculates exact capacity for a calendar month ('YYYY-MM').
 * For current month, calculates remaining capacity from referenceDate ('YYYY-MM-DD') onwards.
 */
export function calculateMonthCapacity(
  monthKey: string, // 'YYYY-MM'
  settings: CapacitySettingsV2,
  referenceDateStr: string = getSydneyTodayDateString()
): PeriodCapacity {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const dates = getDaysInMonth(year, month);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const refDt = parseDateString(referenceDateStr);
  const currentMonthKey = `${refDt.getUTCFullYear()}-${String(refDt.getUTCMonth() + 1).padStart(2, '0')}`;
  const isCurrentPeriod = monthKey === currentMonthKey;

  let totalWorkingDays = 0;
  let grossHours = 0;
  let netHours = 0;

  let remainingWorkingDays = 0;
  let remainingGrossHours = 0;
  let remainingNetHours = 0;

  for (const dateStr of dates) {
    const dayCap = evaluateDayCapacity(dateStr, settings);
    if (dayCap.effectiveWorkingHoursPerPerson > 0) {
      totalWorkingDays++;
      grossHours += dayCap.workshopGrossHours;
      netHours += dayCap.workshopNetHours;
    }

    // Remaining capacity in current month from referenceDate onwards
    if (isCurrentPeriod) {
      if (dateStr >= referenceDateStr && dayCap.effectiveWorkingHoursPerPerson > 0) {
        remainingWorkingDays++;
        remainingGrossHours += dayCap.workshopGrossHours;
        remainingNetHours += dayCap.workshopNetHours;
      }
    }
  }

  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  const monthLabel = monthDate.toLocaleString('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  return {
    periodKey: monthKey,
    label: monthLabel,
    startDate,
    endDate,
    workingDaysCount: totalWorkingDays,
    grossHours: Math.round(grossHours * 10) / 10,
    netCapacityHours: Math.round(netHours * 10) / 10,
    isCurrentPeriod,
    remainingWorkingDaysCount: isCurrentPeriod ? remainingWorkingDays : totalWorkingDays,
    remainingNetCapacityHours: Math.round((isCurrentPeriod ? remainingNetHours : netHours) * 10) / 10,
  };
}

/**
 * Returns ISO week key 'YYYY-Www' and date range for a given date.
 */
export function getIsoWeekInfo(date: Date): { weekKey: string; startOfWeekStr: string; endOfWeekStr: string; label: string } {
  // ISO week starts on Monday
  const dt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = dt.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // ISO 8601 week number
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstThursdayDay = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + (4 - firstThursdayDay));

  const weekNumber = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86400000) / 7);
  const weekYear = thursday.getUTCFullYear();
  const weekKey = `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;

  const monLabel = monday.toLocaleString('en-AU', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const sunLabel = sunday.toLocaleString('en-AU', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const label = `W${weekNumber} (${monLabel} - ${sunLabel})`;

  return {
    weekKey,
    startOfWeekStr: formatDateString(monday),
    endOfWeekStr: formatDateString(sunday),
    label,
  };
}

/**
 * Calculates capacity for an ISO week given its Monday date.
 */
export function calculateWeekCapacity(
  mondayDateStr: string,
  settings: CapacitySettingsV2,
  referenceDateStr: string = getSydneyTodayDateString()
): PeriodCapacity {
  const monday = parseDateString(mondayDateStr);
  const weekInfo = getIsoWeekInfo(monday);

  let workingDays = 0;
  let grossHours = 0;
  let netHours = 0;

  let remainingWorkingDays = 0;
  let remainingGrossHours = 0;
  let remainingNetHours = 0;

  const refWeekInfo = getIsoWeekInfo(parseDateString(referenceDateStr));
  const isCurrentPeriod = weekInfo.weekKey === refWeekInfo.weekKey;

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setUTCDate(monday.getUTCDate() + i);
    const dateStr = formatDateString(cur);

    const dayCap = evaluateDayCapacity(dateStr, settings);
    if (dayCap.effectiveWorkingHoursPerPerson > 0) {
      workingDays++;
      grossHours += dayCap.workshopGrossHours;
      netHours += dayCap.workshopNetHours;
    }

    if (isCurrentPeriod) {
      if (dateStr >= referenceDateStr && dayCap.effectiveWorkingHoursPerPerson > 0) {
        remainingWorkingDays++;
        remainingGrossHours += dayCap.workshopGrossHours;
        remainingNetHours += dayCap.workshopNetHours;
      }
    }
  }

  return {
    periodKey: weekInfo.weekKey,
    label: weekInfo.label,
    startDate: weekInfo.startOfWeekStr,
    endDate: weekInfo.endOfWeekStr,
    workingDaysCount: workingDays,
    grossHours: Math.round(grossHours * 10) / 10,
    netCapacityHours: Math.round(netHours * 10) / 10,
    isCurrentPeriod,
    remainingWorkingDaysCount: isCurrentPeriod ? remainingWorkingDays : workingDays,
    remainingNetCapacityHours: Math.round((isCurrentPeriod ? remainingNetHours : netHours) * 10) / 10,
  };
}

/**
 * Generates forward months list starting from referenceDate's month.
 */
export function generateForwardMonths(
  monthsCount: number,
  referenceDateStr: string = getSydneyTodayDateString()
): string[] {
  const dt = parseDateString(referenceDateStr);
  const startYear = dt.getUTCFullYear();
  const startMonth = dt.getUTCMonth(); // 0-indexed

  const list: string[] = [];
  for (let i = 0; i < monthsCount; i++) {
    const target = new Date(Date.UTC(startYear, startMonth + i, 1));
    const y = target.getUTCFullYear();
    const m = String(target.getUTCMonth() + 1).padStart(2, '0');
    list.push(`${y}-${m}`);
  }
  return list;
}

/**
 * Generates forward weeks list starting from referenceDate's Monday.
 */
export function generateForwardWeeks(
  weeksCount: number,
  referenceDateStr: string = getSydneyTodayDateString()
): string[] {
  const dt = parseDateString(referenceDateStr);
  const day = dt.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() + diffToMonday);

  const list: string[] = [];
  for (let i = 0; i < weeksCount; i++) {
    const target = new Date(monday);
    target.setUTCDate(monday.getUTCDate() + i * 7);
    list.push(formatDateString(target));
  }
  return list;
}

/**
 * Checks whether a given calendar day is a productive working day (has standard hours > 0, not a public holiday, not a closure).
 */
export function isWorkingDay(dateStr: string, settings: CapacitySettingsV2): boolean {
  const cap = evaluateDayCapacity(dateStr, settings);
  return cap.effectiveWorkingHoursPerPerson > 0;
}

/**
 * Steps forward (if deltaDays > 0) or backward (if deltaDays < 0) by a count of working days.
 */
export function stepWorkingDays(startDateStr: string, deltaDays: number, settings: CapacitySettingsV2): string {
  if (deltaDays === 0) return startDateStr;
  const direction = deltaDays > 0 ? 1 : -1;
  let remainingSteps = Math.abs(deltaDays);
  let currentDt = parseDateString(startDateStr);

  while (remainingSteps > 0) {
    currentDt.setUTCDate(currentDt.getUTCDate() + direction);
    const dateStr = formatDateString(currentDt);
    if (isWorkingDay(dateStr, settings)) {
      remainingSteps--;
    }
  }

  return formatDateString(currentDt);
}

/**
 * Counts working days between startDateStr and endDateStr (inclusive).
 */
export function countWorkingDays(startDateStr: string, endDateStr: string, settings: CapacitySettingsV2): number {
  if (startDateStr > endDateStr) return 0;
  let count = 0;
  let currentDt = parseDateString(startDateStr);
  const endDt = parseDateString(endDateStr);

  while (currentDt <= endDt) {
    const dateStr = formatDateString(currentDt);
    if (isWorkingDay(dateStr, settings)) {
      count++;
    }
    currentDt.setUTCDate(currentDt.getUTCDate() + 1);
  }

  return count;
}

