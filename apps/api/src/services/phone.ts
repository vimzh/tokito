import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

// Returns the E.164 form of a phone number, or null when it cannot be parsed as a valid number.
export function normalizePhone(raw: string, defaultCountry: string): string | null {
  const text = raw.trim()
  if (!text) return null
  const parsed = parsePhoneNumberFromString(text, defaultCountry as CountryCode)
  return parsed?.isValid() ? parsed.number : null
}
