"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { changeUserPassword } from "@/app/actions/profile";
import { toast } from "sonner";
import { signOut } from "next-auth/react";

export function ChangePasswordForm() {
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass || !newPass || !confirmPass) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (newPass !== confirmPass) {
      toast.error("New passwords do not match.");
      return;
    }

    if (newPass.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await changeUserPassword({ currentPass, newPass });
      if (res.success) {
        toast.success("Password changed successfully! Signing you out...");
        // Delay logout slightly so user sees the success message
        setTimeout(() => {
          signOut({ callbackUrl: "/login" });
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Current Password */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
          Current Password
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand transition-colors">
            <Lock className="h-4.5 w-4.5" />
          </div>
          <input
            type={showCurrent ? "text" : "password"}
            required
            disabled={loading}
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-12 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* New Password */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
          New Password
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand transition-colors">
            <Lock className="h-4.5 w-4.5" />
          </div>
          <input
            type={showNew ? "text" : "password"}
            required
            disabled={loading}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-12 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
          Confirm New Password
        </label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand transition-colors">
            <Lock className="h-4.5 w-4.5" />
          </div>
          <input
            type={showConfirm ? "text" : "password"}
            required
            disabled={loading}
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="••••••••••••"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-12 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand hover:bg-brand/90 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-brand/20 shadow-md shadow-brand/10 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" />
            Update Password
          </>
        )}
      </button>
    </form>
  );
}
