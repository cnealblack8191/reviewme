import type { Language } from "@prisma/client";
import type { Bilingual } from "@/lib/translate";

const LABEL = { EN: { machine: "Machine translated", original: "Original" }, ES: { machine: "Traducción automática", original: "Original" } };

/**
 * Shows typed text for a reader in `lang`: the translation first when one
 * exists, the original underneath in smaller type. When there is no
 * translation, the original alone.
 */
export function Translated({ value, lang, size = 14, empty = "—" }: { value: Bilingual; lang: Language; size?: number; empty?: string }) {
  if (!value.original) return <span style={{ color: "var(--muted)" }}>{empty}</span>;
  if (!value.translated) return <span style={{ fontSize: size, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value.original}</span>;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: size, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{value.translated}</span>
      <span style={{ fontSize: Math.max(11, size - 3), color: "var(--muted)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10, marginRight: 6 }}>{LABEL[lang].machine} · {LABEL[lang].original}</span>
        {value.original}
      </span>
    </span>
  );
}
