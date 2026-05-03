'use client';

import React from 'react';
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  Check,
  AlertTriangle,
  Activity,
  Clock,
  LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROCUREMENT_STATUSES, ProcurementRisk } from '@/lib/procurement-logic';
import { DateRangePicker } from '../ui/DateRangePicker';

interface FilterOption {
  label: string;
  value: string;
}

interface ProcurementFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (values: string[]) => void;
  wgStatusFilter: string[];
  onWgStatusFilterChange: (values: string[]) => void;
  riskFilter: string[];
  onRiskFilterChange: (values: string[]) => void;
  pmFilter: string[];
  onPmFilterChange: (values: string[]) => void;
  typeFilter: string[];
  onTypeFilterChange: (values: string[]) => void;
  options: {
    wgStatuses: string[];
    pms: string[];
    types: string[];
  };
  startDateRange: { start: string, end: string };
  onStartDateRangeChange: (start: string, end: string) => void;
  dueDateRange: { start: string, end: string };
  onDueDateRangeChange: (start: string, end: string) => void;
}

export function ProcurementFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  wgStatusFilter,
  onWgStatusFilterChange,
  riskFilter,
  onRiskFilterChange,
  pmFilter,
  onPmFilterChange,
  typeFilter,
  onTypeFilterChange,
  options,
  startDateRange,
  onStartDateRangeChange,
  dueDateRange,
  onDueDateRangeChange,
}: ProcurementFiltersProps) {
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const isFilterActive = statusFilter.length > 0 || wgStatusFilter.length > 0 || riskFilter.length > 0 || pmFilter.length > 0 || typeFilter.length > 0 || startDateRange.start || dueDateRange.start;

  const clearAll = () => {
    onStatusFilterChange([]);
    onWgStatusFilterChange([]);
    onRiskFilterChange([]);
    onPmFilterChange([]);
    onTypeFilterChange([]);
    onStartDateRangeChange('', '');
    onDueDateRangeChange('', '');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        {/* Search - Fixed Left */}
        <div className="relative w-full xl:w-80 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Project, Client, or ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-4 focus:ring-brand/5 focus:border-brand/30 outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filters - Wrapping Flex Layout */}
        <div className="flex-1 w-full">
          <div className="flex flex-wrap items-center gap-2 px-2">
            <MultiSelectDropdown 
              label="Risk"
              options={[
                { label: 'Delayed', value: 'DELAYED' },
                { label: 'At Risk', value: 'AT_RISK' },
                { label: 'On Track', value: 'ON_TRACK' },
                { label: 'Not Delivered', value: 'NOT_DELIVERED' }
              ]}
              selected={riskFilter}
              onChange={onRiskFilterChange}
              isOpen={openDropdown === 'risk'}
              onToggle={() => toggleDropdown('risk')}
              icon={AlertTriangle}
            />
            <MultiSelectDropdown 
              label="Procurement Status"
              options={PROCUREMENT_STATUSES.map(s => ({ label: s, value: s }))}
              selected={statusFilter}
              onChange={onStatusFilterChange}
              isOpen={openDropdown === 'status'}
              onToggle={() => toggleDropdown('status')}
              icon={Activity}
            />
            <MultiSelectDropdown 
              label="Project Status"
              options={options.wgStatuses.map(s => ({ label: s, value: s }))}
              selected={wgStatusFilter}
              onChange={onWgStatusFilterChange}
              isOpen={openDropdown === 'wgStatus'}
              onToggle={() => toggleDropdown('wgStatus')}
              icon={LayoutGrid}
            />
            <MultiSelectDropdown 
              label="Type"
              options={options.types.map(s => ({ label: s, value: s }))}
              selected={typeFilter}
              onChange={onTypeFilterChange}
              isOpen={openDropdown === 'type'}
              onToggle={() => toggleDropdown('type')}
            />

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

            <DateRangePicker 
              label="Start Date"
              startDate={startDateRange.start}
              endDate={startDateRange.end}
              onRangeChange={onStartDateRangeChange}
              className="shrink-0"
            />
            <DateRangePicker 
              label="Due Date"
              startDate={dueDateRange.start}
              endDate={dueDateRange.end}
              onRangeChange={onDueDateRangeChange}
              className="shrink-0"
            />
          </div>
        </div>

        {/* Clear Filters - Fixed Right */}
        {isFilterActive && (
          <div className="shrink-0 pl-2 border-l border-slate-100 dark:border-slate-800 ml-auto flex items-center">
            <button 
              onClick={clearAll}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all text-[11px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MultiSelectDropdown({ 
  label, 
  options, 
  selected, 
  onChange, 
  isOpen, 
  onToggle,
  icon: Icon
}: { 
  label: string; 
  options: FilterOption[]; 
  selected: string[]; 
  onChange: (values: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  icon?: any;
}) {
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-bold transition-all",
          selected.length > 0 
            ? "bg-brand/5 border-brand text-brand" 
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
        )}
      >
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {selected.length > 0 && (
          <span className="flex items-center justify-center bg-brand text-white rounded-full w-4 h-4 text-[9px]">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-[100] animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-2 max-h-64 overflow-y-auto scrollbar-thin">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
              >
                {opt.label}
                {selected.includes(opt.value) && <Check className="h-3 w-3 text-brand" />}
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => onChange([])}
                className="w-full py-1.5 text-[10px] font-bold text-brand uppercase tracking-wider hover:bg-brand/5 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
