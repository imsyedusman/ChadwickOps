import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  SquarePen as EditIcon, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  ShoppingCart, 
  Clock,
  MessageSquare,
  AlertCircle,
  Search,
  Check,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSydneyDate } from '@/lib/project-logic';
import { PROCUREMENT_STATUSES, SUPPLIER_DELIVERY_STATUSES } from '@/lib/procurement-logic';
import { addSupplier, updateSupplier, deleteSupplier, addMasterSupplier, updateProjectProcurement } from '@/app/actions/procurement';
import { useRouter } from 'next/navigation';

interface MasterSupplier {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  supplierName: string;
  masterSupplierId: number | null;
  materialType: string;
  orderDate: Date | string | null;
  expectedDeliveryDate: Date | string | null;
  deliveryStatus: string | null;
  notes: string | null;
}

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: number;
    projectNumber: string;
    name: string;
    procurementStatus: string | null;
    procurementNotes: string | null;
    suppliers: Supplier[];
    client?: { name: string };
  };
  masterSuppliers: MasterSupplier[];
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const LABEL_STYLE = "text-xs font-medium text-slate-600 mb-1.5 block";
const INPUT_BASE = "w-full h-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-brand/5 focus:border-brand/30 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-normal";
const SECTION_TITLE = "text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-4 flex items-center gap-2";

export function SupplierModal({ isOpen, onClose, project, masterSuppliers }: SupplierModalProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(project.suppliers);
  const [localMasterSuppliers, setLocalMasterSuppliers] = useState<MasterSupplier[]>(masterSuppliers);
  
  const [newSupplier, setNewSupplier] = useState({
    supplierName: '',
    masterSupplierId: null as number | null,
    materialType: 'Other',
    deliveryStatus: 'Ordered',
    expectedDeliveryDate: ''
  });

  const [projectForm, setProjectForm] = useState({
    status: project.procurementStatus || '',
    notes: project.procurementNotes || ''
  });

  useEffect(() => {
    setLocalSuppliers(project.suppliers);
  }, [project.suppliers]);

  useEffect(() => {
    setLocalMasterSuppliers(masterSuppliers);
  }, [masterSuppliers]);

  if (!isOpen) return null;

  const handleUpdateProject = async () => {
    const res = await updateProjectProcurement(project.id, {
      procurementStatus: projectForm.status,
      procurementNotes: projectForm.notes
    });
    if (res.success) {
      router.refresh();
    }
  };

  const handleAdd = async () => {
    if (!newSupplier.supplierName) return;
    
    const normalizedName = normalizeName(newSupplier.supplierName);
    let masterId = newSupplier.masterSupplierId;
    
    if (!masterId) {
        const resMaster = await addMasterSupplier(normalizedName);
        if (resMaster.success) {
            masterId = resMaster.id as number;
            setLocalMasterSuppliers(prev => [...prev, { id: masterId!, name: normalizedName }]);
        }
    }

    const res = await addSupplier(project.id, {
      ...newSupplier,
      supplierName: normalizedName,
      masterSupplierId: masterId,
      expectedDeliveryDate: newSupplier.expectedDeliveryDate ? new Date(newSupplier.expectedDeliveryDate) : null
    });
    
    if (res.success) {
      const addedSupplier: Supplier = {
        id: res.id as number,
        supplierName: normalizedName,
        masterSupplierId: masterId,
        materialType: newSupplier.materialType,
        orderDate: new Date(),
        expectedDeliveryDate: newSupplier.expectedDeliveryDate ? new Date(newSupplier.expectedDeliveryDate) : null,
        deliveryStatus: newSupplier.deliveryStatus,
        notes: ''
      };
      setLocalSuppliers(prev => [addedSupplier, ...prev]);
      setIsAdding(false);
      setNewSupplier({ supplierName: '', masterSupplierId: null, materialType: 'Other', deliveryStatus: 'Ordered', expectedDeliveryDate: '' });
      router.refresh();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-2xl">
              <EditIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-brand/5 text-brand text-[11px] font-black uppercase tracking-widest">{project.projectNumber}</span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{project.name}</h2>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-1">{project.client?.name || 'No Client'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-50/30 dark:bg-slate-950/30">
          
          {/* Project Overview Section */}
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-10 py-8 border-b border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className={SECTION_TITLE}>Project Overview</h3>
            <div className="grid grid-cols-[1.5fr_1fr] gap-x-6 gap-y-5">
              <div className="space-y-1">
                <label className={LABEL_STYLE}>Procurement Status</label>
                <select 
                  value={projectForm.status}
                  onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                  className={INPUT_BASE}
                >
                  <option value="">Select Status</option>
                  {PROCUREMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1 col-span-1">
                <label className={LABEL_STYLE}>Notes Preview</label>
                <input 
                  type="text"
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                  placeholder="Key operational details..."
                  className={INPUT_BASE}
                />
              </div>
            </div>
          </div>

          <div className="px-10 py-10 space-y-10">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <h3 className={SECTION_TITLE}>Supplier Delivery Records</h3>
              {!isAdding && (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-xs font-black rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/10 active:scale-95 uppercase tracking-widest"
                >
                  <Plus className="h-4 w-4" />
                  Add Supplier
                </button>
              )}
            </div>

            {/* Add Supplier Card */}
            {isAdding && (
              <div className="bg-white dark:bg-slate-900 border-2 border-brand/20 rounded-3xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-bold text-brand">New Delivery Entry</h4>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="grid grid-cols-[1.5fr_1fr] gap-x-6 gap-y-5">
                  <div>
                    <label className={LABEL_STYLE}>Supplier Name</label>
                    <SupplierSearchableSelect 
                      options={localMasterSuppliers}
                      value={newSupplier.masterSupplierId}
                      onSelect={(id, name) => setNewSupplier({ ...newSupplier, masterSupplierId: id, supplierName: name })}
                    />
                  </div>
                  <div>
                    <label className={LABEL_STYLE}>Material Type</label>
                    <select 
                      value={newSupplier.materialType} 
                      onChange={(e) => setNewSupplier({ ...newSupplier, materialType: e.target.value })}
                      className={INPUT_BASE}
                    >
                      <option value="SM">Sheetmetal (SM)</option>
                      <option value="SG">Switchgear (SG)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_STYLE}>Expected Delivery</label>
                    <input 
                      type="date" 
                      value={newSupplier.expectedDeliveryDate} 
                      onChange={(e) => setNewSupplier({ ...newSupplier, expectedDeliveryDate: e.target.value })}
                      className={INPUT_BASE}
                    />
                  </div>
                  <div>
                    <label className={LABEL_STYLE}>Initial Status</label>
                    <select 
                      value={newSupplier.deliveryStatus} 
                      onChange={(e) => setNewSupplier({ ...newSupplier, deliveryStatus: e.target.value })}
                      className={INPUT_BASE}
                    >
                      {SUPPLIER_DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAdd}
                    className="px-6 py-2.5 bg-emerald-500 text-white text-xs font-black rounded-xl hover:bg-emerald-600 transition-all uppercase tracking-widest shadow-md"
                  >
                    Save Entry
                  </button>
                </div>
              </div>
            )}

            {/* Records List */}
            <div className="space-y-6">
              {localSuppliers.map(s => (
                <SupplierCard 
                  key={s.id} 
                  supplier={s} 
                  masterSuppliers={localMasterSuppliers} 
                  onOptimisticUpdate={(id, updated) => setLocalSuppliers(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item))}
                  onOptimisticDelete={(id) => setLocalSuppliers(prev => prev.filter(item => item.id !== id))}
                />
              ))}
              {localSuppliers.length === 0 && (
                <div className="py-24 flex flex-col items-center gap-4 opacity-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                  <AlertCircle className="h-16 w-16 text-slate-400" />
                  <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-500">No records found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950 shrink-0">
          <p className="text-xs font-bold text-slate-400">
            {localSuppliers.length} Total Records
          </p>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              Close
            </button>
            <button 
              onClick={handleUpdateProject}
              className="px-8 py-3 bg-brand text-white text-xs font-black rounded-xl hover:bg-brand/90 transition-all shadow-xl shadow-brand/20 uppercase tracking-widest flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Update Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupplierSearchableSelect({ options, value, onSelect }: { options: MasterSupplier[], value: number | null, onSelect: (id: number | null, name: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(o => o.id === value);
    const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(INPUT_BASE, "text-left flex items-center justify-between")}
            >
                <span className={cn("truncate", !selectedOption && "text-slate-400 font-normal")}>
                    {selectedOption ? selectedOption.name : "Select Supplier..."}
                </span>
                <Search className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[120] overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <input 
                            autoFocus
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-lg px-3 py-2 text-sm font-bold outline-none"
                        />
                    </div>
                    <div className="max-h-56 overflow-y-auto scrollbar-thin p-1">
                        {filtered.map(o => (
                            <button
                                key={o.id}
                                onClick={() => { onSelect(o.id, o.name); setIsOpen(false); setSearch(""); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-bold text-slate-700 transition-colors"
                            >
                                {o.name}
                                {value === o.id && <Check className="h-4 w-4 text-brand" />}
                            </button>
                        ))}
                        {search && !options.some(o => o.name.toLowerCase() === search.toLowerCase().trim()) && (
                            <button
                                onClick={() => { onSelect(null, normalizeName(search)); setIsOpen(false); setSearch(""); }}
                                className="w-full text-left px-4 py-3 rounded-lg hover:bg-brand/5 text-sm font-bold text-brand transition-colors flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Add "{normalizeName(search)}"
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function SupplierCard({ supplier, masterSuppliers, onOptimisticUpdate, onOptimisticDelete }: { supplier: Supplier, masterSuppliers: MasterSupplier[], onOptimisticUpdate: (id: number, updated: Partial<Supplier>) => void, onOptimisticDelete: (id: number) => void }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(supplier);

  const handleUpdate = async () => {
    const normalizedName = normalizeName(form.supplierName);
    let masterId = form.masterSupplierId;
    
    if (!masterId && normalizedName !== supplier.supplierName) {
        const resMaster = await addMasterSupplier(normalizedName);
        if (resMaster.success) masterId = resMaster.id as number;
    }

    onOptimisticUpdate(supplier.id, { 
        ...form, 
        supplierName: normalizedName,
        expectedDeliveryDate: form.expectedDeliveryDate ? new Date(form.expectedDeliveryDate) : null 
    });
    setIsEditing(false);

    const res = await updateSupplier(supplier.id, {
      ...form,
      supplierName: normalizedName,
      masterSupplierId: masterId,
      expectedDeliveryDate: form.expectedDeliveryDate ? new Date(form.expectedDeliveryDate) : null,
      orderDate: form.orderDate ? new Date(form.orderDate) : null
    });
    if (res.success) router.refresh();
  };

  const handleDelete = async () => {
    if (confirm("Delete this record?")) {
      onOptimisticDelete(supplier.id);
      const res = await deleteSupplier(supplier.id);
      if (res.success) router.refresh();
    }
  };

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-all duration-300",
      isEditing ? "ring-2 ring-brand border-brand shadow-xl" : "hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
    )}>
      <div className="flex flex-col gap-6">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <div className="grid grid-cols-[1.5fr_1fr] gap-4">
                <div>
                    <label className={LABEL_STYLE}>Supplier</label>
                    <SupplierSearchableSelect 
                        options={masterSuppliers}
                        value={form.masterSupplierId}
                        onSelect={(id, name) => setForm({ ...form, masterSupplierId: id, supplierName: name })}
                    />
                </div>
                <div>
                    <label className={LABEL_STYLE}>Type</label>
                    <select value={form.materialType} onChange={e => setForm({ ...form, materialType: e.target.value })} className={INPUT_BASE}>
                        <option value="SM">SM</option>
                        <option value="SG">SG</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <ShoppingCart className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{supplier.supplierName}</h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 block">{supplier.materialType}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {isEditing ? (
                <>
                    <button onClick={handleUpdate} className="h-9 w-9 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"><Save className="h-4.5 w-4.5" /></button>
                    <button onClick={() => { setIsEditing(false); setForm(supplier); }} className="h-9 w-9 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"><X className="h-4.5 w-4.5" /></button>
                </>
            ) : (
                <>
                    <button onClick={() => setIsEditing(true)} className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-brand hover:bg-slate-50 rounded-lg transition-colors"><Edit2 className="h-4.5 w-4.5" /></button>
                    <button onClick={handleDelete} className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-4.5 w-4.5" /></button>
                </>
            )}
          </div>
        </div>

        {/* Data Grid Section */}
        <div className="pt-5 border-t border-slate-100/80">
            <h5 className={SECTION_TITLE}>Timeline & Status</h5>
            <div className="grid grid-cols-[1.5fr_1fr] gap-x-6 gap-y-5">
                <div className="space-y-4">
                    {isEditing ? (
                        <div>
                            <label className={LABEL_STYLE}>Expected Date</label>
                            <input 
                                type="date" 
                                value={typeof form.expectedDeliveryDate === 'string' ? form.expectedDeliveryDate : form.expectedDeliveryDate ? new Date(form.expectedDeliveryDate).toISOString().split('T')[0] : ''} 
                                onChange={e => setForm({ ...form, expectedDeliveryDate: e.target.value })} 
                                className={INPUT_BASE} 
                            />
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-slate-500">Ordered</span>
                                <span className="font-bold text-slate-900 tabular-nums">{supplier.orderDate ? formatSydneyDate(supplier.orderDate, "dd MMM yyyy") : "—"}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-slate-500">Exp. Delivery</span>
                                <span className="font-bold text-emerald-600 tabular-nums">{supplier.expectedDeliveryDate ? formatSydneyDate(supplier.expectedDeliveryDate, "dd MMM yyyy") : "—"}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col justify-start">
                    {isEditing ? (
                        <div>
                            <label className={LABEL_STYLE}>Current Status</label>
                            <select value={form.deliveryStatus || ''} onChange={e => setForm({ ...form, deliveryStatus: e.target.value })} className={INPUT_BASE}>
                                {SUPPLIER_DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div className="pt-1">
                            <StatusBadge status={supplier.deliveryStatus} />
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Notes Section */}
        <div className="pt-5 border-t border-slate-100/80">
            <h5 className={SECTION_TITLE}>Operational Notes</h5>
            {isEditing ? (
                <textarea 
                    value={form.notes || ''} 
                    onChange={e => setForm({ ...form, notes: e.target.value })} 
                    className={cn(INPUT_BASE, "h-auto min-h-[80px] max-h-[160px] py-3 resize-y")}
                    placeholder="Add details..."
                />
            ) : (
                <p className={cn("text-xs leading-relaxed", supplier.notes ? "text-slate-600 font-medium italic" : "text-slate-300 font-normal")}>
                    {supplier.notes || "No notes recorded."}
                </p>
            )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const configs: Record<string, string> = {
    'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Delayed': 'bg-red-50 text-red-700 border-red-100',
    'Partially Delivered': 'bg-amber-50 text-amber-700 border-amber-100',
    'Ordered': 'bg-blue-50 text-blue-700 border-blue-100',
  };
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap uppercase tracking-wider",
      configs[status || ''] || "bg-slate-50 text-slate-500 border-slate-100"
    )}>
      {status || "Unknown"}
    </span>
  );
}
