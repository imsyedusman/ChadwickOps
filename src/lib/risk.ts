import { db } from '@/db';
import { systemConfig, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { getCapacitySettings } from '@/actions/capacity';

/**
 * Service to calculate delivery risk based on unified capacity settings.
 */

export class DeliveryRiskService {
  private cachedSettings: Awaited<ReturnType<typeof getCapacitySettings>> | null = null;

  async getSettings() {
    if (!this.cachedSettings) {
      this.cachedSettings = await getCapacitySettings();
    }
    return this.cachedSettings;
  }

  /**
   * Calculates risk status for a project based on remaining hours and business days.
   */
  async calculateProjectRisk(
    project: typeof projects.$inferSelect,
    preloadedSettings?: Awaited<ReturnType<typeof getCapacitySettings>>
  ) {
    const settings = preloadedSettings || await this.getSettings();
    
    // Unified Daily Capacity = (Staff * Hrs/Wk * Efficiency) / 5 (Assuming 5 work days/week)
    const dailyCapacity = (settings.staff * settings.hoursPerWeek * settings.efficiency) / 5;
    const riskThreshold = settings.riskThreshold;
    
    if (!project.deliveryDate || project.remainingHours <= 0) {
      return 'ON_TRACK';
    }

    const today = new Date();
    const deliveryDate = new Date(project.deliveryDate);
    const diffTime = deliveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'OVER_CAPACITY';

    // Business days (approx 5/7)
    const businessDays = Math.max(1, Math.ceil(diffDays * (5 / 7)));
    const totalAvailableCapacity = businessDays * dailyCapacity;
    const utilization = (project.remainingHours / totalAvailableCapacity) * 100;

    if (utilization > 100) return 'OVER_CAPACITY';
    if (utilization >= riskThreshold) return 'AT_RISK';
    
    return 'ON_TRACK';
  }

  // Removed updateRiskConfig as we now use updateCapacitySettings in capacity.ts
}
