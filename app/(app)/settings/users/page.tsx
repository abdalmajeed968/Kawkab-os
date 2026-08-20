import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "@/components/documents/CreateUserForm";
import { SettingsSubNav } from "@/components/shell/SettingsSubNav";
import { getSessionUser } from "@/lib/session";

export default async function UsersPage() {
  const { role } = await getSessionUser();

  if (role !== "OWNER") {
    return (
      <div className="card">
        <div className="card-title">Owner access required</div>
        <div className="card-subtitle">User management is restricted to the Owner role.</div>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsSubNav active="users" />
      <div className="card">
        <div className="card-title">Users</div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <span className={`status-dot ${u.status === "ACTIVE" ? "status-profit" : "status-critical"}`} />
                  {u.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CreateUserForm />
    </div>
  );
}
