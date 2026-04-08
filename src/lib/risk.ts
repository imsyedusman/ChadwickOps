import { db } from '@/db';
import { systemConfig, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface RiskConfig {
  dailyCapacity: number; // Total daily labor hours (e.g. 7.5 * number of workers)
  riskThreshold: number; // % utilization to be considered "At Risk" (e.g. 90)
}

export class DeliveryRiskService {
  async getRiskConfig(): Promise<RiskConfig> {
    try {
      const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'RISK_CONFIGURATION'),
      });

      if (!config) {
        console.warn('[DeliveryRiskService] RISK_CONFIGURATION not found in system_config. Using defaults.');
        return {
          dailyCapacity: 40,
          riskThreshold: 90,
        };
      }

      return config.value as RiskConfig;
    } catch (error) {
      console.error('[DeliveryRiskService] Failed to fetch RISK_CONFIGURATION from database:', error);
      console.info('[DeliveryRiskService] Falling back to safe defaults.');
      return {
        dailyCapacity: 40,
        riskThreshold: 90,
      };
    }
  }

  async calculateProjectRisk(project: typeof projects.$inferSelect) {
    const config = await this.getRiskConfig();
    
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
    const totalAvailableCapacity = businessDays * config.dailyCapacity;
    
    const utilization = (project.remainingHours / totalAvailableCapacity) * 100;

    if (utilization > 100) return 'OVER_CAPACITY';
    if (utilization >= config.riskThreshold) return 'AT_RISK';
    
    return 'ON_TRACK';
  }

  async updateRiskConfig(newConfig: RiskConfig) {
    await db.insert(systemConfig).values({
      key: 'RISK_CONFIGURATION',
      value: newConfig,
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: newConfig, updatedAt: new Date() },
    });
  }
}
