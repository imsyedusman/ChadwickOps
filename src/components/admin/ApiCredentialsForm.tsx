'use client';

import { useState } from 'react';
import { Key, Save, ShieldCheck, Activity, AlertCircle } from 'lucide-react';
import { testApiConnection, updateApiCredentials } from '@/app/actions/sync';
import { cn } from '@/lib/utils';

interface ApiCredentialsFormProps {
  hasExistingCredentials: boolean;
}

export function ApiCredentialsForm({ hasExistingCredentials }: ApiCredentialsFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTested, setIsTested] = useState(false);
  const [lastTestedValue, setLastTestedValue] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const currentInputValue = `${apiKey}:${apiSecret}`;
  const needsTest = isTested && currentInputValue !== lastTestedValue;

  const handleTest = async () => {
    if (!apiKey || !apiSecret) {
      setStatus({ type: 'error', message: 'Please enter both API Key and Secret.' });
      return;
    }
    
    setIsTesting(true);
    setStatus({ type: null, message: '' });
    
    try {
      const result = await testApiConnection(apiKey, apiSecret);
      if (result.success) {
        setStatus({ type: 'success', message: 'Connection verified! You can now save these credentials.' });
        setIsTested(true);
        setLastTestedValue(currentInputValue);
      } else {
        setStatus({ type: 'error', message: result.error || 'Connection failed.' });
        setIsTested(false);
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'An unexpected error occurred during testing.' });
      setIsTested(false);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      setStatus({ type: 'error', message: 'Please enter both API Key and Secret.' });
      return;
    }

    setIsSaving(true);
    setStatus({ type: null, message: '' });

    try {
      const result = await updateApiCredentials(apiKey, apiSecret);
      if (result.success) {
        setStatus({ type: 'success', message: 'Credentials saved successfully.' });
        setApiKey('');
        setApiSecret('');
        setIsTested(false);
        setLastTestedValue('');
        // Trigger a refresh to show "Credentials Stored" indicator
        window.location.reload();
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to update credentials.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'An unexpected error occurred while saving.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-6 group">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand/10 rounded-lg text-brand">
            <Key className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">WorkGuru Connectivity</h2>
        </div>
        {hasExistingCredentials && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-full">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Credentials Stored</span>
          </div>
        )}
      </div>
      
      <p className="text-xs text-slate-400 font-medium leading-relaxed">
        Sensitive credentials are encrypted using AES-256-CBC and stored securely on the server. 
        They are never sent back to the browser once saved.
      </p>
      
      <form onSubmit={handleSave} className="space-y-4">
         <div className="space-y-1.5">
           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">WorkGuru API Key</label>
           <input 
             type="password" 
             autoComplete="off"
             value={apiKey}
             onChange={(e) => setApiKey(e.target.value)}
             placeholder={hasExistingCredentials ? "••••••••••••••••" : "Enter API Key"} 
             className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand outline-none transition-all placeholder:text-slate-300" 
           />
         </div>
         <div className="space-y-1.5">
           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">WorkGuru API Secret</label>
           <input 
             type="password" 
             autoComplete="off"
             value={apiSecret}
             onChange={(e) => setApiSecret(e.target.value)}
             placeholder={hasExistingCredentials ? "••••••••••••••••" : "Enter API Secret"} 
             className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand outline-none transition-all placeholder:text-slate-300" 
           />
         </div>

         {status.type && (
           <div className={cn(
             "flex items-start gap-3 p-3 rounded-xl border text-xs font-medium animate-in fade-in slide-in-from-top-2",
             status.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400" : 
             "bg-red-50 border-red-100 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
           )}>
             {status.type === 'success' ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
             <span>{status.message}</span>
           </div>
         )}
         
         <div className="grid grid-cols-2 gap-4">
           <button 
             type="button"
             onClick={handleTest}
             disabled={isTesting || isSaving}
             className="w-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
           >
             {isTesting ? "Testing..." : (
               <>
                 <Activity className="h-4 w-4" />
                 Test Connection
               </>
             )}
           </button>
           <button 
             type="submit"
             disabled={isSaving || isTesting}
             className="w-full bg-brand hover:bg-brand/90 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-brand/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
           >
             {isSaving ? "Saving..." : (
               <>
                 <Save className="h-4 w-4" />
                 {hasExistingCredentials ? "Update Credentials" : "Save Credentials"}
               </>
             )}
           </button>
         </div>
      </form>
    </section>
  );
}
