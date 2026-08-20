export function RoleBadge({ role }: { role: string }) {
  const className = role === "OPERATOR" ? "role-badge role-badge-operator" : "role-badge";
  return <span className={className}>{role}</span>;
}
