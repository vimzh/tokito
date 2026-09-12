import { HomeOverview } from "@/components/home/home-overview";
import { listCampaigns } from "@/lib/api";

export default async function HomePage() {
  const campaigns = await listCampaigns();
  return <HomeOverview campaigns={campaigns} />;
}
