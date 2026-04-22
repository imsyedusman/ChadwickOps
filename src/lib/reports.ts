import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  differenceInDays,
  subDays,
  addSeconds,
  subSeconds
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const SYDNEY_TZ = "Australia/Sydney";

export type ReportingPreset = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "ytd" | "custom";

export interface PeriodBounds {
  from: Date; // UTC Date representing start of day in Sydney
  to: Date;   // UTC Date representing end of day in Sydney
  label: string;
}

/**
 * Calculates start and end boundaries for a given preset in Sydney Time, 
 * then converts them to UTC for safe database querying.
 */
export function getPeriodBounds(preset: ReportingPreset, customRange?: { from: Date; to: Date }): PeriodBounds {
  const nowInSydney = toZonedTime(new Date(), SYDNEY_TZ);
  let start: Date;
  let end: Date;
  let label: string;

  switch (preset) {
    case "this_month":
      start = startOfMonth(nowInSydney);
      end = nowInSydney; // Up to now
      label = "This Month";
      break;
    case "last_month":
      const lastMonth = subMonths(nowInSydney, 1);
      start = startOfMonth(lastMonth);
      end = endOfMonth(lastMonth);
      label = "Last Month";
      break;
    case "last_3_months":
      start = startOfMonth(subMonths(nowInSydney, 2));
      end = nowInSydney;
      label = "Last 3 Months";
      break;
    case "last_6_months":
      start = startOfMonth(subMonths(nowInSydney, 5));
      end = nowInSydney;
      label = "Last 6 Months";
      break;
    case "ytd":
      start = startOfYear(nowInSydney);
      end = nowInSydney;
      label = "Year to Date";
      break;
    case "custom":
      if (!customRange) throw new Error("Custom range required for 'custom' preset");
      start = customRange.from;
      end = customRange.to;
      label = "Custom Range";
      break;
    default:
      start = startOfMonth(nowInSydney);
      end = nowInSydney;
      label = "This Month";
  }

  // Ensure start is exactly 00:00:00 in Sydney
  const sydneyStart = new Date(start);
  sydneyStart.setHours(0, 0, 0, 0);

  // Ensure end is exactly 23:59:59 in Sydney if it's a fixed past date, 
  // or now if it's the current day.
  const sydneyEnd = new Date(end);
  if (preset === "this_month" || preset === "last_3_months" || preset === "last_6_months" || preset === "ytd") {
      // Keep end as "now" in Sydney
  } else {
      sydneyEnd.setHours(23, 59, 59, 999);
  }

  // Convert these Sydney local "calendar" dates to actual UTC timestamps
  return {
    from: fromZonedTime(sydneyStart, SYDNEY_TZ),
    to: fromZonedTime(sydneyEnd, SYDNEY_TZ),
    label
  };
}

/**
 * Calculates the comparison period of equal length immediately preceding the current bounds.
 */
export function getComparisonBounds(current: PeriodBounds): PeriodBounds {
  const daysDiff = differenceInDays(current.to, current.from) + 1;
  const prevTo = subSeconds(current.from, 1); // 1 second before current start
  const prevFrom = subDays(current.from, daysDiff);
  
  return {
    from: prevFrom,
    to: prevTo,
    label: "Previous Period"
  };
}

/**
 * Calculates percentage change and direction.
 */
export function calculateTrend(current: number, previous: number) {
  if (previous === 0) return { percent: current > 0 ? 100 : 0, direction: "up" as const };
  const diff = current - previous;
  const percent = Math.abs((diff / previous) * 100);
  return {
    percent: Math.round(percent),
    direction: diff >= 0 ? ("up" as const) : ("down" as const)
  };
}
