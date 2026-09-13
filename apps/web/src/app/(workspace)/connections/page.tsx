import { ConnectionsPanel } from "@/components/workspace/connections-panel";
import { connectionsContent } from "@/data/workspace-settings";
import { listConnections } from "@/lib/api";

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ connected?: string; connectError?: string }> }) {
  const [connections, query] = await Promise.all([listConnections(), searchParams]);
  const notice = query.connectError
    ? { kind: "error" as const, text: connectionsContent.connectFailed(query.connectError) }
    : query.connected
      ? { kind: "ok" as const, text: connectionsContent.justConnected(connectionsContent.providers[query.connected as keyof typeof connectionsContent.providers]?.title ?? query.connected) }
      : undefined;
  return <ConnectionsPanel connections={connections} notice={notice} apiBase={process.env.API_PUBLIC_URL ?? process.env.API_URL ?? "http://localhost:3002"} />;
}
