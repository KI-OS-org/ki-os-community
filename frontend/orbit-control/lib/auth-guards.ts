export type OrbitRole = "admin" | "operator" | "auditor" | "user";

const roleOrder: Record<OrbitRole, number> = {
  user: 1,
  auditor: 2,
  operator: 3,
  admin: 4,
};

export function hasRequiredRole(currentRole: string | undefined, allowedRoles: OrbitRole[] = ["user"]) {
  if (!currentRole) return false;
  return allowedRoles.some((role) => roleOrder[currentRole as OrbitRole] >= roleOrder[role]);
}
