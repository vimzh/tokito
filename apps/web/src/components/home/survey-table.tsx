import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { homeContent } from "@/data/home";
import { campaignStatusLabels } from "@/data/campaign";
import { formatDate } from "@/lib/format";
import type { CampaignSummary } from "@/lib/api";

export function SurveyTable({ campaigns }: { campaigns: CampaignSummary[] }) {
  const labels = homeContent.table;
  return (
    <div className="overflow-hidden rounded-xl border bg-card p-2">
      <Table aria-label={homeContent.all}>
        <TableHeader>
          <TableRow>
            {Object.values(labels).map((label) => <TableHead key={label}>{label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="py-5 font-medium"><Link className="underline-offset-4 hover:underline focus-visible:underline" href={`/survey/${campaign.id}`}>{campaign.name}</Link></TableCell>
              <TableCell>{formatDate(campaign.createdAt)}</TableCell>
              <TableCell className="tabular-nums">{campaign.contactCount}</TableCell>
              <TableCell className="tabular-nums">{campaign.responseCount}</TableCell>
              <TableCell><Badge variant="secondary">{campaignStatusLabels[campaign.status]}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
