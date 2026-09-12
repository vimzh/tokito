// Development seed: three draft campaigns so a fresh workspace is not empty.
import { eq } from 'drizzle-orm'
import { db } from '.'
import { campaigns } from './schema'
import { createCampaign } from '../services/campaigns'

const seeds = [
  {
    name: 'New menu feedback',
    goal: 'Understand what customers think of our new menu, including choices, portions, and prices.',
    questionSource: 'manual',
    conversationMode: 'dynamic',
    questions: [
      'Which dishes have you tried from the new menu?',
      'What did you enjoy, and what would you change?',
      'How did the portion size and price compare with your expectations?',
    ],
  },
  {
    name: 'Society event feedback',
    goal: 'Learn what members enjoyed about our last event and what would make the next one better.',
    questionSource: 'manual',
    conversationMode: 'dynamic',
    questions: [
      'What was the most useful part of the event?',
      'Was anything difficult or confusing?',
      'What would you like us to organize next?',
    ],
  },
  {
    name: 'Workshop check-in',
    goal: 'Find out which workshop topics helped participants and where they need more explanation.',
    questionSource: 'manual',
    conversationMode: 'fixed',
    questions: [
      'Which part of the workshop was most useful?',
      'Where would you like more explanation?',
      'How do you plan to use what you learned?',
    ],
  },
] as const

let inserted = 0
for (const seed of seeds) {
  const existing = db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.name, seed.name)).get()
  if (existing) continue
  createCampaign(db, { ...seed, questions: [...seed.questions] })
  inserted += 1
}
console.log(`Seeded ${inserted} campaign(s); ${seeds.length - inserted} already present.`)
db.$client.close()
