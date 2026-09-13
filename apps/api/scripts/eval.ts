// End-to-end evaluation without CALL-E: real question drafting, simulated calls with an LLM playing the person
// (dynamic and fixed modes), bulk synthetic responses through the real result mapper, the multi-agent report,
// ask-the-report, and an LLM judge. Writes docs/evaluation/run-<stamp>.md and .json.
//
//   cd apps/api && set -a && . ./.env && set +a && bun run scripts/eval.ts
//   EVAL_RESPONSES=80 EVAL_SCENARIOS=restaurant,event EVAL_DB=eval.db
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { z } from 'zod'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
import { createDb } from '../src/db'
import { calls, contacts } from '../src/db/schema'
import { createOpenAiModel, createStructuredRun, usageTotals, type StructuredRun } from '../src/ai/agent'
import { aiConfig } from '../src/ai/config'
import { createDrafter } from '../src/ai/draft-questions'
import { createCampaign, getCampaign, replaceQuestions, updateCampaign } from '../src/services/campaigns'
import { startSimulation, simulationTurn, getCall } from '../src/calls/simulator'
import { buildResultSchema } from '../src/calls/task-builder'
import { persistCallResult } from '../src/calls/persist'
import { campaignResults } from '../src/calls/results'
import { generateReport } from '../src/reports/generate'
import { askReport } from '../src/reports/ask'
import { resetHooks } from '../src/integrations/hooks'
import { renderMarkdown } from './eval-render'

const RESPONSES = Number(process.env.EVAL_RESPONSES ?? 80)
const BATCH = Number(process.env.EVAL_BATCH ?? 10)
const CHEAP_MODEL = process.env.EVAL_CHEAP_MODEL ?? 'gpt-5.4-nano'
const only = process.env.EVAL_SCENARIOS?.split(',').map((s) => s.trim()).filter(Boolean)
const dbFile = process.env.EVAL_DB ?? 'eval.db'
for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbFile}${suffix}`, { force: true })
const db = createDb(dbFile)
migrate(db, { migrationsFolder: './drizzle' })
resetHooks()

const log = (...parts: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...parts)
const main = createStructuredRun()
const simRun: StructuredRun = (args) => main({ ...args, effort: 'medium' })
const cheap = createStructuredRun(createOpenAiModel('low', CHEAP_MODEL), { modelId: CHEAP_MODEL, fixedEffort: 'low' })
const judge: StructuredRun = (args) => main({ ...args, effort: 'low' })

type Persona = { name: string; mode: 'dynamic' | 'fixed'; card: string }
type Scenario = { key: string; name: string; who: string; goal: string; context: string; additionalTopics?: string; personas: Persona[]; bulkGuidance: string; questions: string[] }

const scenarios: Scenario[] = [
  {
    key: 'restaurant', name: 'New menu feedback', who: 'Restaurant owner',
    goal: 'We changed our menu. I want input on the new dishes, the choices available, and the prices. Find out what customers like and what we should improve.',
    context: 'Family restaurant in Pune. The new menu launched last month with six new mains, two fewer vegetarian options, and prices about 10% higher.',
    additionalTopics: 'portion sizes, vegetarian choices, dishes people miss',
    personas: [
      { name: 'Priya', mode: 'dynamic', card: 'a regular who tried the new menu twice, liked the paneer tikka pasta, thought the prices felt steep and gives short, vague answers unless asked why' },
      { name: 'Rahul', mode: 'dynamic', card: 'a customer who has NOT visited since the new menu launched; polite, busy, will answer only what applies' },
      { name: 'Sunita', mode: 'fixed', card: 'a vegetarian customer who tried the new menu once, misses the old dal makhani, found portions fine, and answers directly' },
    ],
    bulkGuidance: 'Customers of a Pune family restaurant. Mix of regulars and occasional visitors; some vegetarian; price and portion opinions vary; a few mention specific dishes (paneer tikka pasta, mutton rogan josh, dal makhani, thali).',
    questions: ['Which dishes got the most criticism and why?', 'Are the price complaints about the price itself or the portion size?'],
  },
  {
    key: 'event', name: 'Society event feedback', who: 'Event organizer (university photography society)',
    goal: 'Call attendees of our evening talk and hands-on lighting session and find out what worked and what we should improve for the next event.',
    context: 'University photography society. Two-hour evening event: a 45-minute talk by a wedding photographer followed by a hands-on session with three lighting stations; about forty members came; the room was crowded.',
    personas: [
      { name: 'Asha', mode: 'dynamic', card: 'a second-year member who loved the hands-on session because she finally understood off-camera flash; answers briefly and warms up when asked for examples' },
      { name: 'Ravi', mode: 'dynamic', card: 'a third-year member who found the hands-on session too crowded to reach a light, liked the talk, and declines to suggest a next event' },
      { name: 'Meera', mode: 'fixed', card: 'a first-year member who could not hear well from the back, otherwise enjoyed it, wants a portrait walk next' },
    ],
    bulkGuidance: 'University students in a photography society. Opinions split on the hands-on session (great vs too crowded); several mention sound in the room; suggestions include outdoor walks, editing workshops, and studio time.',
    questions: ['Was the hands-on session a success or a problem?', 'What should the next event be, based on what members asked for?'],
  },
  {
    key: 'feature', name: 'New onboarding flow feedback', who: 'Product team at a small SaaS company',
    goal: 'Ask people who tried our new onboarding flow what helped, where they got stuck, and what they still needed to get started.',
    context: 'Invoicing app for freelancers. The new onboarding replaced a five-step wizard with a single page plus a sample invoice; released three weeks ago to new sign-ups.',
    additionalTopics: 'the sample invoice, connecting a bank account, time to first invoice',
    personas: [
      { name: 'Dev', mode: 'dynamic', card: 'a freelance designer who got stuck connecting a bank account, found the sample invoice helpful, and gives one-line answers until asked for detail' },
      { name: 'Lena', mode: 'dynamic', card: 'a consultant who sent her first invoice in ten minutes, wants recurring invoices, and is enthusiastic' },
      { name: 'Tomás', mode: 'fixed', card: 'a photographer who abandoned onboarding because the bank connection failed twice; direct and a little annoyed' },
    ],
    bulkGuidance: 'New sign-ups to a freelancer invoicing app: designers, writers, consultants, developers. Bank connection is the common sticking point; the sample invoice is mostly liked; some ask for templates, recurring invoices, and mobile.',
    questions: ['Where do people get stuck most often?', 'Did the sample invoice help people?'],
  },
  {
    key: 'clinic', name: 'New front-desk team feedback', who: 'Business owner (dental clinic)',
    goal: 'We hired a new front-desk team at our clinic last month. Find out how patients experienced booking, check-in, and follow-up with the new staff, and what we should fix.',
    context: 'Two-dentist clinic in Bengaluru. The three previous receptionists left; the new team of three started six weeks ago with a new booking system. Some patients complained about wait times on the phone.',
    additionalTopics: 'phone wait times, reminders, billing questions',
    personas: [
      { name: 'Kavya', mode: 'dynamic', card: 'a patient who found the new staff friendly but waited on hold twice; vague at first, specific when asked' },
      { name: 'Arjun', mode: 'dynamic', card: 'a patient who had a billing mix-up that the new team fixed quickly; wants to be called back next week about an appointment, mentions this early' },
      { name: 'Farah', mode: 'fixed', card: 'a patient who has not visited since the new team started, so most questions do not apply' },
    ],
    bulkGuidance: 'Dental clinic patients in Bengaluru, varied ages. Friendliness mostly praised; phone hold times and a confusing reminder message are recurring complaints; a few billing confusions; a couple of people ask for a callback about appointments.',
    questions: ['Is the new team doing better or worse than the old one on the phone?', 'What single fix would help most patients?'],
  },
  {
    key: 'volunteers', name: 'Volunteer availability and support', who: 'Nonprofit volunteer coordinator',
    goal: 'Ask our volunteers about their availability for the next three months, which roles they prefer, and what support they need from us.',
    context: 'Community food-distribution nonprofit in Hyderabad with about sixty active volunteers. Roles: packing, driving, front desk, and outreach. We run Saturday mornings and one weekday evening.',
    personas: [
      { name: 'Nikhil', mode: 'dynamic', card: 'a volunteer who can do Saturdays only, prefers driving, and needs fuel reimbursement; brief unless asked' },
      { name: 'Sara', mode: 'dynamic', card: 'a volunteer moving cities next month who wants to stop volunteering and asks not to be called again' },
      { name: 'Imran', mode: 'fixed', card: 'a volunteer available weekday evenings, prefers packing, wants clearer shift instructions' },
    ],
    bulkGuidance: 'Volunteers at a Hyderabad food-distribution nonprofit: students, working adults, retirees. Availability skews to Saturdays; driving needs reimbursement; several ask for clearer shift instructions and a WhatsApp group; a few are stepping back.',
    questions: ['How many volunteers can cover weekday evenings?', 'What support do volunteers ask for most?'],
  },
]

const questionJudgeSchema = z.object({
  relevance: z.number().int().min(1).max(5).describe('Do the questions serve the goal?'),
  not_leading: z.number().int().min(1).max(5).describe('5 = no question presumes an answer or suggests a verdict.'),
  screening: z.number().int().min(1).max(5).describe('5 = the first question checks whether the person had the experience the goal assumes.'),
  spoken: z.number().int().min(1).max(5).describe('5 = every question sounds natural read aloud on a phone.'),
  length: z.number().int().min(1).max(5).describe('5 = the set fits a few minutes without missing a major topic.'),
  issues: z.array(z.string()).describe('Concrete problems, each naming the question.'),
  improvements: z.array(z.string()).describe('Specific rewrites or additions that would make the set better.'),
})

const turnClassSchema = z.object({
  turns: z.array(z.object({ index: z.number().int(), kind: z.enum(['opening', 'prepared_question', 'follow_up', 'clarification', 'closing', 'other']) })),
})

const personaReplySchema = z.object({ say: z.string() })

const reportJudgeSchema = z.object({
  faithfulness: z.number().int().min(1).max(5).describe('5 = every theme description is supported by its quotes and nothing is invented.'),
  coverage: z.number().int().min(1).max(5).describe('5 = the major patterns in the raw answers appear in the themes.'),
  usefulness: z.number().int().min(1).max(5).describe('5 = an organizer could act on the next steps and they follow from the evidence.'),
  honesty: z.number().int().min(1).max(5).describe('5 = gaps, simulations, and representativeness are stated plainly.'),
  summary_quality: z.number().int().min(1).max(5).describe('5 = the headline is accurate, specific, and readable.'),
  issues: z.array(z.string()).describe('Concrete problems with the report.'),
  missed_patterns: z.array(z.string()).describe('Patterns visible in the raw answers that the report did not mention.'),
  strengths: z.array(z.string()),
})

async function personaReply(persona: Persona, transcript: { speaker: string; text: string }[]) {
  const history = transcript.map((t) => `${t.speaker === 'assistant' ? 'Assistant' : 'You'}: ${t.text}`).join('\n')
  const { output } = await cheap({
    system: `You are ${persona.name}, ${persona.card}. You are answering a phone call from an AI assistant. Reply only with what you say next, in character. Answer only the question just asked, in one short spoken sentence of at most twelve words. If your card says brief, vague, or short, answer in five words or fewer and give no reasons or examples unless the assistant asks why or for an example. Never volunteer extra topics. Never ask questions back unless the card says so. If the assistant says goodbye, reply with a short goodbye.`,
    prompt: `Call so far:\n${history}\n\nWhat do you say next?`,
    schema: personaReplySchema,
  })
  return output.say
}

async function runSimulation(campaignId: string, persona: Persona, questions: string[]) {
  const { call, turn } = await startSimulation(db, campaignId, { personName: persona.name }, simRun)
  const transcript: { speaker: 'assistant' | 'person'; text: string }[] = [{ speaker: 'assistant', text: turn.text }]
  let ended = false
  let result: Awaited<ReturnType<typeof simulationTurn>>['result'] = null
  for (let i = 0; i < 16 && !ended; i++) {
    const say = await personaReply(persona, transcript)
    transcript.push({ speaker: 'person', text: say })
    const reply = await simulationTurn(db, campaignId, call.id, say, simRun)
    transcript.push({ speaker: 'assistant', text: reply.assistantTurn.text })
    ended = reply.ended
    result = reply.result
  }
  const assistantTurns = transcript.map((t, index) => ({ index, ...t })).filter((t) => t.speaker === 'assistant')
  const { output: classes } = await cheap({
    system: 'Classify each assistant turn of a phone survey. prepared_question = asks one of the prepared questions (possibly reworded); follow_up = asks for a reason, example, or detail about something the person just said; clarification = repeats or explains a question; opening = greeting and consent; closing = thanks and goodbye; other = anything else.',
    prompt: `Prepared questions:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nAssistant turns:\n${assistantTurns.map((t) => `[${t.index}] ${t.text}`).join('\n')}`,
    schema: turnClassSchema,
  })
  const counts = { opening: 0, prepared_question: 0, follow_up: 0, clarification: 0, closing: 0, other: 0 }
  for (const t of classes.turns) counts[t.kind] += 1
  const stored = getCall(db, campaignId, call.id)
  return { persona, transcript, counts, ended, outcome: result?.outcome ?? null, status: stored.status, answers: stored.answers.map((a) => ({ q: a.questionText, status: a.status, value: a.value, notes: a.notes })), callback: stored.callbackTime, optOut: stored.optOut, summary: stored.summary }
}

async function bulkResponses(campaignId: string, scenario: Scenario, questions: { id: string; text: string; type: string; options: string[] | null; required: boolean }[]) {
  const { zodSchema } = buildResultSchema(questions)
  const batchSchema = z.object({
    people: z.array(z.object({ name: z.string(), persona: z.string().describe('One line: who they are and their attitude.'), transcript: z.array(z.object({ speaker: z.enum(['assistant', 'person']), text: z.string() })).min(4).max(12), result: zodSchema })).min(BATCH).max(BATCH),
  })
  const questionMap = Object.fromEntries(questions.map((q, i) => [`q${i + 1}`, q.id]))
  let inserted = 0
  let index = 0
  const outcomes: Record<string, number> = {}
  const batches = Math.ceil(RESPONSES / BATCH)
  const generate = (batch: number) =>
    cheap({
      system: `You generate realistic synthetic phone-survey responses for testing. Produce exactly ${BATCH} different people. For each: a name, a one-line persona, a short transcript (assistant asks the prepared questions in spoken language; the person answers in their own words; include reasons and examples for some, one-word answers for others), and the result record filled EXACTLY as the transcript shows, with answer_status values for gaps and never invented content. Vary outcomes across the batch roughly: 60% completed with all answers, 15% partial (some skipped or declined), 10% did not have the experience (screening answer no, later questions not_asked), 8% callback_requested (asked to be called another time, with a preferred_time), 5% declined to take part, 2% opted_out. Use diverse Indian and international names. Rating answers are digits 1-5; choice answers use the offered options verbatim.`,
      prompt: `Audience: ${scenario.bulkGuidance}\nBatch ${batch + 1} of ${batches}: make these people different from typical ones; seed ${batch * 7919}.\n\nGoal: ${scenario.goal}\nBackground: ${scenario.context}\n\nPrepared questions:\n${questions.map((q, i) => `q${i + 1} (${q.type}${q.options?.length ? `: ${q.options.join(' / ')}` : ''}${q.required ? '' : ', optional'}): ${q.text}`).join('\n')}`,
      schema: batchSchema,
    }).then((r) => r.output.people).catch((error) => {
      log(`  bulk batch ${batch + 1} failed: ${error instanceof Error ? error.message : error}`)
      return [] as z.infer<typeof batchSchema>['people']
    })
  const generated = await Promise.all(Array.from({ length: batches }, (_, batch) => generate(batch)))
  for (const people of generated) {
    for (const person of people) {
      index += 1
      const contactId = crypto.randomUUID()
      const phone = `+9198${String(10000000 + index).padStart(8, '0')}`
      const now = Date.now() - (RESPONSES - index) * 60_000
      db.insert(contacts).values({ id: contactId, campaignId, importId: null, name: person.name, phoneRaw: phone, phone, status: 'ready', problem: null, context: { persona: person.persona }, createdAt: now, updatedAt: now }).run()
      const callId = crypto.randomUUID()
      db.insert(calls).values({ id: callId, campaignId, contactId, personName: person.name, provider: 'calle', providerCallId: `eval_${callId}`, attempt: 1, status: 'in_progress', task: 'eval', resultSchema: {}, questionMap, startedAt: now, createdAt: now, updatedAt: now }).run()
      const call = db.select().from(calls).where(eq(calls.id, callId)).get()!
      const mapped = persistCallResult(db, call, { structured: person.result, transcript: person.transcript.map((t) => ({ speaker: t.speaker, text: t.text, offsetSeconds: null })), eventType: 'eval.completed', now: now + 180_000 })
      outcomes[mapped.outcome] = (outcomes[mapped.outcome] ?? 0) + 1
      if (!mapped.parsed) outcomes.unparsed = (outcomes.unparsed ?? 0) + 1
      inserted += 1
    }
  }
  log(`  bulk: ${inserted} responses inserted from ${batches} parallel batches`)
  return { inserted, outcomes }
}

function checkReport(content: Awaited<ReturnType<typeof generateReport>>['content'], results: ReturnType<typeof campaignResults>) {
  const problems: string[] = []
  if (content.droppedCitations > 0) problems.push(`${content.droppedCitations} citations dropped`)
  for (const theme of content.themes) if (theme.peopleCount > results.responses.total) problems.push(`theme "${theme.title}" counts more people than responses`)
  for (const q of results.questions) {
    const sum = q.statusCounts.answered + q.statusCounts.skipped + q.statusCounts.declined + q.statusCounts.unknown + q.statusCounts.not_asked + q.statusCounts.missing
    if (sum !== results.responses.total) problems.push(`question "${q.text}" status counts sum ${sum} ≠ ${results.responses.total}`)
  }
  const quotes = content.themes.flatMap((t) => t.quotes)
  if (quotes.some((q) => !q.callId || !q.answerId)) problems.push('a quote lacks a call or answer id')
  return problems
}

const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const outDir = '../../docs/evaluation'
mkdirSync(outDir, { recursive: true })
const report: Record<string, unknown>[] = []
const startedAll = Date.now()

for (const scenario of scenarios.filter((s) => !only || only.includes(s.key))) {
  log(`=== ${scenario.key}: ${scenario.name}`)
  const entry: Record<string, unknown> = { key: scenario.key, name: scenario.name, who: scenario.who, goal: scenario.goal }
  const t0 = Date.now()
  const campaign = createCampaign(db, { name: scenario.name, goal: scenario.goal, context: scenario.context, additionalTopics: scenario.additionalTopics, questionSource: 'ai', conversationMode: 'dynamic' })

  const draft = await createDrafter(main)(getCampaign(db, campaign.id))
  replaceQuestions(db, campaign.id, { questions: draft.questions.map((q) => ({ text: q.text, type: q.type, options: q.options, required: q.required, source: 'ai' })), draft: { model: draft.model, promptVersion: draft.promptVersion } })
  const questions = getCampaign(db, campaign.id).questions
  log(`  drafted ${questions.length} questions in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  const { output: qJudge } = await judge({ system: 'You are an expert survey methodologist reviewing a phone questionnaire. Score honestly; 5 is excellent, 3 is acceptable, 1 is poor.', prompt: `Goal: ${scenario.goal}\nBackground: ${scenario.context}\n\nQuestions:\n${questions.map((q, i) => `${i + 1}. [${q.type}${q.options?.length ? `: ${q.options.join(' / ')}` : ''}${q.required ? '' : ', optional'}] ${q.text}`).join('\n')}`, schema: questionJudgeSchema })
  entry.questions = questions.map((q) => ({ text: q.text, type: q.type, options: q.options, required: q.required }))
  entry.questionJudge = qJudge

  const sims: Awaited<ReturnType<typeof runSimulation>>[] = []
  for (const persona of scenario.personas) {
    updateCampaign(db, campaign.id, { conversationMode: persona.mode })
    const t1 = Date.now()
    const sim = await runSimulation(campaign.id, persona, questions.map((q) => q.text))
    log(`  sim ${persona.name} (${persona.mode}): ${sim.transcript.length} turns, follow-ups ${sim.counts.follow_up}, outcome ${sim.outcome}, ${((Date.now() - t1) / 1000).toFixed(1)}s`)
    sims.push(sim)
  }
  updateCampaign(db, campaign.id, { conversationMode: 'dynamic' })
  entry.simulations = sims

  const t2 = Date.now()
  const bulk = await bulkResponses(campaign.id, scenario, questions)
  log(`  bulk: ${bulk.inserted} responses, outcomes ${JSON.stringify(bulk.outcomes)}, ${((Date.now() - t2) / 1000).toFixed(1)}s`)
  entry.bulk = bulk

  const results = campaignResults(db, campaign.id)
  entry.results = { participation: results.participation, responses: results.responses, questions: results.questions.map((q) => ({ text: q.text, type: q.type, statusCounts: q.statusCounts, rating: q.rating, choice: q.choice })) }

  const t3 = Date.now()
  const generated = await generateReport(db, campaign.id, main)
  const reportSeconds = (Date.now() - t3) / 1000
  const problems = checkReport(generated.content, results)
  log(`  report v${generated.version} in ${reportSeconds.toFixed(1)}s; themes ${generated.content.themes.length}; review ${JSON.stringify(generated.content.pipeline?.review)}; problems ${problems.length}`)
  const rawAll = results.questions.flatMap((q) => {
    const answered = q.answers.filter((a) => a.status === 'answered')
    return [`Q: ${q.text} (${answered.length} answered of ${results.responses.total})`, ...answered.slice(0, 120).map((a) => `  - "${a.value}"${a.notes ? ` (${a.notes})` : ''}`)]
  })
  const { output: rJudge } = await judge({
    system: 'You are a research lead reviewing an AI-written findings report against ALL the raw answers it was built from. People counts in the report are computed by code over every response and every quote is a verbatim stored answer; judge whether theme descriptions are faithful to the quotes and the raw answers, whether the major patterns are covered, whether next steps follow from the evidence, and whether gaps and representativeness are stated. Score honestly; 5 is excellent, 3 is acceptable, 1 is poor.',
    prompt: `Goal: ${scenario.goal}\n\nALL RAW ANSWERS (${results.responses.total} responses):\n${rawAll.join('\n')}\n\nREPORT\nHeadline: ${generated.content.headline}\nParticipation: ${JSON.stringify(results.participation)}; responses ${results.responses.total} (${results.responses.simulated} text simulations)\nThemes:\n${generated.content.themes.map((t) => `- [${t.kind}] ${t.title} (${t.peopleCount} people): ${t.description}\n  quotes: ${t.quotes.slice(0, 5).map((q) => `"${q.value ?? q.status}"`).join(' | ')}`).join('\n')}\nDisagreements: ${generated.content.disagreements.map((d) => `${d.topic}: ${d.sides.map((s) => `${s.position} (${s.peopleCount})`).join(' vs ')}`).join('; ') || 'none'}\nGaps: ${generated.content.gaps.map((g) => `${g.questionText}: skipped ${g.skipped}, declined ${g.declined}, not asked ${g.notAsked}`).join('; ') || 'none'}\nNext steps:\n${generated.content.nextSteps.map((s) => `- ${s.suggestion}`).join('\n')}`,
    schema: reportJudgeSchema,
  })
  entry.report = { version: generated.version, seconds: reportSeconds, headline: generated.content.headline, pipeline: generated.content.pipeline, droppedCitations: generated.content.droppedCitations, themes: generated.content.themes.map((t) => ({ title: t.title, kind: t.kind, peopleCount: t.peopleCount, description: t.description, quotes: t.quotes.slice(0, 3).map((q) => ({ person: q.person, value: q.value, status: q.status })) })), disagreements: generated.content.disagreements.map((d) => ({ topic: d.topic, sides: d.sides.map((s) => ({ position: s.position, peopleCount: s.peopleCount })) })), requests: generated.content.requests.map((r) => r.description), gaps: generated.content.gaps, nextSteps: generated.content.nextSteps.map((s) => ({ suggestion: s.suggestion, evidence: s.quotes.length })), problems, judge: rJudge }

  const asks = []
  for (const question of scenario.questions) {
    const t4 = Date.now()
    const answer = await askReport(db, campaign.id, question, main)
    asks.push({ question, answer: answer.answer, confidence: answer.confidence, notEnoughEvidence: answer.notEnoughEvidence, citations: answer.citations.length, seconds: (Date.now() - t4) / 1000 })
  }
  entry.asks = asks
  entry.seconds = (Date.now() - t0) / 1000
  entry.usageSoFar = Object.fromEntries(usageTotals)
  report.push(entry)
  writeFileSync(`${outDir}/run-${stamp}.json`, JSON.stringify({ startedAt: startedAll, responsesPerScenario: RESPONSES, cheapModel: CHEAP_MODEL, mainModel: aiConfig.model, scenarios: report, usage: Object.fromEntries(usageTotals) }, null, 2))
  log(`  scenario done in ${(entry.seconds as number).toFixed(0)}s; usage ${JSON.stringify(Object.fromEntries(usageTotals))}`)
}

writeFileSync(`${outDir}/run-${stamp}.md`, renderMarkdown({ stamp, mainModel: aiConfig.model, cheapModel: CHEAP_MODEL, responses: RESPONSES, scenarios: report, usage: Object.fromEntries(usageTotals) }))

log(`done in ${((Date.now() - startedAll) / 1000 / 60).toFixed(1)} min → docs/evaluation/run-${stamp}.md`)
db.$client.close()
