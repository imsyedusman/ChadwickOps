"use client";

import { usePathname } from "next/navigation";
import { ClientAISummaryCard } from "@/components/ui/ClientAISummaryCard";

interface ClientAISummaryCardWrapperProps {
  page: "wip" | "capacity" | "procurement";
  context: Record<string, any>;
  compact?: boolean;
}

export function ClientAISummaryCardWrapper({ page, context, compact = false }: ClientAISummaryCardWrapperProps) {
  const pathname = usePathname();
  
  return <ClientAISummaryCard key={pathname} page={page} context={context} compact={compact} />;
}
