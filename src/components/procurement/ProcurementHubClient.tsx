"use client";

import { useState, useMemo } from "react";
import { ProcurementDashboardItem, BackorderItem, SupplierRiskItem } from "@/app/actions/procurement";
import { ProcurementSummaryCards } from "./ProcurementSummaryCards";
import { ProcurementProjectList } from "./ProcurementProjectList";
import { BackorderTable } from "./BackorderTable";
import { SupplierRiskTable } from "./SupplierRiskTable";
import { ProcurementExportButton } from "./ProcurementExportButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Package, Users, HelpCircle, Search, X, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcurementHubClientProps {
  initialProjectData: ProcurementDashboardItem[];
  initialBackorderData: BackorderItem[];
  initialSupplierData: SupplierRiskItem[];
  summary: any;
}

type SortOrder = 'asc' | 'desc';

export function ProcurementHubClient({ 
    initialProjectData, 
    initialBackorderData, 
    initialSupplierData, 
    summary 
}: ProcurementHubClientProps) {
  const [activeTab, setActiveTab] = useState("projects");
  const [backorderFilter, setBackorderFilter] = useState("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  
  // Search & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; order: SortOrder }>({ key: 'action', order: 'asc' });

  // Handle metric clicks from summary cards
  const handleMetricClick = (tab: string, filter?: string) => {
    setActiveTab(tab);
    if (filter) setBackorderFilter(filter);
    if (tab === 'suppliers') setSupplierFilter(null);
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
        key,
        order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter & Sort Logic
  const processedProjects = useMemo(() => {
    let filtered = initialProjectData.filter(p => 
        p.projectNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
        const order = sortConfig.order === 'asc' ? 1 : -1;
        if (sortConfig.key === 'action') return (a.action.severity - b.action.severity) * order;
        if (sortConfig.key === 'projectNumber') return a.projectNumber.localeCompare(b.projectNumber) * order;
        if (sortConfig.key === 'progress') return ((a.stats.totalReceived / a.stats.totalOrdered) - (b.stats.totalReceived / b.stats.totalOrdered)) * order;
        if (sortConfig.key === 'deliveryDate') {
            if (!a.deliveryDate) return 1;
            if (!b.deliveryDate) return -1;
            return (new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()) * order;
        }
        return 0;
    });
  }, [initialProjectData, searchQuery, sortConfig]);

  const processedBackorders = useMemo(() => {
    let filtered = initialBackorderData.filter(b => 
        b.projectNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.materialName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (supplierFilter) {
        filtered = filtered.filter(b => b.supplierName === supplierFilter);
    }

    if (backorderFilter === 'PROBLEMS') {
        filtered = filtered.filter(b => b.action.severity < 4);
    } else if (backorderFilter !== 'ALL') {
        filtered = filtered.filter(b => b.action.type === backorderFilter);
    }

    return filtered.sort((a, b) => {
        const order = sortConfig.order === 'asc' ? 1 : -1;
        if (sortConfig.key === 'action') return (a.action.severity - b.action.severity) * order;
        if (sortConfig.key === 'materialName') return a.materialName.localeCompare(b.materialName) * order;
        if (sortConfig.key === 'projectName') return a.projectName.localeCompare(b.projectName) * order;
        if (sortConfig.key === 'supplierName') return a.supplierName.localeCompare(b.supplierName) * order;
        if (sortConfig.key === 'quantity') return ((a.receivedQuantity / a.quantity) - (b.receivedQuantity / b.quantity)) * order;
        if (sortConfig.key === 'expectedDate') {
            if (!a.expectedDate) return 1;
            if (!b.expectedDate) return -1;
            return (new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime()) * order;
        }
        return 0;
    });
  }, [initialBackorderData, backorderFilter, supplierFilter, searchQuery, sortConfig]);

  const processedSuppliers = useMemo(() => {
    let filtered = initialSupplierData.filter(s => 
        s.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
        const order = sortConfig.order === 'asc' ? 1 : -1;
        if (sortConfig.key === 'supplierName') return a.supplierName.localeCompare(b.supplierName) * order;
        if (sortConfig.key === 'affectedProjectCount') return (a.affectedProjectCount - b.affectedProjectCount) * order;
        return 0;
    });
  }, [initialSupplierData, searchQuery, sortConfig]);

  // Handle supplier click from other tabs
  const handleSupplierTrace = (name: string) => {
    setSupplierFilter(name);
    setBackorderFilter("ALL");
    setActiveTab("backorders");
    setSearchQuery(""); // Clear search when tracing supplier
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full px-4 md:px-8">
      <ProcurementSummaryCards summary={summary} onMetricClick={handleMetricClick} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex items-center gap-6">
                <TabsList className="bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50 h-12">
                    <TabsTrigger value="projects" className="gap-2.5 px-6 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md text-[11px] font-bold uppercase tracking-widest transition-all">
                        <LayoutGrid className="h-4 w-4" />
                        Projects
                    </TabsTrigger>
                    <TabsTrigger value="backorders" className="gap-2.5 px-6 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md text-[11px] font-bold uppercase tracking-widest transition-all">
                        <Package className="h-4 w-4" />
                        Backorders
                    </TabsTrigger>
                    <TabsTrigger value="suppliers" className="gap-2.5 px-6 h-full rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md text-[11px] font-bold uppercase tracking-widest transition-all">
                        <Users className="h-4 w-4" />
                        Suppliers
                    </TabsTrigger>
                </TabsList>
                
                {supplierFilter && (
                    <div className="flex items-center gap-3 px-4 h-10 bg-brand/5 border border-brand/10 rounded-xl animate-in zoom-in-95 duration-200">
                        <span className="text-[10px] font-bold text-brand uppercase tracking-widest">TRACING: {supplierFilter}</span>
                        <button 
                            onClick={() => setSupplierFilter(null)}
                            className="text-brand hover:text-brand/80 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Global Search & Export */}
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-[400px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Search by Project, Supplier, PO or Material..."
                        className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all text-sm font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <ProcurementExportButton 
                    activeTab={activeTab}
                    filters={{
                        query: searchQuery,
                        backorderFilter,
                        supplierFilter,
                        sortKey: sortConfig.key,
                        sortOrder: sortConfig.order
                    }}
                />
            </div>
        </div>

        <TabsContent value="projects" className="mt-0 focus-visible:outline-none">
            <ProcurementProjectList 
                items={processedProjects} 
                onSort={handleSort}
                sortKey={sortConfig.key}
                sortOrder={sortConfig.order}
            />
        </TabsContent>

        <TabsContent value="backorders" className="mt-0 focus-visible:outline-none">
            <BackorderTable 
                items={processedBackorders} 
                activeFilter={backorderFilter}
                onFilterChange={setBackorderFilter}
                onSupplierClick={handleSupplierTrace}
                onSort={handleSort}
                sortKey={sortConfig.key}
                sortOrder={sortConfig.order}
            />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-0 focus-visible:outline-none">
            <SupplierRiskTable 
                items={processedSuppliers} 
                onSupplierClick={handleSupplierTrace}
                onSort={handleSort}
                sortKey={sortConfig.key}
                sortOrder={sortConfig.order}
            />
        </TabsContent>
      </Tabs>

      {/* Operational Guide */}
      <div className="mt-8 p-10 bg-slate-900 text-white rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <Activity className="h-40 w-40" />
        </div>
        
        <div className="flex items-center gap-3 mb-12">
            <HelpCircle className="h-5 w-5 text-brand" />
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-slate-400">
                Operational Definitions & Actions
            </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-100">Delivery Risk</h4>
            </div>
            <div className="space-y-1">
                <p className="text-[13px] font-medium text-slate-400 leading-relaxed">
                    Supplier ETA exceeds project delivery target.
                </p>
                <p className="text-[13px] font-bold text-white uppercase tracking-tight pt-2">
                    Action: Escalate with supplier to pull forward.
                </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-100">Supplier Delay</h4>
            </div>
            <div className="space-y-1">
                <p className="text-[13px] font-medium text-slate-400 leading-relaxed">
                    Expected delivery date has passed without receipt.
                </p>
                <p className="text-[13px] font-bold text-white uppercase tracking-tight pt-2">
                    Action: Immediate follow-up for status update.
                </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]" />
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-100">Missing ETA</h4>
            </div>
            <div className="space-y-1">
                <p className="text-[13px] font-medium text-slate-400 leading-relaxed">
                    Order exists but no delivery date has been confirmed.
                </p>
                <p className="text-[13px] font-bold text-white uppercase tracking-tight pt-2">
                    Action: Request explicit delivery date from supplier.
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
