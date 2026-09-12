import { SettingsForm } from "@/components/workspace/settings-form";
import { getSettings } from "@/lib/api";

export default async function SettingsPage() {
  return <SettingsForm settings={await getSettings()} />;
}
