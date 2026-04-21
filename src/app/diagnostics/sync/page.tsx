'use client';

import { useEffect, useState } from 'react';
import { triggerSync } from '@/app/actions/sync';

export default function SyncDiagPage() {
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    async function run() {
      setStatus('Running sync...');
      try {
        const res = await triggerSync();
        setStatus(`Sync Complete: ${JSON.stringify(res)}`);
      } catch (e: any) {
        setStatus(`Sync Failed: ${e.message}`);
      }
    }
    run();
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4">Diagnostic Sync Page</h1>
      <pre className="p-4 bg-slate-100 rounded border font-mono text-xs whitespace-pre-wrap">
        {status}
      </pre>
    </div>
  );
}
