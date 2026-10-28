'use client';

import { useState } from 'react';
import { triggerSync } from '@/app/actions/sync';

export default function SyncDiagPage() {
  const [status, setStatus] = useState('Idle. Visiting this page does not start a sync.');
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    setIsRunning(true);
    setStatus('Running sync...');
    try {
      const res = await triggerSync();
      setStatus(res.success ? `Sync Complete: ${JSON.stringify(res)}` : `Sync Failed: ${res.error}`);
    } catch (e) {
      setStatus(`Sync Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4">Diagnostic Sync Page</h1>
      <p className="mb-4 text-sm text-slate-600">
        A full sync must be triggered explicitly. Only administrators may run it.
      </p>
      <button
        type="button"
        onClick={run}
        disabled={isRunning}
        className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
      >
        {isRunning ? 'Sync running...' : 'Run full sync'}
      </button>
      <pre className="p-4 bg-slate-100 rounded border font-mono text-xs whitespace-pre-wrap">
        {status}
      </pre>
    </div>
  );
}
