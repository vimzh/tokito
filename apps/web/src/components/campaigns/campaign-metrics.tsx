import { campaignContent } from "@/data/campaign";
import type { CampaignResults } from "@/lib/api";

const copy = campaignContent.metrics;
const keys = ["people", "ready", "called", "reached", "completed", "callbacks", "declined", "optedOut", "unreachable"] as const;

export function CampaignMetrics({ results, live }: { results: CampaignResults; live: boolean }) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
        {keys.map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4"><dt className="text-xs text-muted-foreground">{copy[key]}</dt><dd className="mt-2 text-2xl tabular-nums">{results.participation[key]}</dd></div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">{copy.note(results.responses.total, results.responses.simulated)}{live ? ` ${copy.live}` : ""}</p>
    </div>
  );
}
