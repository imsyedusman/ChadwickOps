export type InsightSeverity = 'positive' | 'warning' | 'critical' | 'info';

export interface ProjectInsight {
  label: string;
  severity: InsightSeverity;
  explanation: string;
}

export interface ProfitabilityInsightData {
  gpActual: number;
  gpEstimated: number;
  invoicedActual: number;
  invoicedEstimated: number;
  materialsActual: number;
  materialsEstimated: number;
  labourActual: number;
  labourEstimated: number;
  hoursActual: number;
  hoursBudget: number;
  tasksCompleted: number;
  tasksTotal: number;
  // Optional override, otherwise computed based on tasks/hours > 80%
  isNearCompleteOverride?: boolean;
}

const THRESHOLDS = {
  COST_OVERRUN_RATIO: 1.15, // 15% over budget
  HOURS_VS_TASKS_GAP_PCT: 30, // 30 percentage point gap
  BILLING_GAP_RATIO: 0.85, // 15% below estimate
  VARIANCE_TOLERANCE_RATIO: 0.05, // 5% variance
  NEAR_COMPLETION_PCT: 80, // 80% tasks or hours completed
};

/**
 * Generates rule-based plain English insights explaining project performance.
 */
export function generateProjectInsights(data: ProfitabilityInsightData): ProjectInsight[] {
  const insights: ProjectInsight[] = [];

  const {
    gpActual,
    gpEstimated,
    invoicedActual,
    invoicedEstimated,
    materialsActual,
    materialsEstimated,
    labourActual,
    labourEstimated,
    hoursActual,
    hoursBudget,
    tasksCompleted,
    tasksTotal,
    isNearCompleteOverride,
  } = data;

  const hoursPct = hoursBudget > 0 ? (hoursActual / hoursBudget) * 100 : 0;
  const tasksPct = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  // Determine if project is near completion
  const isNearComplete = isNearCompleteOverride ?? (hoursPct >= THRESHOLDS.NEAR_COMPLETION_PCT || tasksPct >= THRESHOLDS.NEAR_COMPLETION_PCT);

  // 1 & 2 & 3. Cost Overruns
  const isLabourOver = labourEstimated > 0 && (labourActual / labourEstimated) >= THRESHOLDS.COST_OVERRUN_RATIO;
  const isMaterialsOver = materialsEstimated > 0 && (materialsActual / materialsEstimated) >= THRESHOLDS.COST_OVERRUN_RATIO;

  if (isLabourOver && isMaterialsOver) {
    insights.push({
      label: 'Broad Cost Overrun',
      severity: 'critical',
      explanation: 'Both labour and materials are significantly over budget.'
    });
  } else if (isLabourOver) {
    insights.push({
      label: 'Labour-Driven Overrun',
      severity: 'warning',
      explanation: 'Labour is significantly over budget while materials are on track.'
    });
  } else if (isMaterialsOver) {
    insights.push({
      label: 'Materials-Driven Overrun',
      severity: 'warning',
      explanation: 'Materials are significantly over budget while labour is on track.'
    });
  }

  // 4. Hours vs Tasks Gap
  if (hoursBudget > 0 && tasksTotal > 0) {
    if (hoursPct - tasksPct >= THRESHOLDS.HOURS_VS_TASKS_GAP_PCT) {
      insights.push({
        label: 'Risk of Further Overrun',
        severity: 'critical',
        explanation: `Hours consumed (${Math.round(hoursPct)}%) far exceeds task completion (${Math.round(tasksPct)}%).`
      });
    }
  }

  // 5. Billing Gap
  if (isNearComplete && invoicedEstimated > 0) {
    if (invoicedActual <= invoicedEstimated * THRESHOLDS.BILLING_GAP_RATIO) {
      insights.push({
        label: 'Billing Gap',
        severity: 'warning',
        explanation: 'Project is near complete but invoiced amount is significantly below estimate.'
      });
    }
  }

  // 6 & 7. Margin & Variance
  const variance = gpActual - gpEstimated;
  const varianceRatio = gpEstimated !== 0 ? Math.abs(variance / gpEstimated) : 0;
  const isVarianceSmall = gpEstimated !== 0 && varianceRatio <= THRESHOLDS.VARIANCE_TOLERANCE_RATIO;

  if (isVarianceSmall) {
    insights.push({
      label: 'On Track',
      severity: 'positive',
      explanation: 'Financial variance is small and within reasonable tolerance.'
    });
  } else if (gpActual >= gpEstimated && gpEstimated > 0) {
    // If not a small variance, but actual GP is much higher than estimated
    insights.push({
      label: 'Healthy Margin',
      severity: 'positive',
      explanation: 'Margin is healthy and tracking well above estimates.'
    });
  }

  return insights;
}
