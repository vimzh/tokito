import { z } from 'zod'

export const updateContactSchema = z
  .object({
    name: z.string().trim().max(200).nullable().optional(),
    phoneRaw: z.string().trim().max(50).optional(),
    status: z.enum(['ready', 'excluded']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update.' })

export const addOptOutSchema = z.object({
  phone: z.string().trim().min(1).max(50),
  reason: z.string().trim().max(500).optional(),
})

export const removeOptOutSchema = z.object({ phone: z.string().trim().min(1).max(50) })

export type UpdateContactInput = z.infer<typeof updateContactSchema>
export type AddOptOutInput = z.infer<typeof addOptOutSchema>
