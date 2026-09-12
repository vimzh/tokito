import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { SurveyTable } from "@/components/home/survey-table";
import { homeContent } from "@/data/home";
import { campaignStatusLabels } from "@/data/campaign";
import type { CampaignSummary } from "@/lib/api";

export function HomeOverview({ campaigns }: { campaigns: CampaignSummary[] }) {
  const running = campaigns.filter((campaign) => campaign.status === "running");
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl sm:text-4xl">{homeContent.title}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{homeContent.description}</p>
        </div>
        <Button asChild className="h-10 px-4"><Link href="/survey/new"><Plus aria-hidden="true" />{homeContent.create}</Link></Button>
      </header>
      {running.length > 0 && (
        <section aria-labelledby="running-title" className="space-y-4">
          <h2 id="running-title" className="text-xl">{homeContent.running}</h2>
          {running.map((campaign) => (
            <Card key={campaign.id} className="shadow-none">
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl">{campaign.name}</h3>
                <Badge variant="outline">{campaignStatusLabels[campaign.status]}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="max-w-2xl text-sm text-muted-foreground">{campaign.goal}</p>
                <div className="space-y-2">
                  <div className="flex justify-between gap-3 text-sm"><span>{homeContent.progress(campaign.responseCount, campaign.readyCount)}</span><span className="tabular-nums">{campaign.readyCount > 0 ? Math.round((campaign.responseCount / campaign.readyCount) * 100) : 0}%</span></div>
                  <progress aria-label={homeContent.progress(campaign.responseCount, campaign.readyCount)} max={Math.max(1, campaign.readyCount)} value={campaign.responseCount} className="block h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
                </div>
                <Button asChild variant="outline"><Link href={`/survey/${campaign.id}`}>{homeContent.view}<ArrowUpRight aria-hidden="true" /></Link></Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
      <section aria-labelledby="all-title" className="space-y-4">
        <div>
          <h2 id="all-title" className="text-xl">{homeContent.all}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{homeContent.allDescription}</p>
        </div>
        {campaigns.length > 0 ? (
          <SurveyTable campaigns={campaigns} />
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{homeContent.empty.title}</EmptyTitle>
              <EmptyDescription>{homeContent.empty.description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline"><Link href="/survey/new"><Plus aria-hidden="true" />{homeContent.create}</Link></Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
    </>
  );
}
