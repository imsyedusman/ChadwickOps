"use client";

import React, { useState } from "react";
import { 
  Plus, 
  Search, 
  Key, 
  Shield, 
  UserMinus, 
  UserCheck, 
  X, 
  Lock, 
  Activity,
  CheckCircle2, 
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Users
} from "lucide-react";
import { createUser, updateUserStatus, updateUserRole, resetUserPassword, deleteUser } from "@/app/actions/users";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UserData {
  id: number;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

interface Props {
  initialUsers: UserData[];
}

export function UsersManagementClient({ initialUsers }: Props) {
  const [usersList, setUsersList] = useState<UserData[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals / Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [resettingUser, setResettingUser] = useState<UserData | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Deletion States
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search & Filter
  const filteredUsers = usersList.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastLogin = (dateInput: Date | string | null): string => {
    if (!dateInput) return "Never";
    const date = new Date(dateInput);
    const timeStr = format(date, "h:mm a"); // e.g. "4:37 PM"
    
    if (isToday(date)) {
      return `Today at ${timeStr}`;
    }
    if (isYesterday(date)) {
      return `Yesterday at ${timeStr}`;
    }
    return `${format(date, "dd MMM yyyy")} at ${timeStr}`;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      toast.error("Please fill in all fields.");
      return;
    }

    const domain = newEmail.trim().toLowerCase().split("@").pop();
    if (domain !== "chadwickswitchboards.com.au") {
      toast.error("User email must belong to the @chadwickswitchboards.com.au domain.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await createUser({
        name: newName,
        username: newEmail,
        role: newRole,
        password: newPassword
      });

      if (res.success && res.user) {
        toast.success("User created successfully!");
        
        // Use the actual database user object returned by Server Action
        const newUser: UserData = {
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          role: res.user.role,
          isActive: res.user.isActive,
          createdAt: new Date(res.user.createdAt),
          updatedAt: new Date(res.user.updatedAt),
          lastLoginAt: res.user.lastLoginAt ? new Date(res.user.lastLoginAt) : null
        };
        
        setUsersList([newUser, ...usersList]);
        
        // Reset state
        setNewName("");
        setNewEmail("");
        setNewRole("viewer");
        setNewPassword("");
        setIsCreateOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleStatus = async (user: UserData) => {
    const nextStatus = !user.isActive;
    const actionText = nextStatus ? "activate" : "deactivate";

    try {
      const res = await updateUserStatus(user.id, nextStatus);
      if (res.success) {
        setUsersList(usersList.map(u => u.id === user.id ? { ...u, isActive: nextStatus } : u));
        toast.success(`Successfully ${actionText}d user account.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update user status.");
    }
  };

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      const res = await updateUserRole(userId, role);
      if (res.success) {
        setUsersList(usersList.map(u => u.id === userId ? { ...u, role } : u));
        toast.success("User permissions updated successfully.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to modify user role.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetUserPassword(resettingUser.id, resetPasswordVal);
      if (res.success) {
        toast.success(`Password reset successfully for ${resettingUser.name}.`);
        setResettingUser(null);
        setResetPasswordVal("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await deleteUser(deletingUser.id);
      if (res.success) {
        toast.success(`User ${deletingUser.name} deleted successfully.`);
        setUsersList(usersList.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Statistics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-brand transition-colors" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase tracking-widest px-5 py-3 rounded-xl shadow-md shadow-brand/10 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Database User Directory */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">User Details</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Role & Permissions</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Last Login</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Account Status</th>
                <th className="px-6 py-5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Security Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    {/* User Details */}
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{user.name}</span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{user.username}</span>
                      </div>
                    </td>

                    {/* Role selector */}
                    <td className="px-6 py-5">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold rounded-xl px-3 py-2 focus:ring-4 focus:ring-brand/5 focus:border-brand outline-none transition-all text-slate-700 dark:text-slate-200 hover:border-brand/30 cursor-pointer"
                      >
                        <option value="viewer">Viewer (Read-only)</option>
                        <option value="user">Operational User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>

                    {/* Last Login timestamp */}
                    <td className="px-6 py-5 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {formatLastLogin(user.lastLoginAt)}
                      </div>
                    </td>

                    {/* Account Status / Toggle */}
                    <td className="px-6 py-5">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-bold border tracking-wider uppercase transition-all inline-flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                          user.isActive
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                            : "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20"
                        )}
                      >
                        {user.isActive ? (
                          <>
                            <UserCheck className="h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <UserMinus className="h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>

                    {/* Security resets */}
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResettingUser(user)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-brand border border-slate-200 dark:border-slate-800 hover:border-brand/40 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 transition-colors uppercase tracking-widest cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Key className="h-3.5 w-3.5 text-slate-400" />
                          Reset Pass
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-red-600 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-500/20 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 transition-colors uppercase tracking-widest cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-semibold">No users found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand/10 rounded-xl text-brand">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add User</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Domain restriction checks are enforced.</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Syed Usman"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-brand outline-none transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="susman@chadwickswitchboards.com.au"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-brand outline-none transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-brand outline-none transition-all text-slate-800 dark:text-slate-100"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="user">Operational User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-brand outline-none transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-300"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl shadow-lg shadow-brand/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isCreating ? "Creating..." : "Confirm Account Creation"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => {
                setResettingUser(null);
                setResetPasswordVal("");
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-brand/10 rounded-xl text-brand">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reset User Password</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Resetting password will revoke all active sessions for this account.</p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3 rounded-xl flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                <AlertCircle className="h-4.5 w-4.5 text-brand shrink-0" />
                <span>Resetting password for <strong>{resettingUser.name}</strong> ({resettingUser.username}).</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">New Secure Password</label>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter new password"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-2.5 text-xs focus:ring-2 focus:ring-brand outline-none transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full bg-brand hover:bg-brand/90 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl shadow-lg shadow-brand/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isResetting ? "Updating..." : "Update Passcode & Force Logout"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-200 relative">
            <button 
              onClick={() => setDeletingUser(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-600 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete User Account</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">This action cannot be undone and invalidates all active sessions.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 p-4 rounded-xl text-xs text-red-800 dark:text-red-400">
                Are you sure you want to permanently delete the account for <strong>{deletingUser.name}</strong> ({deletingUser.username})? This user will lose all system access immediately.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest py-3 rounded-xl shadow-lg shadow-red-600/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
