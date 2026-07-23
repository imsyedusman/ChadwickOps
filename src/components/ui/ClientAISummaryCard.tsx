"use client";

import { useEffect, useState } from "react";
import { generatePageAISummary } from "@/app/actions/ai-insights";
import { AISummaryCard } from "./AISummaryCard";

interface ClientAISummaryCardProps {
  page: "wip" | "capacity" | "procurement";
  context: Record<string, any>;
  compact?: boolean;
}

export function ClientAISummaryCard({ page, context, compact = false }: ClientAISummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function fetchSummary() {
      try {
        const result = await generatePageAISummary(page, context);
        if (mounted) {
          if (result.success && result.data) {
            setSummary(result.data.summary);
          } else {
            setSummary(null);
          }
        }
      } catch (err) {
        if (mounted) setSummary(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    fetchSummary();
    
    return () => {
      mounted = false;
    };
  // We purposely exclude `context` so filter changes don't re-trigger the API
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AISummaryCard summary={summary} loading={loading} compact={compact} />;
}
