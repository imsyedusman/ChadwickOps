"use client";

import React, { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, User, AlertCircle, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-50">
        <Loader2 className="h-8 w-8 text-brand animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Parse error parameters from NextAuth redirection (e.g. CredentialsSignin)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "CredentialsSignin") {
      setError("Invalid username or password. Please try again.");
    } else if (errorParam === "inactive") {
      setError("Your account is currently inactive. Please contact an administrator.");
    } else if (errorParam) {
      setError("An authentication error occurred. Please try again.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    // Strict client-side domain check
    const domain = username.trim().toLowerCase().split("@").pop();
    if (domain !== "chadwickswitchboards.com.au") {
      setError("Access is restricted to @chadwickswitchboards.com.au accounts only.");
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.status === 401) {
          setError("Invalid username or password.");
        } else {
          setError("Authentication failed. Please try again.");
        }
      } else {
        // Successful login
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("[Login] Exception:", err);
      setError("An unexpected error occurred. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 select-none">
      
      {/* Light corporate layout container */}
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl p-8 md:p-10 relative overflow-hidden transition-all duration-300">
        
        {/* Top brand line indicator */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand" />

        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo - Render official logo.svg */}
          <div className="py-2 animate-in zoom-in-95 duration-500">
            <img 
              src="/logo.svg" 
              alt="Chadwick Logo" 
              className="h-14 w-auto object-contain dark:invert" 
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">
              WIP Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-sm mt-1">
              Secure access to Chadwick operational systems and reporting.
            </p>
          </div>
        </div>

        {/* Error Alert Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-[10px] font-bold text-red-800 dark:text-red-400 uppercase tracking-widest">Authentication Alert</h4>
              <p className="text-xs text-red-700 dark:text-red-300 leading-normal font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
              Email / Username
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand transition-colors">
                <User className="h-4.5 w-4.5" />
              </div>
              <input
                type="email"
                required
                disabled={loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@chadwickswitchboards.com.au"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand transition-colors">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-12 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-brand/20 shadow-md shadow-brand/10 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                Confirm Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Bottom copyright/brand details */}
        <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800 pt-6">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-tight">
            Chadwick Switchboards © {new Date().getFullYear()} • Secure Session Channel
          </p>
        </div>
      </div>
    </div>
  );
}
