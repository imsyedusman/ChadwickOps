"use client";

import { useState, useEffect } from "react";
import { updateApiCredentials, triggerSync, initializeSystem } from "@/app/actions/sync";
import { Settings, Shield, RefreshCw, Database, Info } from "lucide-react";

export default function AdminPage() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await updateApiCredentials(apiKey, apiSecret);
    if (res.success) {
      alert("Credentials saved securely.");
    } else {
      alert(`Error: ${res.error}`);
    }
    setIsSaving(false);
  };

  const handleInitialize = async () => {
    if (!confirm("This will seed default stages and mappings. Continue?")) return;
    setIsInitializing(true);
    const res = await initializeSystem();
    if (res.success) {
      alert("System initialized with default Chadwick stages and mappings.");
    }
    setIsInitializing(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Settings</h1>
        <p className="text-slate-500 mt-2">Manage API integrations, security, and system defaults.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm shadow-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
               <Shield className="h-5 w-5 text-brand" />
               <CardTitle>WorkGuru API</CardTitle>
            </div>
            <CardDescription>Configure your WorkGuru TokenAuth credentials. These are stored encrypted.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input 
                  id="apiKey" 
                  type="password" 
                  value={apiKey} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)} 
                  placeholder="Enter WorkGuru API Key" 
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input 
                  id="apiSecret" 
                  type="password" 
                  value={apiSecret} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiSecret(e.target.value)} 
                  placeholder="Enter WorkGuru API Secret"
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all"
                />
              </div>
              <Button type="submit" disabled={isSaving} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-6">
                {isSaving ? "Saving..." : "Save Credentials"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm shadow-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
               <Database className="h-5 w-5 text-brand" />
               <CardTitle>System Initialization</CardTitle>
            </div>
            <CardDescription>Run this once to set up the default Chadwick stages and mappings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
               <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
               <p className="text-xs text-amber-800 leading-relaxed font-medium">
                 Initialization will seed "Engineering", "Approved", "Production", etc. and map them to standard WorkGuru project statuses.
               </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleInitialize} 
              disabled={isInitializing}
              className="w-full border-slate-200 hover:bg-slate-50 font-semibold py-6"
            >
              {isInitializing ? "Initializing..." : "Seed Default Data"}
            </Button>
            <div className="pt-4 border-t border-slate-100">
               <p className="text-xs text-slate-400 text-center">Version 1.0.0 (Pre-Alpha)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Minimal Components if shadcn is not fully ready
function Input({ className, ...props }: any) {
  return <input className={`flex h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all ${className}`} {...props} />;
}
function Label({ children, className, ...props }: any) {
  return <label className={`text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 ${className}`} {...props}>{children}</label>;
}
function CardDescription({ children, className }: any) {
  return <p className={`text-sm text-slate-500 font-medium ${className}`}>{children}</p>;
}
function CardTitle({ children, className }: any) {
  return <h3 className={`text-lg font-bold leading-none tracking-tight text-slate-900 ${className}`}>{children}</h3>;
}
function Card({ children, className }: any) {
  return <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}
function CardHeader({ children, className }: any) {
  return <div className={`flex flex-col space-y-1.5 p-6 pb-2 ${className}`}>{children}</div>;
}
function CardContent({ children, className }: any) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
function Button({ className, variant, size, ...props }: any) {
  const variants: any = {
    outline: "border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-900",
    default: "bg-slate-900 text-white hover:bg-slate-800"
  };
  return (
    <button 
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 h-10 px-4 py-2 ${variants[variant || "default"]} ${className}`} 
      {...props} 
    />
  );
}
