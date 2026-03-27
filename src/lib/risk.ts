import { db } from '@/db';
import { systemConfig, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface RiskConfig {
  capacityPerDay: number; // Total business capacity (hours)
  highRiskThreshold: number; // e.g. 0.9 (90% capacity utilized)
  mediumRiskThreshold: number; // e.g. 0.7
  stuckThresholdDays: number; // Days in same stage to be considered "stuck"
}

export class DeliveryRiskService {
  async getRiskConfig(): Promise<RiskConfig> {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'RISK_CONFIGURATION'),
    });

    return (config?.value as RiskConfig) || {
      capacityPerDay: 40, // Default 5 workers * 8h
      highRiskThreshold: 0.9,
      mediumRiskThreshold: 0.7,
      stuckThresholdDays: 10,
    };
  }

  async calculateProjectRisk(project: typeof projects.$inferSelect) {
    const config = await this.getRiskConfig();
    
    if (!project.deliveryDate || project.remainingHours <= 0) {
      return 'ON_TRACK';
    }

    const today = new Date();
    const deliveryDate = new Date(project.deliveryDate);
    
    // Calculate business days remaining (simplified)
    const diffTime = deliveryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return 'DELAYED';
    }

    // Business days (approx 5/7)
    const businessDays = Math.ceil(diffDays * (5 / 7));
    const totalAvailableCapacity = businessDays * config.capacityPerDay;
    
    const utilization = project.remainingHours / totalAvailableCapacity;

    if (utilization >= config.highRiskThreshold) return 'HIGH_RISK';
    if (utilization >= config.mediumRiskThreshold) return 'MEDIUM_RISK';
    
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
