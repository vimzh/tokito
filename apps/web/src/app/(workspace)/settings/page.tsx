import { SettingsForm } from "@/components/workspace/settings-form";
import { getSettings, listOptOuts } from "@/lib/api";

export default async function SettingsPage() {
  const [settings, optOuts] = await Promise.all([getSettings(), listOptOuts()]);
  return <SettingsForm settings={settings} optOuts={optOuts} />;
}
