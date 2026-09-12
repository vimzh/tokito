import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { preferencesContent as copy } from "@/data/campaign";

export type PreferenceValues = {
  language: "en" | "hi";
  maxCallMinutes: number;
  callingHoursStart: string;
  callingHoursEnd: string;
  timezone: string;
  maxAttempts: number;
  defaultCountry: string;
};

export function PreferencesFields({ values, idPrefix }: { values: PreferenceValues; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const countries = copy.countries.some((country) => country.value === values.defaultCountry) ? copy.countries : [{ value: values.defaultCountry, label: values.defaultCountry }, ...copy.countries];
  const timezones = copy.timezones.includes(values.timezone as (typeof copy.timezones)[number]) ? copy.timezones : [values.timezone, ...copy.timezones];
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={id("language")}>{copy.language}</Label>
        <NativeSelect id={id("language")} name="language" defaultValue={values.language} className="w-full">
          {copy.languages.map((language) => <NativeSelectOption key={language.value} value={language.value}>{language.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="space-y-2"><Label htmlFor={id("minutes")}>{copy.maxCallMinutes}</Label><Input id={id("minutes")} name="maxCallMinutes" type="number" min={1} max={20} required defaultValue={values.maxCallMinutes} /></div>
      <div className="space-y-2"><Label htmlFor={id("start")}>{copy.callingHoursStart}</Label><Input id={id("start")} name="callingHoursStart" type="time" required defaultValue={values.callingHoursStart} /></div>
      <div className="space-y-2"><Label htmlFor={id("end")}>{copy.callingHoursEnd}</Label><Input id={id("end")} name="callingHoursEnd" type="time" required defaultValue={values.callingHoursEnd} /></div>
      <div className="space-y-2">
        <Label htmlFor={id("timezone")}>{copy.timezone}</Label>
        <NativeSelect id={id("timezone")} name="timezone" defaultValue={values.timezone} className="w-full">
          {timezones.map((timezone) => <NativeSelectOption key={timezone} value={timezone}>{timezone}</NativeSelectOption>)}
        </NativeSelect>
      </div>
      <div className="space-y-2"><Label htmlFor={id("attempts")}>{copy.maxAttempts}</Label><Input id={id("attempts")} name="maxAttempts" type="number" min={1} max={5} required defaultValue={values.maxAttempts} /></div>
      <div className="space-y-2">
        <Label htmlFor={id("country")}>{copy.defaultCountry}</Label>
        <NativeSelect id={id("country")} name="defaultCountry" defaultValue={values.defaultCountry} className="w-full">
          {countries.map((country) => <NativeSelectOption key={country.value} value={country.value}>{country.label}</NativeSelectOption>)}
        </NativeSelect>
      </div>
    </div>
  );
}
