import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnswersOverview } from "@/components/campaigns/answers-overview";
import { AskReport } from "@/components/campaigns/ask-report";
import { GenerateReportButton } from "@/components/campaigns/generate-report-button";
import { ReportView } from "@/components/campaigns/report-view";
import { CallScript } from "@/components/campaigns/call-script";
import { CampaignMetrics } from "@/components/campaigns/campaign-metrics";
import { ExportButtons } from "@/components/campaigns/export-buttons";
import { LiveRefresh } from "@/components/campaigns/live-refresh";
import { CallsList } from "@/components/campaigns/calls-list";
import { CallingPreferences } from "@/components/campaigns/calling-preferences";
import { TestCallDialog } from "@/components/campaigns/test-call-dialog";
import { ContactImport } from "@/components/campaigns/contact-import";
import { ContactsTable } from "@/components/campaigns/contacts-table";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { DraftQuestionsPanel } from "@/components/campaigns/draft-questions-panel";
import { OutreachPanel } from "@/components/campaigns/outreach-panel";
import { QuestionEditor } from "@/components/campaigns/question-editor";
import { campaignContent as copy, campaignStatusLabels, preferencesContent } from "@/data/campaign";
import { formatDate } from "@/lib/format";
import type { AskResult, CallSummary, Campaign, CampaignResults, ContactList, OutreachStatus, ReportResponse, TaskPreview } from "@/lib/api";

export function SurveyDetails({ campaign, contacts, calls, preview, outreach, results, report, questions }: { campaign: Campaign; contacts: ContactList; calls: CallSummary[]; preview: TaskPreview; outreach: OutreachStatus; results: CampaignResults; report: ReportResponse; questions: AskResult[] }) {
  const live = campaign.status === "running" || outreach.counts.active > 0 || outreach.counts.queued > 0;
  const readyContacts = contacts.contacts.filter((contact) => contact.status === "ready").map((contact) => ({ id: contact.id, name: contact.name, phone: contact.phone }));
  const language = preferencesContent.languages.find((item) => item.value === campaign.language)?.label ?? campaign.language;
  const mode = copy.conversationModes.find((item) => item.value === campaign.conversationMode)?.label;
  return (
    <div className="space-y-8">
      <Link href="/home" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />{copy.back}</Link>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{campaignStatusLabels[campaign.status]}</Badge><span className="text-sm text-muted-foreground">{copy.created} {formatDate(campaign.createdAt)}</span></div>
          <h1 className="text-3xl sm:text-4xl">{campaign.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2"><TestCallDialog campaignId={campaign.id} contacts={readyContacts} disabled={campaign.questions.length === 0} /><CampaignEditor campaign={campaign} /><DeleteCampaignButton id={campaign.id} /></div>
      </header>
      <LiveRefresh active={live} />
      <CampaignMetrics results={results} live={live} />
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList variant="line" className="gap-4"><TabsTrigger value="overview">{copy.overview}</TabsTrigger><TabsTrigger value="contacts">{copy.contacts} ({contacts.total})</TabsTrigger><TabsTrigger value="answers">{copy.answers}</TabsTrigger><TabsTrigger value="responses">{copy.responses} ({calls.length})</TabsTrigger><TabsTrigger value="report">{copy.report}</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-8">
          <section className="space-y-3"><h2 className="text-xl">{copy.outreach.title}</h2><OutreachPanel campaignId={campaign.id} outreach={{ ...outreach, timezone: campaign.timezone }} /></section>
          <section className="max-w-3xl space-y-3"><h2 className="text-xl">{copy.goal}</h2><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{campaign.goal}</p></section>
          <section className="max-w-3xl space-y-3"><h2 className="text-xl">{copy.context}</h2><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{campaign.context || copy.noContext}</p></section>
          <section className="max-w-3xl space-y-3"><h2 className="text-xl">{copy.additionalTopics}</h2><p className="whitespace-pre-wrap leading-7 text-muted-foreground">{campaign.additionalTopics || copy.noAdditionalTopics}</p></section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">{copy.questions}</h2><span className="text-sm text-muted-foreground">{copy.questionSource[campaign.questionSource]}</span></div>
            <DraftQuestionsPanel campaignId={campaign.id} existingCount={campaign.questions.length} />
            <QuestionEditor key={campaign.updatedAt} campaignId={campaign.id} questions={campaign.questions} />
          </section>
          <section className="space-y-3">
            <h2 className="text-xl">{copy.script.title}</h2>
            <CallScript preview={preview} />
          </section>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">{copy.settings}</h2><CallingPreferences campaign={campaign} /></div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>{language}</li>
              <li>{copy.hoursSummary(campaign.callingHoursStart, campaign.callingHoursEnd, campaign.timezone)}</li>
              <li>{campaign.maxCallMinutes} {preferencesContent.minutesUnit} · {campaign.maxAttempts} {preferencesContent.attemptsUnit(campaign.maxAttempts)}</li>
              <li>{mode}</li>
              <li>{campaign.clarificationsAllowed ? copy.clarificationsOn : copy.clarificationsOff}</li>
            </ul>
          </section>
        </TabsContent>
        <TabsContent value="contacts" className="space-y-6">
          <section className="space-y-4">
            <div><h2 className="text-xl">{copy.contacts}</h2><p className="mt-2 text-sm text-muted-foreground">{copy.contactsDescription}</p></div>
            <ContactImport campaignId={campaign.id} />
          </section>
          {contacts.total > 0 ? <ContactsTable campaignId={campaign.id} list={contacts} /> : <p className="text-sm text-muted-foreground">{copy.contactsEmpty}</p>}
        </TabsContent>
        <TabsContent value="answers" className="space-y-4">
          <div><h2 className="text-xl">{copy.results.title}</h2><p className="mt-2 text-sm text-muted-foreground">{copy.results.description}</p></div>
          <AnswersOverview campaignId={campaign.id} results={results} />
        </TabsContent>
        <TabsContent value="responses" className="space-y-6">
          <div><h2 className="text-xl">{copy.calls.title}</h2><p className="mt-2 text-sm text-muted-foreground">{copy.calls.description}</p></div>
          <CallsList campaignId={campaign.id} calls={calls} />
          <ExportButtons campaignId={campaign.id} />
        </TabsContent>
        <TabsContent value="report" className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-xl">{copy.reportView.title}</h2><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{copy.reportView.description}</p></div>
            <GenerateReportButton campaignId={campaign.id} hasReport={report.report !== null} disabled={results.responses.total === 0} />
          </div>
          {report.report ? <ReportView campaignId={campaign.id} report={report.report} versions={report.versions} /> : <p className="text-sm text-muted-foreground">{results.responses.total === 0 ? copy.reportView.needCalls : copy.reportView.empty}</p>}
          <AskReport campaignId={campaign.id} history={questions} disabled={results.responses.total === 0} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
