"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MonthPicker } from "./MonthPicker";
import { format } from "date-fns";

interface ReportsClientProps {
  currentDate: Date;
}

export function MonthPickerWrapper({ currentDate }: ReportsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (newDate: Date) => {
    const monthStr = format(newDate, "yyyy-MM");
    startTransition(() => {
      router.push(`/reports?month=${monthStr}`);
    });
  };

  return (
    <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      <MonthPicker 
        currentDate={currentDate} 
        onChange={handleMonthChange} 
      />
    </div>
  );
}
