"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { PeriodForecast } from "@/lib/risk-v2/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ForecastChartProps {
  periods: PeriodForecast[];
  riskThreshold: number;
  selectedPeriodKey: string | null;
  onSelectPeriod: (periodKey: string | null) => void;
}

export function ForecastChart({
  periods,
  riskThreshold,
  selectedPeriodKey,
  onSelectPeriod,
}: ForecastChartProps) {
  const chartData = periods.map((p) => ({
    periodKey: p.periodKey,
    label: p.label,
    demand: p.demandHours,
    capacity: p.netCapacityHours,
    utilisation: p.utilisationPercent,
    isOverloaded: p.isOverloaded,
    isAtRisk: p.isAtRisk,
    loadStatus: p.loadStatus,
    shortfallOrSurplus: p.shortfallOrSurplusHours,
    contributingCount: p.contributingProjects.length,
    topProjects: p.contributingProjects.slice(0, 3),
  }));

  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(d.demand, d.capacity)),
    100
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs" suppressHydrationWarning>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Forecast Demand vs. Workshop Net Capacity</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              Click period to filter breakdown
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic workload distribution based on active project deadlines, remaining hours, and workshop shifts.
          </p>
        </div>

        {selectedPeriodKey && (
          <button
            onClick={() => onSelectPeriod(null)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors self-start sm:self-auto"
          >
            Show All Periods
          </button>
        )}
      </div>

      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
            onClick={(state) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const key = state.activePayload[0].payload.periodKey;
                onSelectPeriod(selectedPeriodKey === key ? null : key);
              }
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-slate-200, #e2e8f0)"
              opacity={0.6}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
              interval={0}
              angle={periods.length > 8 ? -35 : 0}
              textAnchor={periods.length > 8 ? 'end' : 'middle'}
              dy={periods.length > 8 ? 8 : 4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              domain={[0, Math.ceil(maxVal * 1.15)]}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip content={<CustomTooltip riskThreshold={riskThreshold} />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
            />
            <Bar
              name="Forecast Demand (hrs)"
              dataKey="demand"
              radius={[6, 6, 0, 0]}
              maxBarSize={55}
              cursor="pointer"
            >
              {chartData.map((entry) => {
                const isSelected = selectedPeriodKey === entry.periodKey;
                let fillColor = '#3b82f6'; // default blue
                if (entry.isOverloaded) {
                  fillColor = '#ef4444'; // red overload (>100%)
                } else if (entry.isAtRisk) {
                  fillColor = '#f59e0b'; // amber at risk (90-100%)
                }

                return (
                  <Cell
                    key={entry.periodKey}
                    fill={fillColor}
                    opacity={selectedPeriodKey ? (isSelected ? 1 : 0.35) : 0.9}
                    stroke={isSelected ? '#0f172a' : undefined}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                );
              })}
            </Bar>
            <Line
              name="Net Available Capacity (hrs)"
              dataKey="capacity"
              type="monotone"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Period Quick Utilisation Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
        {periods.map((p) => {
          const isSelected = selectedPeriodKey === p.periodKey;
          return (
            <button
              key={p.periodKey}
              onClick={() => onSelectPeriod(isSelected ? null : p.periodKey)}
              className={`p-2 rounded-xl text-left border transition-all ${
                isSelected
                  ? 'border-brand bg-brand/5 dark:bg-brand/10 ring-2 ring-brand/20'
                  : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate uppercase">
                {p.label}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs font-bold ${
                  p.isOverloaded 
                    ? 'text-rose-600 dark:text-rose-400' 
                    : p.isAtRisk 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-slate-900 dark:text-white'
                }`}>
                  {p.utilisationPercent}%
                </span>
                {p.isOverloaded ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Overloaded (>100%)" />
                ) : p.isAtRisk ? (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="At Risk (Warning)" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Within Capacity" />
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                {p.shortfallOrSurplusHours >= 0
                  ? `+${Math.round(p.shortfallOrSurplusHours)}h`
                  : `${Math.round(p.shortfallOrSurplusHours)}h`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, riskThreshold }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isOver = data.isOverloaded;
    const isRisk = data.isAtRisk;

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl shadow-2xl border border-white/10 text-xs min-w-[250px] max-w-[320px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
          <span className="font-bold text-sm text-slate-100">{data.label}</span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[10px] ${
              isOver 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                : isRisk 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {isOver 
              ? `${data.utilisation}% Overloaded (>100%)` 
              : isRisk 
              ? `${data.utilisation}% At Risk (${riskThreshold}-100%)` 
              : `${data.utilisation}% Utilised`}
          </span>
        </div>

        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between">
            <span className="text-slate-400">Demand:</span>
            <span className="font-semibold text-blue-300">{Math.round(data.demand).toLocaleString()} hrs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Net Capacity:</span>
            <span className="font-semibold text-emerald-300">{Math.round(data.capacity).toLocaleString()} hrs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Surplus / Shortfall:</span>
            <span className={`font-semibold ${data.shortfallOrSurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.shortfallOrSurplus >= 0 ? `+${Math.round(data.shortfallOrSurplus)} hrs` : `${Math.round(data.shortfallOrSurplus)} hrs`}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 italic bg-white/5 p-1.5 rounded mb-2">
          Note: Distribution reflects demand timing across planning windows. Real feasibility depends on unconstrained factory capacity.
        </div>

        {data.topProjects && data.topProjects.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Top Contributors ({data.contributingCount} total)
            </div>
            <div className="space-y-1">
              {data.topProjects.map((p: any) => (
                <div key={p.projectId} className="flex justify-between items-center text-[11px]">
                  <span className="truncate max-w-[170px] text-slate-200">
                    <span className="text-slate-400 font-mono">#{p.projectNumber}</span> {p.projectName}
                  </span>
                  <span className="font-medium text-slate-300 ml-2">{Math.round(p.allocatedHours)}h</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}
