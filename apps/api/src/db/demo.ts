// Demo data for the two-minute walkthrough: a campaign with contacts, two finished text simulations, and answers.
import { eq } from 'drizzle-orm'
import { db } from '.'
import { answers, calls, callTurns, campaigns } from './schema'
import { createCampaign, replaceQuestions } from '../services/campaigns'
import { commitImport, createImport, listContacts } from '../services/contacts'

const NAME = 'Society event feedback (demo)'
if (db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.name, NAME)).get()) {
  console.log('Demo campaign already present.')
} else {
  const campaign = createCampaign(db, {
    name: NAME,
    goal: 'Learn what members enjoyed about our last event and what would make the next one better.',
    context: 'We are a university photography society. The event was a two-hour evening talk with a hands-on session; about forty members came.',
    questionSource: 'manual',
    conversationMode: 'dynamic',
    questions: ['x'],
  })
  const qs = replaceQuestions(db, campaign.id, {
    questions: [
      { text: 'Did you come to the evening talk last week?', type: 'choice', options: ['Yes', 'No'], required: true, source: 'manual' },
      { text: 'What was the most useful part of the event for you?', type: 'open', options: [], required: true, source: 'manual' },
      { text: 'How would you rate the hands-on session from 1 to 5?', type: 'rating', options: [], required: true, source: 'manual' },
      { text: 'What would you like us to organize next?', type: 'open', options: [], required: false, source: 'manual' },
    ],
  }).questions
  const preview = createImport(db, campaign.id, 'members.csv', new TextEncoder().encode('Name,Phone,Year\nAsha Verma,9876543210,2nd year\nRavi Menon,+91 98765 43211,3rd year\nMeera Iyer,9876543212,1st year\nDev Patel,,2nd year\nAsha Verma,09876543210,2nd year\n'))
  commitImport(db, campaign.id, preview.id, { nameColumn: 0, phoneColumn: 1, contextColumns: [2] })
  const [asha, ravi] = listContacts(db, campaign.id).contacts
  const now = Date.now()
  const sim = (contactId: string, personName: string, turns: [speaker: 'assistant' | 'person', text: string][], values: [status: 'answered' | 'skipped' | 'declined', value: string | null, num?: number, notes?: string][], summary: string) => {
    const id = crypto.randomUUID()
    db.insert(calls).values({ id, campaignId: campaign.id, contactId, personName, provider: 'simulator', attempt: 1, status: 'completed', task: 'demo', resultSchema: {}, questionMap: Object.fromEntries(qs.map((q, i) => [`q${i + 1}`, q.id])), summary, startedAt: now - 300_000, endedAt: now - 120_000, durationSeconds: 180, createdAt: now - 300_000, updatedAt: now - 120_000 }).run()
    turns.forEach(([speaker, text], position) => db.insert(callTurns).values({ id: crypto.randomUUID(), callId: id, position, speaker, text, offsetSeconds: position * 12 }).run())
    values.forEach(([status, value, num, notes], index) => db.insert(answers).values({ id: crypto.randomUUID(), callId: id, campaignId: campaign.id, contactId, questionId: qs[index]!.id, questionText: qs[index]!.text, status, value, valueNumber: num ?? null, notes: notes ?? null, createdAt: now - 120_000 }).run())
  }
  sim(asha!.id, 'Asha Verma', [
    ['assistant', 'Hi Asha, this is Tokito, an AI assistant calling for the photography society about last week’s talk. It takes a few minutes and I take notes for the committee. Is now a good time?'],
    ['person', 'Sure.'], ['assistant', 'Did you come to the evening talk last week?'], ['person', 'Yes, I did.'],
    ['assistant', 'What was the most useful part for you?'], ['person', 'The hands-on bit with the lighting setups. I finally understood off-camera flash.'],
    ['assistant', 'What made that click for you?'], ['person', 'Trying it myself with someone correcting me, rather than watching slides.'],
    ['assistant', 'How would you rate the hands-on session from 1 to 5?'], ['person', 'A five.'],
    ['assistant', 'What would you like us to organize next?'], ['person', 'A portrait walk outdoors.'], ['assistant', 'Thank you, Asha. The committee will read your answers. Goodbye.'],
  ], [['answered', 'Yes'], ['answered', 'The hands-on bit with the lighting setups. I finally understood off-camera flash.', undefined, 'Trying it myself with someone correcting me, rather than watching slides.'], ['answered', '5', 5], ['answered', 'A portrait walk outdoors.']], 'Asha attended, valued the hands-on lighting session because she could try it with correction, rated it 5, and asked for an outdoor portrait walk next.')
  sim(ravi!.id, 'Ravi Menon', [
    ['assistant', 'Hi Ravi, this is Tokito, an AI assistant calling for the photography society about last week’s talk. Is now a good time?'],
    ['person', 'Yes, go ahead.'], ['assistant', 'Did you come to the evening talk last week?'], ['person', 'I did.'],
    ['assistant', 'What was the most useful part for you?'], ['person', 'Honestly the talk itself. The hands-on part was too crowded, I never got near a light.'],
    ['assistant', 'How would you rate the hands-on session from 1 to 5?'], ['person', 'Two, because of the crowding.'],
    ['assistant', 'What would you like us to organize next?'], ['person', 'I would rather not say.'], ['assistant', 'That is fine. Thank you, Ravi. Goodbye.'],
  ], [['answered', 'Yes'], ['answered', 'The talk itself. The hands-on part was too crowded, I never got near a light.'], ['answered', '2', 2, 'because of the crowding'], ['declined', null]], 'Ravi attended, found the talk most useful, and rated the hands-on session 2 because it was too crowded to reach a light. He declined to suggest a next event.')
  console.log(`Seeded demo campaign "${NAME}" with 5 contact rows and 2 simulated calls.`)
}
db.$client.close()
