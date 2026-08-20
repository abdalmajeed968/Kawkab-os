import { SettingsSubNav } from "@/components/shell/SettingsSubNav";
import { BusinessSettingsForm } from "@/components/settings/BusinessSettingsForm";
import { getBusinessSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/session";

export default async function BusinessSettingsPage() {
  const user = await getSessionUser();
  const settings = await getBusinessSettings();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SettingsSubNav active="business" />
      <BusinessSettingsForm
        settings={{ businessName: settings.businessName, defaultCurrency: settings.defaultCurrency, timezone: settings.timezone }}
        canEdit={user.role === "OWNER"}
      />
    </div>
  );
}
