import enUS from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";

export type Language = "system" | "en-US" | "zh-CN";
type Dictionary = Record<string, string>;

export function resolveLanguage(preference: Language, steamLanguage?: string): Exclude<Language, "system"> {
  if (preference !== "system") return preference;
  const browserLanguage = typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "en-US";
  return (steamLanguage || browserLanguage).toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function translate(language: Exclude<Language, "system">, key: string, values: Record<string, string> = {}): string {
  const dictionary: Dictionary = language === "zh-CN" ? zhCN : enUS;
  const fallback: Dictionary = enUS;
  return (dictionary[key] || fallback[key] || key).replace(/\{(\w+)\}/g, (_match: string, name: string) => values[name] ?? `{${name}}`);
}
