import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db'
import { answers, calls, campaigns, contacts, questions, type Answer, type AnswerStatus, type Call, type Contact } from '../db/schema'
import { NotFoundError } from '../services/campaigns'

const REACHED: Call['status'][] = ['completed', 'declined', 'callback_requested', 'opted_out']

export type ResponseCall = Call & { person: string | null; phone: string | null }

// A person's response is their latest completed call. Simulated calls without a contact each count once.
export function responseCalls(callRows: Call[], contactRows: Contact[]): ResponseCall[] {
  const contactById = new Map(contactRows.map((contact) => [contact.id, contact]))
  const latestByContact = new Map<string, Call>()
  const detached: Call[] = []
  for (const call of callRows) {
    if (call.status !== 'completed') continue
    if (!call.contactId) {
      detached.push(call)
      continue
    }
    const current = latestByContact.get(call.contactId)
    if (!current || (call.endedAt ?? call.createdAt) >= (current.endedAt ?? current.createdAt)) latestByContact.set(call.contactId, call)
  }
  return [...latestByContact.values(), ...detached]
    .sort((a, b) => (a.endedAt ?? a.createdAt) - (b.endedAt ?? b.createdAt))
    .map((call) => {
      const contact = call.contactId ? contactById.get(call.contactId) : undefined
      return { ...call, person: contact?.name ?? call.personName, phone: contact?.phone ?? null }
    })
}

export function loadCampaignData(db: Db, campaignId: string) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get()
  if (!campaign) throw new NotFoundError('Campaign not found')
  return {
    campaign,
    questions: db.select().from(questions).where(eq(questions.campaignId, campaignId)).orderBy(asc(questions.position)).all(),
    contacts: db.select().from(contacts).where(eq(contacts.campaignId, campaignId)).all(),
    calls: db.select().from(calls).where(eq(calls.campaignId, campaignId)).orderBy(asc(calls.createdAt)).all(),
    answers: db.select().from(answers).where(eq(answers.campaignId, campaignId)).all(),
  }
}

export function campaignResults(db: Db, campaignId: string) {
  const data = loadCampaignData(db, campaignId)
  const { campaign, contacts: contactRows, calls: callRows, questions: questionRows, answers: answerRows } = data
  const byContact = new Map<string, Call[]>()
  for (const call of callRows) if (call.contactId) byContact.set(call.contactId, [...(byContact.get(call.contactId) ?? []), call])
  const latest = (contactId: string) => byContact.get(contactId)?.at(-1)
  const dialed = (call: Call) => call.provider === 'calle' && Boolean(call.providerCallId)
  const ready = contactRows.filter((contact) => contact.status === 'ready')

  const participation = {
    people: contactRows.length,
    ready: ready.length,
    called: contactRows.filter((contact) => (byContact.get(contact.id) ?? []).some(dialed)).length,
    reached: contactRows.filter((contact) => (byContact.get(contact.id) ?? []).some((call) => REACHED.includes(call.status))).length,
    completed: contactRows.filter((contact) => (byContact.get(contact.id) ?? []).some((call) => call.status === 'completed')).length,
    callbacks: contactRows.filter((contact) => latest(contact.id)?.status === 'callback_requested').length,
    declined: contactRows.filter((contact) => latest(contact.id)?.status === 'declined').length,
    optedOut: contactRows.filter((contact) => contact.status === 'opted_out' || latest(contact.id)?.status === 'opted_out').length,
    unreachable: ready.filter((contact) => {
      const own = byContact.get(contact.id) ?? []
      return own.filter(dialed).length >= campaign.maxAttempts && !own.some((call) => REACHED.includes(call.status))
    }).length,
  }

  const responses = responseCalls(callRows, contactRows)
  const responseIds = new Set(responses.map((call) => call.id))
  const responseById = new Map(responses.map((call) => [call.id, call]))
  const answersByQuestion = new Map<string, Answer[]>()
  for (const answer of answerRows) {
    if (!responseIds.has(answer.callId)) continue
    answersByQuestion.set(answer.questionId, [...(answersByQuestion.get(answer.questionId) ?? []), answer])
  }

  const questionResults = questionRows.map((question) => {
    const rows = answersByQuestion.get(question.id) ?? []
    const statusCounts: Record<AnswerStatus | 'missing', number> = { answered: 0, skipped: 0, declined: 0, unknown: 0, not_asked: 0, missing: Math.max(0, responses.length - rows.length) }
    for (const row of rows) statusCounts[row.status] += 1
    const answered = rows.filter((row) => row.status === 'answered')
    let rating: { average: number | null; distribution: Record<'1' | '2' | '3' | '4' | '5', number> } | null = null
    if (question.type === 'rating') {
      const numbers = answered.map((row) => row.valueNumber).filter((value): value is number => value !== null && value >= 1 && value <= 5)
      const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
      for (const value of numbers) distribution[String(value) as keyof typeof distribution] += 1
      rating = { average: numbers.length ? Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10) / 10 : null, distribution }
    }
    let choice: { totals: { option: string; count: number }[]; other: number } | null = null
    if (question.type === 'choice') {
      const options = question.options ?? []
      const totals = options.map((option) => ({ option, count: answered.filter((row) => row.value?.toLowerCase() === option.toLowerCase()).length }))
      choice = { totals, other: answered.length - totals.reduce((sum, item) => sum + item.count, 0) }
    }
    return {
      id: question.id,
      position: question.position,
      text: question.text,
      type: question.type,
      options: question.options,
      statusCounts,
      rating,
      choice,
      answers: rows
        .sort((a, b) => (responseById.get(a.callId)?.endedAt ?? 0) - (responseById.get(b.callId)?.endedAt ?? 0))
        .map((row) => ({ answerId: row.id, callId: row.callId, contactId: row.contactId, person: responseById.get(row.callId)?.person ?? null, provider: responseById.get(row.callId)?.provider ?? 'calle', status: row.status, value: row.value, notes: row.notes })),
    }
  })

  return {
    participation,
    responses: { total: responses.length, simulated: responses.filter((call) => call.provider === 'simulator').length },
    callStatuses: callRows.reduce<Record<string, number>>((acc, call) => ({ ...acc, [call.status]: (acc[call.status] ?? 0) + 1 }), {}),
    questions: questionResults,
  }
}
