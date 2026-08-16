"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AlertOctagon, Clock, CheckCircle2, ShieldAlert, Truck, PauseCircle, PlaneLanding, PlaneTakeoff, FlaskConical, TrendingUp } from "lucide-react";

export default function WorkshopBoard({ arrivals, inProgress, testing, departures, lastUpdatedText }: any) {
    const testingJobs = testing;
    const dispatchJobs = departures;

    const router = useRouter();

    useEffect(() => {
        const timer = setInterval(() => {
            router.refresh();
        }, 30000); // 30 seconds
        return () => clearInterval(timer);
    }, [router]);

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 text-slate-900 p-4 gap-4 overflow-hidden font-sans">
            {/* Top: Arrivals Strip */}
            <ArrivalsStrip arrivals={arrivals} lastUpdatedText={lastUpdatedText} />

            {/* Bottom Section */}
            <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
                {/* Left Column: Testing & Dispatch */}
                <div className="w-[calc(25%-30px)] shrink-0 flex flex-col gap-4 overflow-hidden">
                    <TestingList items={testingJobs} />
                    <DispatchList items={dispatchJobs} testingQueueEmpty={testingJobs.length === 0} />
                </div>

                {/* Right Area: Bay Grid */}
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 flex flex-col gap-4">
                        {/* Top Row: Odds right-to-left physically (23, 21, ... 1) */}
                        <div className="flex-1 flex gap-3">
                            {[23, 21, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1].map(bayNum => (
                                <Bay key={bayNum} number={bayNum} projects={inProgress[bayNum.toString()]} />
                            ))}
                        </div>
                        {/* Bottom Row: Evens right-to-left physically (24, 22, ... 2) */}
                        <div className="flex-1 flex gap-3">
                            {[24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2].map(bayNum => (
                                <Bay key={bayNum} number={bayNum} projects={inProgress[bayNum.toString()]} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ArrivalsStrip({ arrivals, lastUpdatedText }: { arrivals: any[], lastUpdatedText?: string }) {
    const [index, setIndex] = useState(0);
    const limit = 3;

    const sortedArrivals = useMemo(() => {
        const unique = [];
        const seen = new Set();
        for (const item of arrivals) {
            const key = `${item.projectNumber}-${item.supplierName}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        }

        return unique.sort((a, b) => {
            const getRiskLevel = (item: any) => {
                if (item.actionRequired?.toLowerCase().includes("escalate")) return 3;
                if (item.actionRequired?.toLowerCase().includes("follow up") || item.riskStatus?.toLowerCase().includes("delay")) return 2;
                return 1;
            };
            return getRiskLevel(b) - getRiskLevel(a);
        });
    }, [arrivals]);

    useEffect(() => {
        if (sortedArrivals.length <= limit) return;
        const timer = setInterval(() => {
            setIndex(prev => (prev + limit >= sortedArrivals.length ? 0 : prev + limit));
        }, 6000);
        return () => clearInterval(timer);
    }, [sortedArrivals.length]);

    if (sortedArrivals.length === 0) {
        return <div className="text-slate-400 font-bold text-center uppercase tracking-widest text-lg">No Incoming Deliveries</div>;
    }

    const visible = sortedArrivals.slice(index, index + limit);

    return (
        <div className="shrink-0 w-full flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                        <PlaneLanding className="w-6 h-6 text-slate-400" /> Arrivals
                    </h2>
                    {sortedArrivals.length > limit && (
                        <div className="flex justify-center gap-1.5 items-center">
                            {Array.from({ length: Math.ceil(sortedArrivals.length / limit) }).map((_, i) => (
                                <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === index / limit ? "bg-slate-400" : "bg-slate-200")} />
                            ))}
                        </div>
                    )}
                </div>
                {lastUpdatedText && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 px-3 py-1.5 rounded-full border border-slate-200/50">
                        <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                        Last Updated: {lastUpdatedText}
                    </div>
                )}
            </div>
            <div className="h-20 w-full overflow-hidden">
                <div className="flex flex-col h-full gap-2 w-full">
                    <div className="flex gap-4 w-full flex-1">
                        {visible.map((item, i) => {
                            let cardClass = "bg-white border-slate-200 shadow-sm";
                            let badgeClass = "bg-emerald-100 text-emerald-800";

                            if (item.actionRequired?.toLowerCase().includes("escalate")) {
                                badgeClass = "bg-red-100 text-red-800";
                            } else if (item.actionRequired?.toLowerCase().includes("follow up") || item.riskStatus?.toLowerCase().includes("delay")) {
                                badgeClass = "bg-amber-100 text-amber-800";
                            }

                            return (
                                <div key={i} className={cn("flex-1 rounded-xl px-3 py-2 flex flex-col justify-between overflow-hidden border", cardClass)}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs font-bold text-slate-500 truncate">{item.projectNumber}</span>
                                            <span className="font-bold text-sm truncate text-slate-900" title={item.projectName}>{item.projectName}</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5 items-end shrink-0">
                                            {item.deliveryDate && (
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                    DUE: {new Date(item.deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end mt-1">
                                        <span className="text-xs text-slate-600 truncate min-w-0 font-medium pr-2">{item.supplierName}</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">
                                                {item.expectedDate ? `ETA: ${new Date(item.expectedDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}` : 'No ETA'}
                                            </span>
                                            <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full", badgeClass)}>
                                                {item.riskStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TestingList({ items }: { items: any[] }) {
    const [index, setIndex] = useState(0);
    const limit = 2;

    useEffect(() => {
        if (items.length <= limit) return;
        const timer = setInterval(() => {
            setIndex(prev => (prev + limit >= items.length ? 0 : prev + limit));
        }, 5000);
        return () => clearInterval(timer);
    }, [items.length]);

    if (items.length === 0) {
        return (
            <div className="shrink-0 flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                        <FlaskConical className="w-6 h-6 text-slate-400" /> Testing Queue
                    </h2>
                </div>
                <div className="text-slate-400 font-bold text-center py-6 uppercase tracking-widest text-lg bg-slate-100/50 rounded-xl border border-slate-200/50">
                    No Jobs in Testing
                </div>
            </div>
        );
    }

    const visible = items.slice(index, index + limit);

    return (
        <div className="flex-[0.8] flex flex-col overflow-hidden min-h-0">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                    <FlaskConical className="w-6 h-6 text-slate-400" /> Testing Queue
                </h2>
                {items.length > limit && (
                    <div className="flex justify-center gap-1.5 items-center">
                        {Array.from({ length: Math.ceil(items.length / limit) }).map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === index / limit ? "bg-slate-400" : "bg-slate-200")} />
                        ))}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="flex flex-col h-full gap-2">
                    <div className="flex flex-col gap-3 flex-1">
                        {visible.map((item, i) => {
                            const isDefective = item.statusReason.includes("Defective");
                            const cardClass = "bg-white border-slate-200";
                            const badgeClass = isDefective ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";

                            return (
                                <div key={i} className={cn("flex flex-col p-3 rounded-xl border", cardClass)}>
                                    <div className="flex flex-col mb-2 min-w-0">
                                        <span className="font-black text-lg text-slate-900 truncate">{item.projectNumber}</span>
                                        <span className="text-sm text-slate-600 truncate">{item.projectName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
                                            badgeClass
                                        )}>
                                            {isDefective ? <AlertOctagon className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                            {item.statusReason}
                                        </span>
                                        {item.deliveryDate && (
                                            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                                                Due: {new Date(item.deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DispatchList({ items, testingQueueEmpty }: { items: any[], testingQueueEmpty: boolean }) {
    const [index, setIndex] = useState(0);
    const limit = 3;

    useEffect(() => {
        if (items.length <= limit) {
            setIndex(0); // Ensure index resets if limit changes and items fit
            return;
        }
        const timer = setInterval(() => {
            setIndex(prev => (prev + limit >= items.length ? 0 : prev + limit));
        }, 6000);
        return () => clearInterval(timer);
    }, [items.length, limit]);

    if (items.length === 0) {
        return (
            <div className="shrink-0 flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                        <PlaneTakeoff className="w-6 h-6 text-slate-400" /> Departures
                    </h2>
                </div>
                <div className="text-slate-400 font-bold text-center py-6 uppercase tracking-widest text-lg bg-slate-100/50 rounded-xl border border-slate-200/50">
                    Dispatch Empty
                </div>
            </div>
        );
    }

    const visible = items.slice(index, index + limit);

    return (
        <div className="flex-[1.2] flex flex-col overflow-hidden min-h-0">
            <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 flex items-center gap-2">
                    <PlaneTakeoff className="w-6 h-6 text-slate-400" /> Departures
                </h2>
                {items.length > limit && (
                    <div className="flex justify-center gap-1.5 items-center">
                        {Array.from({ length: Math.ceil(items.length / limit) }).map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === index / limit ? "bg-slate-400" : "bg-slate-200")} />
                        ))}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="flex flex-col h-full gap-2">
                    <div className="flex flex-col gap-3 flex-1">
                        {visible.map((item, i) => {
                            let cardClass = "bg-white border-slate-200";
                            let badgeClass = "bg-emerald-100 text-emerald-800";
                            let Icon = CheckCircle2;

                            if (item.classification === 'On Hold') {
                                badgeClass = "bg-slate-100 text-slate-800";
                                Icon = PauseCircle;
                            } else if (item.dateStatus === 'Overdue') {
                                badgeClass = "bg-red-100 text-red-800";
                                Icon = AlertOctagon;
                            } else if (item.dateStatus === 'Due soon') {
                                badgeClass = "bg-amber-100 text-amber-800";
                                Icon = Clock;
                            }

                            return (
                                <div key={i} className={cn("flex flex-col justify-center p-4 rounded-xl border", cardClass)}>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-black text-lg text-slate-900 truncate">{item.projectNumber}</span>
                                            <span className="text-sm text-slate-600 truncate">{item.projectName}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider truncate font-medium">{item.statusReason}</span>
                                                {item.deliveryDate && (
                                                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                                                        Due: {new Date(item.deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0", badgeClass)}>
                                            <Icon className="w-3.5 h-3.5 shrink-0" />
                                            <span className="whitespace-nowrap">
                                                {item.classification === 'On Hold' ? 'On Hold' : item.dateStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Bay({ number, projects }: { number: number, projects: any[] }) {
    const [pageIdx, setPageIdx] = useState(0);

    const isEmpty = !projects || projects.length === 0;
    const totalJobs = isEmpty ? 0 : projects.length;
    const itemsPerPage = 3;
    const totalPages = Math.ceil(totalJobs / itemsPerPage);

    useEffect(() => {
        if (totalPages <= 1) return;
        const timer = setInterval(() => {
            setPageIdx(prev => (prev + 1 >= totalPages ? 0 : prev + 1));
        }, 8000 + (number * 100)); // offset so they don't sync
        return () => clearInterval(timer);
    }, [totalPages, number]);

    const hasCritical = !isEmpty && projects.some(p => p.priority === 'Critical');
    const hasOverdueProgress = !isEmpty && projects.some(p => p.progressPercent > 100);

    const visibleProjects = !isEmpty ? projects.slice(pageIdx * itemsPerPage, (pageIdx + 1) * itemsPerPage) : [];

    return (
        <div className={cn(
            "flex-1 flex flex-col rounded-xl overflow-hidden relative shadow-sm transition-colors duration-500 border border-slate-200",
            isEmpty ? "bg-slate-100" : "bg-white"
        )}>
            {/* Bay Header */}
            <div className={cn(
                "px-2 py-1.5 border-b border-slate-200 flex justify-between items-center shrink-0",
                isEmpty ? "bg-slate-100/50" : "bg-slate-50"
            )}>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bay {number}</span>
                </div>
            </div>

            {/* Bay Content */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {isEmpty ? (
                    <div className="flex-1 flex items-center justify-center pb-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                            Empty
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col h-full justify-between animate-in fade-in zoom-in-95 duration-300 min-w-0">
                        <div className="flex flex-col flex-1 min-h-0">
                            {visibleProjects.map((p, idx) => (
                                <div key={`${p.projectNumber}-${idx}`} className={cn(
                                    "flex flex-col flex-1 px-2 py-1.5 border-b border-[#c0c0c0] last:border-b-0",
                                    p.priority === 'Critical' ? "bg-red-50" : ""
                                )}>
                                    <span className="font-black text-slate-900 text-base leading-tight truncate" title={p.projectNumber}>
                                        {p.projectNumber}
                                        {p.priority === 'Critical' && <span className="text-red-600 ml-1 text-xs">●</span>}
                                    </span>
                                    <span className="font-medium text-slate-500 text-xs line-clamp-2 leading-tight mt-0.5" title={p.projectName}>
                                        {p.projectName}
                                    </span>
                                    
                                    {p.deliveryDate ? (
                                        <div className="mt-1">
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                                Due: {new Date(p.deliveryDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="mt-1 h-[15px]" />
                                    )}
                                    
                                    <div className="flex flex-col w-full mt-auto pt-2">
                                        <div className="flex justify-end mb-1">
                                            <span className={cn(
                                                "text-sm font-black tabular-nums leading-none",
                                                p.progressPercent > 100 ? "text-red-600" : "text-slate-700"
                                            )}>
                                                {Math.round(p.progressPercent)}%
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000", p.progressPercent > 100 ? "bg-red-500" : "bg-emerald-500")}
                                                style={{ width: `${Math.min(p.progressPercent, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-1.5 pb-2 shrink-0">
                                {Array.from({ length: totalPages }).map((_, i) => (
                                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === pageIdx ? "bg-slate-500" : "bg-slate-200")} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
