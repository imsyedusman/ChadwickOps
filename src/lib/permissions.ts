/** Permissions use only normalized, database-backed user_roles memberships. */
export const permissionRoles = {
  sync: ["admin"],
  administration: ["admin"],
  procurement: ["admin", "scheduler", "finance"],
  project: ["admin", "scheduler"],
  finance: ["admin", "finance"],
  capacity: ["admin", "scheduler"],
} as const;
export type Permission = keyof typeof permissionRoles;

export function hasPermission(
  session: { user?: { roles?: string[]; role?: string } } | null,
  permission: Permission,
): boolean {
  return permissionRoles[permission].some(role => session?.user?.roles?.includes(role) === true);
}
