import { SettingsSubNav } from "@/components/shell/SettingsSubNav";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { getSessionUser } from "@/lib/session";

export default async function ProfileSettingsPage() {
  const user = await getSessionUser();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsSubNav active="profile" />
      <ProfileForm currentName={user.name} />
    </div>
  );
}
