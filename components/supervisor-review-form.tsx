"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupervisorDraft } from "@/lib/supervisor-draft";
import type { ReviewerLabels } from "@/lib/i18n";
import { saveSupervisorDraft, submitSupervisorDraft } from "@/app/me/review/[reviewId]/actions";

type Criterion = { id: string; label: string; workerRating?: number | null };
type SyncState = "synced" | "pending" | "offline" | "error" | "saving";

const STORAGE_PREFIX = "reviewme:draft:";

function storageKey(reviewId: string) {
  return `${STORAGE_PREFIX}${reviewId}`;
}

function readLocal(reviewId: string): { updatedAt: number; draft: SupervisorDraft } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(reviewId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(reviewId: string, draft: SupervisorDraft, updatedAt: number) {
  try {
    window.localStorage.setItem(storageKey(reviewId), JSON.stringify({ updatedAt, draft }));
  } catch {
    // Storage full or blocked: the server copy is still the fallback.
  }
}

function clearLocal(reviewId: string) {
  try {
    window.localStorage.removeItem(storageKey(reviewId));
  } catch {
    // ignore
  }
}

export function SupervisorReviewForm({
  reviewId,
  criteria,
  initial,
  serverUpdatedAt,
  locked,
  labels: L
}: {
  reviewId: string;
  criteria: Criterion[];
  initial: SupervisorDraft;
  serverUpdatedAt: number;
  locked: boolean;
  labels: ReviewerLabels;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SupervisorDraft>(initial);
  const [sync, setSync] = useState<SyncState>("synced");
  const [lastSynced, setLastSynced] = useState<number | null>(serverUpdatedAt);
  const [missing, setMissing] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);
  latest.current = draft;

  // On first load prefer a newer copy left on this phone.
  useEffect(() => {
    if (locked) return;
    const local = readLocal(reviewId);
    if (local && local.updatedAt > serverUpdatedAt) {
      setDraft(local.draft);
      dirty.current = true;
      setSync(navigator.onLine ? "pending" : "offline");
    } else if (local) {
      clearLocal(reviewId);
    }
  }, [reviewId, serverUpdatedAt, locked]);

  const flush = useCallback(async () => {
    if (!dirty.current || locked) return;
    if (!navigator.onLine) {
      setSync("offline");
      return;
    }
    setSync("saving");
    const snapshot = latest.current;
    try {
      const result = await saveSupervisorDraft(reviewId, snapshot);
      if (result.ok) {
        if (latest.current === snapshot) dirty.current = false;
        setLastSynced(result.savedAt);
        setSync(dirty.current ? "pending" : "synced");
        if (!dirty.current) clearLocal(reviewId);
      } else {
        setSync("error");
      }
    } catch {
      setSync(navigator.onLine ? "error" : "offline");
    }
  }, [reviewId, locked]);

  // Debounced sync after each change; retry when the phone comes back online.
  useEffect(() => {
    const onOnline = () => void flush();
    const onOffline = () => setSync((s) => (dirty.current ? "offline" : s));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush]);

  const update = (patch: Partial<SupervisorDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      dirty.current = true;
      writeLocal(reviewId, next, Date.now());
      return next;
    });
    setSync(navigator.onLine ? "pending" : "offline");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1500);
  };

  const setAnswer = (criterionId: string, patch: { rating?: number | null; comment?: string }) => {
    update({ answers: { ...draft.answers, [criterionId]: { ...(draft.answers[criterionId] ?? { rating: null, comment: "" }), ...patch } } });
  };

  const average = useMemo(() => {
    const ratings = criteria.map((c) => draft.answers[c.id]?.rating).filter((r): r is number => typeof r === "number");
    return ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  }, [criteria, draft.answers]);

  const answered = criteria.filter((c) => typeof draft.answers[c.id]?.rating === "number").length;

  const submit = async () => {
    if (!navigator.onLine) {
      setSync("offline");
      return;
    }
    setSubmitting(true);
    setMissing([]);
    try {
      const result = await submitSupervisorDraft(reviewId, latest.current);
      if (result.ok) {
        dirty.current = false;
        clearLocal(reviewId);
        router.push("/me");
        return;
      }
      setMissing(result.missing);
    } finally {
      setSubmitting(false);
    }
  };

  const banner = {
    synced: { text: lastSynced ? `${L.synced} ${new Date(lastSynced).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : L.synced, color: "var(--ok)", bg: "var(--ok-soft)" },
    saving: { text: L.saving, color: "var(--muted)", bg: "#eef0f2" },
    pending: { text: L.pending, color: "var(--warn)", bg: "var(--warn-soft)" },
    offline: { text: L.offline, color: "var(--warn)", bg: "var(--warn-soft)" },
    error: { text: L.syncError, color: "var(--danger)", bg: "var(--danger-soft)" }
  }[sync];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!locked ? (
        <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: banner.bg, color: banner.color, fontSize: 13, fontWeight: 600 }}>
          <span>{banner.text}</span>
          <span>{answered} / {criteria.length}</span>
        </div>
      ) : null}

      <div className="card" style={{ fontSize: 12, color: "var(--muted)" }}>{L.sectionTwo}. {L.scaleKey}</div>

      {criteria.map((c) => {
        const answer = draft.answers[c.id];
        return (
          <fieldset className="card" key={c.id} disabled={locked} style={{ border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
            <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 4px" }}>{c.label}{typeof c.workerRating === "number" ? <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "var(--info)" }}>· {L.workerRated} {c.workerRating}</span> : null}</legend>
            <div className="scale">
              {[1, 2, 3, 4].map((n) => (
                <label key={n}>
                  <input type="radio" name={`rating:${c.id}`} value={n} checked={answer?.rating === n} onChange={() => setAnswer(c.id, { rating: n })} />
                  <span>{n}</span>
                  {n}
                </label>
              ))}
            </div>
            <input
              value={answer?.comment ?? ""}
              onChange={(e) => setAnswer(c.id, { comment: e.target.value })}
              placeholder={L.supervisorComment}
              style={{ height: 40, border: "1px solid var(--line-strong)", borderRadius: 10, padding: "0 12px", fontSize: 14, width: "100%" }}
            />
          </fieldset>
        );
      })}

      <fieldset className="card" disabled={locked} style={{ border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, padding: "0 4px" }}>{L.overallRating}{average ? ` · ${L.itemsAverage} ${average}` : ""}</legend>
        <div className="scale">
          {[1, 2, 3, 4].map((n) => (
            <label key={n}>
              <input type="radio" name="overallRating" value={n} checked={draft.overallRating === n} onChange={() => update({ overallRating: n })} />
              <span>{n}</span>
              {n}
            </label>
          ))}
        </div>
        <label className="field"><span>{L.overallComments}</span><textarea value={draft.overallComments} onChange={(e) => update({ overallComments: e.target.value })} /></label>
        <label className="field"><span>{L.goals}</span><textarea value={draft.goals} onChange={(e) => update({ goals: e.target.value })} /></label>
      </fieldset>

      {missing.length ? <div className="card error">{L.stillNeeded}: {missing.join(", ")}</div> : null}

      {!locked ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn-primary btn-lg" type="button" onClick={submit} disabled={submitting || sync === "offline"}>
            {sync === "offline" ? L.submitNeedsSignal : submitting ? L.submitting : L.submitOffice}
          </button>
          <small style={{ color: "var(--muted)", textAlign: "center" }}>{L.saveHint}</small>
        </div>
      ) : null}
    </div>
  );
}
