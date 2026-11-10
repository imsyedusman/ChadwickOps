"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ATTENDANCE_PERIOD_PRESETS,
  getAttendancePresetRange,
  type AttendancePeriodValue,
} from "@/lib/attendance-logic";

interface RangeDatePickerProps {
  period: AttendancePeriodValue;
  from: string;
  to: string;
  activeLabel: string;
  onChange: (next: { period: AttendancePeriodValue; from: string; to: string }) => void;
  className?: string;
}

function parseDateString(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateString(date: Date | undefined): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

export function RangeDatePicker({
  period,
  from,
  to,
  activeLabel,
  onChange,
  className,
}: RangeDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>();
  const [month, setMonth] = React.useState<Date>(new Date());

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      const nextFrom = parseDateString(from);
      setDraft({ from: nextFrom, to: parseDateString(to) });
      setMonth(nextFrom ?? new Date());
    }
  };

  const presets = ATTENDANCE_PERIOD_PRESETS.filter((preset) => preset.value !== "custom");
  const canApply = Boolean(draft?.from && draft?.to);

  const applyPreset = (value: AttendancePeriodValue) => {
    const range = getAttendancePresetRange(value);
    onChange({ period: value, from: range.from, to: range.to });
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draft?.from || !draft?.to) return;
    onChange({
      period: "custom",
      from: toDateString(draft.from),
      to: toDateString(draft.to),
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 max-w-[260px] justify-start gap-2 px-3 text-xs font-medium shadow-xs",
            className
          )}
          aria-label="Date range"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="border-b p-1.5 sm:w-36 sm:border-b-0 sm:border-r">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset.value)}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  period === preset.value && "bg-accent text-accent-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDraft({ from: undefined, to: undefined })}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                period === "custom" && "bg-accent text-accent-foreground"
              )}
            >
              Custom
            </button>
          </div>
          <div>
            <Calendar
              mode="range"
              month={month}
              onMonthChange={setMonth}
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={1}
              className="p-3"
            />
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
              <span className="text-[11px] text-muted-foreground">
                {draft?.from ? format(draft.from, "d MMM") : "Start"} –{" "}
                {draft?.to ? format(draft.to, "d MMM yyyy") : "End"}
              </span>
              <Button type="button" size="sm" className="h-7 px-2.5 text-[11px]" disabled={!canApply} onClick={applyCustom}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
