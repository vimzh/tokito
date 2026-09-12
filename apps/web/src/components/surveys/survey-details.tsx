import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { campaignContent as copy, campaignStatusLabels } from "@/data/campaign";
import { formatDate } from "@/lib/format";
import type { Campaign } from "@/lib/api";

export function SurveyDetails({ campaign }: { campaign: Campaign }) {
  return (
    <div className="space-y-8">
      <Link href="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />{copy.back}</Link>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{campaignStatusLabels[campaign.status]}</Badge><span className="text-sm text-muted-foreground">{copy.created} {formatDate(campaign.createdAt)}</span></div>
          <h1 className="text-3xl sm:text-4xl">{campaign.name}</h1>
        </div>
        <div className="flex gap-2"><CampaignEditor campaign={campaign} /><DeleteCampaignButton id={campaign.id} /></div>
      </header>
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList variant="line" className="gap-4"><TabsTrigger value="overview">{copy.overview}</TabsTrigger><TabsTrigger value="responses">{copy.responses}</TabsTrigger><TabsTrigger value="report">{copy.report}</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-7">
          <section className="max-w-3xl space-y-3"><h2 className="text-xl">{copy.goal}</h2><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{campaign.goal}</p></section>
          <section className="max-w-3xl space-y-3"><h2 className="text-xl">{copy.additionalTopics}</h2><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{campaign.additionalTopics || copy.noAdditionalTopics}</p></section>
          <section className="space-y-3">
            <h2 className="text-xl">{copy.questions}</h2>
            <Card><CardContent>{campaign.questions.length > 0 ? <ol className="list-decimal space-y-4 pl-5 leading-6">{campaign.questions.map((question) => <li key={question.id} className="pl-2">{question.text}</li>)}</ol> : <p className="text-sm text-muted-foreground">{copy.noQuestions}</p>}</CardContent></Card>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl">{copy.settings}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground"><li>{copy.questionSource[campaign.questionSource]}</li><li>{copy.conversationMode[campaign.conversationMode]}</li></ul>
          </section>
        </TabsContent>
        <TabsContent value="responses"><Empty className="border"><EmptyHeader><EmptyDescription>{copy.responsesEmpty}</EmptyDescription></EmptyHeader></Empty></TabsContent>
        <TabsContent value="report"><Empty className="border"><EmptyHeader><EmptyDescription>{copy.reportEmpty}</EmptyDescription></EmptyHeader></Empty></TabsContent>
      </Tabs>
    </div>
  );
}
