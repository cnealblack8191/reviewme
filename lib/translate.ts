/**
 * Machine translation of typed text with Azure AI Translator. Fixed form text
 * (questions, criteria, screen labels) is stored in both languages and never
 * goes through here. This is only for what people type: self-evaluation
 * answers, supervisor comments, goals, worker comments.
 *
 * Rules: the original is always kept and shown; a translation is labelled as
 * machine translated; a sentence is translated once and cached; when the
 * service is off or unconfigured every caller gets null and shows the original.
 */
import crypto from "node:crypto";
import type { Language } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { decryptSecret } from "@/lib/secrets";

const DEFAULT_ENDPOINT = "https://api.cognitive.microsofttranslator.com";
const MAX_BATCH = 50;

export interface TranslatorConfig {
  key: string;
  region: string;
  endpoint: string;
  source: "settings" | "environment";
}

export async function getTranslatorConfig(): Promise<TranslatorConfig | null> {
  const s = await getSettings();
  const key = decryptSecret(s.translatorKeyEnc);
  if (key && s.translatorRegion) {
    return { key, region: s.translatorRegion, endpoint: (s.translatorEndpoint || DEFAULT_ENDPOINT).replace(/\/$/, ""), source: "settings" };
  }
  const envKey = process.env.AZURE_TRANSLATOR_KEY?.trim();
  const envRegion = process.env.AZURE_TRANSLATOR_REGION?.trim();
  if (envKey && envRegion) {
    return { key: envKey, region: envRegion, endpoint: (process.env.AZURE_TRANSLATOR_ENDPOINT?.trim() || DEFAULT_ENDPOINT).replace(/\/$/, ""), source: "environment" };
  }
  return null;
}

export async function translationAvailable() {
  const s = await getSettings();
  return s.translationEnabled && Boolean(await getTranslatorConfig());
}

const code = (lang: Language) => (lang === "ES" ? "es" : "en");

function cacheKey(from: string, to: string, text: string) {
  return crypto.createHash("sha256").update(`${from}|${to}|${text}`).digest("hex");
}

interface AzureResult {
  detectedLanguage?: { language: string; score: number };
  translations: Array<{ text: string; to: string }>;
}

async function callAzure(config: TranslatorConfig, texts: string[], to: string, from?: string): Promise<AzureResult[]> {
  const url = new URL(`${config.endpoint}/translate`);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", to);
  if (from) url.searchParams.set("from", from);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Ocp-Apim-Subscription-Region": config.region,
      "Content-Type": "application/json",
      "X-ClientTraceId": crypto.randomUUID()
    },
    body: JSON.stringify(texts.map((Text) => ({ Text }))),
    cache: "no-store"
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Translator responded ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as AzureResult[];
}

/**
 * Translate many strings to `to`. Returns one entry per input: the translation,
 * or null when the input is empty, already in the target language, or the
 * service is unavailable. Never throws; failures fall back to null.
 */
export async function translateMany(texts: Array<string | null | undefined>, to: Language, from?: Language): Promise<Array<string | null>> {
  const results: Array<string | null> = texts.map(() => null);
  const settings = await getSettings();
  if (!settings.translationEnabled) return results;
  const config = await getTranslatorConfig();
  if (!config) return results;

  const toCode = code(to);
  const fromCode = from ? code(from) : "auto";
  const wanted: Array<{ index: number; text: string; key: string }> = [];
  texts.forEach((raw, index) => {
    const text = (raw ?? "").trim();
    if (!text) return;
    wanted.push({ index, text, key: cacheKey(fromCode, toCode, text) });
  });
  if (!wanted.length) return results;

  const cached = await prisma.translation.findMany({ where: { key: { in: wanted.map((w) => w.key) } } });
  const byKey = new Map(cached.map((c) => [c.key, c]));
  const misses = wanted.filter((w) => !byKey.has(w.key));
  for (const w of wanted) {
    const hit = byKey.get(w.key);
    if (hit) results[w.index] = hit.sourceLang === toCode ? null : hit.translatedText;
  }

  for (let i = 0; i < misses.length; i += MAX_BATCH) {
    const batch = misses.slice(i, i + MAX_BATCH);
    try {
      const azure = await callAzure(config, batch.map((b) => b.text), toCode, from ? fromCode : undefined);
      await Promise.all(
        batch.map(async (b, j) => {
          const item = azure[j];
          const detected = from ? fromCode : item?.detectedLanguage?.language ?? "und";
          const translated = item?.translations?.[0]?.text ?? b.text;
          const sameLanguage = detected === toCode;
          results[b.index] = sameLanguage ? null : translated;
          await prisma.translation
            .create({ data: { key: b.key, sourceLang: detected, targetLang: toCode, sourceText: b.text, translatedText: sameLanguage ? b.text : translated, provider: "azure" } })
            .catch(() => undefined);
        })
      );
    } catch (error) {
      console.error("[translate]", error instanceof Error ? error.message : error);
    }
  }
  return results;
}

export async function translateOne(text: string | null | undefined, to: Language, from?: Language) {
  const [result] = await translateMany([text], to, from);
  return result;
}

/** Pair an original with its translation for display. */
export interface Bilingual {
  original: string;
  translated: string | null;
}

export async function bilingualMany(texts: Array<string | null | undefined>, to: Language, from?: Language): Promise<Bilingual[]> {
  const translations = await translateMany(texts, to, from);
  return texts.map((t, i) => ({ original: (t ?? "").trim(), translated: translations[i] }));
}

/** A live round-trip for the Settings test button. Throws with the provider's message on failure. */
export async function testTranslator() {
  const config = await getTranslatorConfig();
  if (!config) throw new Error("Translator is not configured.");
  const [result] = await callAzure(config, ["Good morning. Your review is ready."], "es", "en");
  return result.translations[0]?.text ?? "";
}
