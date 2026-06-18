"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AlertOctagon, Clock, CheckCircle2, ShieldAlert, Truck, PauseCircle } from "lucide-react";

export default function WorkshopBoard({ arrivals, inProgress, departures }: any) {
    const testingJobs = departures.filter((d: any) => d.classification === 'Blocked');
    testingJobs.sort((a: any, b: any) => a.statusReason.includes('Defective') ? -1 : 1);
    
    const dispatchJobs = departures.filter((d: any) => d.classification === 'Ready' || d.classification === 'On Hold');

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 text-slate-900 p-4 gap-4 overflow-hidden font-sans">
            {/* Top: Arrivals Strip */}
            <div className="h-28 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col justify-center overflow-hidden">
                <ArrivalsStrip arrivals={arrivals} />
            </div>

            {/* Bottom Section */}
            <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
                {/* Left Column: Testing & Dispatch - Narrower (25%) */}
                <div className="w-1/4 flex flex-col gap-4 overflow-hidden">
                    {/* Testing Section */}
                    <div className="flex-[0.8] bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col overflow-hidden min-h-0">
                        <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 mb-4 shrink-0 flex items-center gap-2">
                            <ShieldAlert className="w-6 h-6 text-slate-400" /> Testing Queue
                        </h2>
                        <div className="flex-1 overflow-hidden">
                            <TestingList items={testingJobs} />
                        </div>
                    </div>

                    {/* Dispatch Section */}
                    <div className="flex-[1.2] bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col overflow-hidden min-h-0">
                        <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 mb-4 shrink-0 flex items-center gap-2">
                            <Truck className="w-6 h-6 text-slate-400" /> Dispatch
                        </h2>
                        <div className="flex-1 overflow-hidden">
                            <DispatchList items={dispatchJobs} />
                        </div>
                    </div>
                </div>

                {/* Right Area: Bay Grid - Wider (75%) */}
                <div className="w-3/4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col overflow-hidden min-h-0">
                    <h2 className="text-xl font-bold tracking-widest uppercase text-slate-500 mb-4 shrink-0">
                        Workshop Floor
                    </h2>
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

function ArrivalsStrip({ arrivals }: { arrivals: any[] }) {
    const [index, setIndex] = useState(0);
    const limit = 4;

    const sortedArrivals = useMemo(() => {
        return [...arrivals].sort((a, b) => {
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
        <div className="flex gap-4 w-full h-full">
            {visible.map((item, i) => {
                let cardClass = "bg-emerald-50 border-emerald-100";
                let badgeClass = "bg-white text-emerald-700";
                
                if (item.actionRequired?.toLowerCase().includes("escalate")) {
                    cardClass = "bg-red-50 border-red-100";
                    badgeClass = "bg-white text-red-700";
                } else if (item.actionRequired?.toLowerCase().includes("follow up") || item.riskStatus?.toLowerCase().includes("delay")) {
                    cardClass = "bg-amber-50 border-amber-100";
                    badgeClass = "bg-white text-amber-700";
                }

                return (
                    <div key={i} className={cn("flex-1 rounded-xl p-4 flex flex-col justify-between overflow-hidden border", cardClass)}>
                        <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-xl truncate text-slate-900" title={item.projectName}>{item.projectName}</span>
                            <span className="text-sm font-bold px-2 py-1 bg-white/60 text-slate-700 rounded-full uppercase tracking-wider whitespace-nowrap">
                                {item.expectedDate ? new Date(item.expectedDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }) : 'No ETA'}
                            </span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-base text-slate-600 truncate max-w-[60%] font-medium">{item.supplierName}</span>
                            <span className={cn("text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full", badgeClass)}>
                                {item.riskStatus}
                            </span>
                        </div>
                    </div>
                );
            })}
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
        return <div className="text-slate-400 font-bold text-center h-full flex items-center justify-center uppercase tracking-widest text-lg">No Jobs in Testing</div>;
    }

    const visible = items.slice(index, index + limit);

    return (
        <div className="flex flex-col gap-3 h-full justify-center">
            {visible.map((item, i) => {
                const isDefective = item.statusReason.includes("Defective");
                const cardClass = isDefective ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100";
                const badgeClass = isDefective ? "bg-white text-red-700" : "bg-white text-amber-700";

                return (
                    <div key={i} className={cn("flex flex-col p-4 rounded-xl border", cardClass)}>
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-bold text-xl text-slate-900 truncate">{item.projectName}</span>
                            <span className="text-sm text-slate-500 font-mono ml-2 shrink-0">{item.projectNumber}</span>
                        </div>
                        <div className="flex items-center">
                            <span className={cn(
                                "flex items-center gap-2 text-sm font-bold uppercase tracking-widest px-3 py-1.5 rounded-full",
                                badgeClass
                            )}>
                                {isDefective ? <AlertOctagon className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                {item.statusReason}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DispatchList({ items }: { items: any[] }) {
    const [index, setIndex] = useState(0);
    const limit = 4;

    useEffect(() => {
        if (items.length <= limit) return;
        const timer = setInterval(() => {
            setIndex(prev => (prev + limit >= items.length ? 0 : prev + limit));
        }, 6000);
        return () => clearInterval(timer);
    }, [items.length]);

    if (items.length === 0) {
        return <div className="text-slate-400 font-bold text-center h-full flex items-center justify-center uppercase tracking-widest text-lg">Dispatch Empty</div>;
    }

    const visible = items.slice(index, index + limit);

    return (
        <div className="flex flex-col gap-3 h-full justify-center">
            {visible.map((item, i) => {
                let cardClass = "bg-emerald-50 border-emerald-100";
                let badgeClass = "bg-white text-emerald-700";
                let Icon = CheckCircle2;
                
                if (item.classification === 'On Hold') {
                    cardClass = "bg-slate-50 border-slate-200";
                    badgeClass = "bg-white text-slate-700";
                    Icon = PauseCircle;
                } else if (item.dateStatus === 'Overdue') {
                    cardClass = "bg-red-50 border-red-200";
                    badgeClass = "bg-white text-red-700";
                    Icon = AlertOctagon;
                } else if (item.dateStatus === 'Due soon') {
                    cardClass = "bg-amber-50 border-amber-100";
                    badgeClass = "bg-white text-amber-700";
                    Icon = Clock;
                }

                return (
                    <div key={i} className={cn("flex flex-col justify-center p-4 rounded-xl border", cardClass)}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-xl text-slate-900 truncate">{item.projectName}</span>
                                <span className="text-sm text-slate-600 uppercase tracking-wider truncate font-medium">{item.statusReason}</span>
                            </div>
                            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0 shadow-sm", badgeClass)}>
                                <Icon className="w-5 h-5 shrink-0" />
                                <span className="text-sm font-bold uppercase tracking-widest whitespace-nowrap">
                                    {item.classification === 'On Hold' ? 'On Hold' : item.dateStatus}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Bay({ number, projects }: { number: number, projects: any[] }) {
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (!projects || projects.length <= 1) return;
        const timer = setInterval(() => {
            setIdx(prev => (prev + 1 >= projects.length ? 0 : prev + 1));
        }, 4000 + (number * 100)); // offset so they don't sync
        return () => clearInterval(timer);
    }, [projects?.length, number]);

    const isEmpty = !projects || projects.length === 0;
    const p = !isEmpty ? projects[idx] : null;

    return (
        <div className={cn(
            "flex-1 flex flex-col rounded-xl overflow-hidden relative border shadow-sm transition-colors duration-500",
            isEmpty ? "bg-slate-50/50 border-slate-100" : (p.progressPercent > 100 ? "bg-red-50 border-red-200" : "bg-white border-slate-200")
        )}>
            {/* Bay Header */}
            <div className={cn(
                "px-2 py-1.5 border-b flex justify-between items-center shrink-0",
                isEmpty ? "bg-slate-100/50 border-slate-100" : (p.progressPercent > 100 ? "bg-red-100/50 border-red-200" : "bg-slate-50 border-slate-200")
            )}>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bay {number}</span>
                {!isEmpty && projects.length > 1 && (
                    <div className="flex gap-1.5">
                        {projects.map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === idx ? "bg-slate-800" : "bg-slate-300")} />
                        ))}
                    </div>
                )}
            </div>

            {/* Bay Content */}
            <div className="flex-1 flex flex-col justify-center p-2 relative overflow-hidden">
                {isEmpty ? (
                    <div className="text-center text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">
                        Empty
                    </div>
                ) : (
                    <div className="flex flex-col h-full justify-between animate-in fade-in zoom-in-95 duration-300 min-w-0">
                        <span className="font-bold text-sm text-slate-900 truncate" title={p.projectName}>
                            {p.projectName}
                        </span>
                        
                        <div className="mt-2 flex flex-col gap-1 w-full">
                            <div className="flex justify-end">
                                <span className={cn(
                                    "text-base font-black tracking-tighter tabular-nums shrink-0 leading-none",
                                    p.progressPercent > 100 ? "text-red-700 bg-white px-1.5 py-0.5 rounded-md shadow-sm" : "text-slate-700"
                                )}>
                                    {Math.round(p.progressPercent)}%
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={cn("h-full rounded-full transition-all duration-1000", p.progressPercent > 100 ? "bg-red-500" : "bg-emerald-500")}
                                    style={{ width: `${Math.min(p.progressPercent, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
