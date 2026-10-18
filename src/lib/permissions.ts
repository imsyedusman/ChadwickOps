/**
 * Pure Role-Based Access Control (RBAC) and permissions utilities.
 * Completely free of database connections or server runtimes so it can be safely used
 * in client components, server actions, and unit tests without side-effects.
 */

export interface UserSessionLike {
  user?: {
    id?: string | number;
    name?: string | null;
    email?: string | null;
    role?: string;
    roles?: string[];
  };
}

export function hasRole(session: UserSessionLike | null, roleName: string): boolean {
  if (!session?.user) return false;
  if (session.user.role === roleName) return true;
  if (Array.isArray(session.user.roles) && session.user.roles.includes(roleName)) return true;
  return false;
}

export function canManageTeams(session: UserSessionLike | null): boolean {
  if (!session?.user) return false;
  return hasRole(session, "scheduler") || hasRole(session, "admin");
}

export function canAssignStaff(session: UserSessionLike | null): boolean {
  if (!session?.user) return false;
  return hasRole(session, "scheduler") || hasRole(session, "admin");
}

export function canPlanOvertime(session: UserSessionLike | null): boolean {
  if (!session?.user) return false;
  return hasRole(session, "scheduler") || hasRole(session, "admin");
}

export function canRecordLeave(session: UserSessionLike | null): boolean {
  if (!session?.user) return false;
  // Joe (scheduler), Farina (finance/admin), and system admins can record paper/PDF leave
  return hasRole(session, "scheduler") || hasRole(session, "admin") || hasRole(session, "finance");
}

export function canApproveLeave(session: UserSessionLike | null): boolean {
  if (!session?.user) return false;
  // Joe (scheduler), Farina (finance/admin), and system admins can approve or reject leave
  return hasRole(session, "scheduler") || hasRole(session, "admin") || hasRole(session, "finance");
}

/**
 * Backward compatibility alias for workforce general management (team structure, rosters, loans)
 */
export function canManageWorkforce(session: UserSessionLike | null): boolean {
  return canManageTeams(session);
}
