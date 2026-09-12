import type { Db } from '../db'
import { campaignResults, loadCampaignData, responseCalls } from '../calls/results'

export type EvidenceItem = {
  id: string
  answerId: string
  callId: string
  contactId: string | null
  person: string | null
  simulated: boolean
  questionId: string
  questionText: string
  status: 'answered' | 'skipped' | 'declined' | 'unknown' | 'not_asked'
  value: string | null
  notes: string | null
}

export type EvidencePack = {
  goal: string
  context: string | null
  questions: { id: string; text: string; type: string }[]
  items: EvidenceItem[]
  calls: { callId: string; person: string | null; simulated: boolean; summary: string | null; requests: string | null; callbackTime: string | null; optOut: boolean }[]
  results: ReturnType<typeof campaignResults>
}

// Everything the model may cite, with short ids so citations stay reliable.
export function buildEvidencePack(db: Db, campaignId: string): EvidencePack {
  const data = loadCampaignData(db, campaignId)
  const results = campaignResults(db, campaignId)
  const responses = responseCalls(data.calls, data.contacts)
  const responseById = new Map(responses.map((call) => [call.id, call]))
  const questionById = new Map(data.questions.map((question) => [question.id, question]))
  const rows = data.answers
    .filter((answer) => responseById.has(answer.callId))
    .sort((a, b) => (questionById.get(a.questionId)?.position ?? 0) - (questionById.get(b.questionId)?.position ?? 0) || (responseById.get(a.callId)?.endedAt ?? 0) - (responseById.get(b.callId)?.endedAt ?? 0))
  const items: EvidenceItem[] = rows.map((answer, index) => {
    const call = responseById.get(answer.callId)!
    return {
      id: `e${index + 1}`,
      answerId: answer.id,
      callId: answer.callId,
      contactId: answer.contactId,
      person: call.person,
      simulated: call.provider === 'simulator',
      questionId: answer.questionId,
      questionText: questionById.get(answer.questionId)?.text ?? answer.questionText,
      status: answer.status,
      value: answer.value,
      notes: answer.notes,
    }
  })
  return {
    goal: data.campaign.goal,
    context: data.campaign.context,
    questions: data.questions.map((question) => ({ id: question.id, text: question.text, type: question.type })),
    items,
    calls: responses.map((call) => ({ callId: call.id, person: call.person, simulated: call.provider === 'simulator', summary: call.summary, requests: call.requestsForOrganizer, callbackTime: call.callbackTime, optOut: call.optOut })),
    results,
  }
}

export function renderEvidence(pack: EvidencePack) {
  const lines: string[] = []
  lines.push(`GOAL: ${pack.goal}`)
  if (pack.context) lines.push(`BACKGROUND: ${pack.context}`)
  lines.push('', `QUESTIONS:`)
  pack.questions.forEach((question, index) => lines.push(`Q${index + 1} (${question.type}): ${question.text}`))
  lines.push('', `PEOPLE: ${pack.results.participation.people} in the list, ${pack.results.participation.reached} reached, ${pack.results.responses.total} completed responses (${pack.results.responses.simulated} text simulations).`)
  lines.push('', 'EVIDENCE (cite by id; quote only what is here):')
  for (const item of pack.items) {
    const who = `${item.person ?? 'Unnamed'}${item.simulated ? ' [simulation]' : ''}`
    const body = item.status === 'answered' ? `"${item.value ?? ''}"${item.notes ? ` (notes: "${item.notes}")` : ''}` : `[${item.status}]`
    lines.push(`${item.id} | ${who} | ${item.questionText} | ${body}`)
  }
  const extras = pack.calls.filter((call) => call.summary || call.requests || call.callbackTime)
  if (extras.length) {
    lines.push('', 'CALL SUMMARIES (context only, not citable):')
    for (const call of extras) lines.push(`- ${call.person ?? 'Unnamed'}${call.simulated ? ' [simulation]' : ''}: ${call.summary ?? ''}${call.requests ? ` Requests: ${call.requests}` : ''}${call.callbackTime ? ` Callback: ${call.callbackTime}` : ''}`)
  }
  return lines.join('\n')
}
