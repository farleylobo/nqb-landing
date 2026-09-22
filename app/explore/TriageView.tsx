"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildTriageQueue, nextIndex, previousIndex, triageProgress } from "@/lib/enrichment/triageQueue";
import { FUNCTION_LABELS, SENIORITY_LABELS, SOURCE_LABELS, THEME_COLORS, THEME_LABELS, scoreColor } from "@/lib/enrichment/labels";
import { TRIAGE_OPTIONS, type Triage } from "@/lib/enrichment/types";
import type { Entity, ScoreBreakdown } from "@/lib/types";

interface Props {
  /** Already narrowed by the saved view and the sidebar filters. */
  entities: Entity[];
  /** Which view this queue came from, so the owner knows what he is judging. */
  viewLabel: string;
  /** Everyone still waiting for a decision in the whole network, as an escape hatch. */
  backlog: { count: number; onOpen: () => void } | null;
  workspaceKey: string;
  readOnly: boolean;
  onEntityUpdated: (entity: Entity) => void;
  onOpenProfile: (id: string) => void;
}

/** Keyboard is the whole point: the decision must cost one keystroke, not three clicks. */
const SHORTCUTS: Record<string, Triage> = { "1": "priorizar", "2": "reconheco", "3": "nao-reconheco", "4": "ruido" };

const TRIAGE_HINTS: Record<string, string> = {
  priorizar: "vale uma conversa agora",
  reconheco: "conheço, mas não é prioridade",
  "nao-reconheco": "não lembro de quem é",
  ruido: "não é rede para esta missão",
};

export default function TriageView({ entities, viewLabel, backlog, workspaceKey, readOnly, onEntityUpdated, onOpenProfile }: Props) {
  // The queue is built once per mount. The parent remounts this component when the
  // view or the filters change (via `key`), so decisions never reshuffle the queue
  // under the owner mid-session.
  const [queue] = useState(() => buildTriageQueue(entities));
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Triage | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [breakdowns, setBreakdowns] = useState<Record<string, ScoreBreakdown>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(0);
  const noteRef = useRef<HTMLInputElement>(null);

  const current = index < queue.length ? queue[index] : null;
  const upcoming = index + 1 < queue.length ? queue[index + 1] : null;
  const judgedCount = Object.values(decisions).filter((d) => d !== null).length;
  const progress = triageProgress(judgedCount, Math.max(queue.length - judgedCount, 0));

  // The explanation of the score is what makes the decision informed, and it only
  // comes with the detail route. Fetch the current record's and warm the next one.
  useEffect(() => {
    let cancelled = false;
    const wanted = [current, upcoming].filter((e): e is Entity => !!e && !breakdowns[e.id]);
    for (const entity of wanted) {
      fetch(`/api/entities/detail?workspace=${encodeURIComponent(workspaceKey)}&id=${entity.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (!cancelled && body?.entity?.scoreBreakdown) {
            setBreakdowns((all) => ({ ...all, [entity.id]: body.entity.scoreBreakdown }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [current, upcoming, breakdowns, workspaceKey]);

  const save = useCallback(
    async (entity: Entity, triage: Triage | null, note: string) => {
      setSaving((n) => n + 1);
      try {
        const res = await fetch(`/api/entities/triage?workspace=${encodeURIComponent(workspaceKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId: entity.id, triage, note: note.trim() || null }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `falha ao salvar (${res.status})`);
        onEntityUpdated(body.entity);
        setError(null);
      } catch (err) {
        // The decision is shown optimistically; on failure it is taken back so the
        // screen never claims something the database does not have.
        setDecisions((all) => ({ ...all, [entity.id]: null }));
        setError(`${entity.name}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [workspaceKey, onEntityUpdated]
  );

  const decide = useCallback(
    (triage: Triage | null) => {
      if (!current || readOnly) return;
      setDecisions((all) => ({ ...all, [current.id]: triage }));
      void save(current, triage, notes[current.id] ?? "");
      setIndex((i) => nextIndex(i, queue.length));
    },
    [current, readOnly, save, notes, queue.length]
  );

  const undo = useCallback(() => {
    const target = index > 0 ? queue[previousIndex(index)] : null;
    setIndex((i) => previousIndex(i));
    if (target && decisions[target.id]) {
      setDecisions((all) => ({ ...all, [target.id]: null }));
      void save(target, null, notes[target.id] ?? "");
    }
  }, [index, queue, decisions, save, notes]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      // While the owner is writing a note, the keyboard belongs to the note.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (event.key === "Escape" || event.key === "Enter") target.blur();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const triage = SHORTCUTS[event.key];
      if (triage) {
        event.preventDefault();
        decide(triage);
      } else if (event.key === "ArrowRight" || event.key === "Enter" || event.key === "s") {
        event.preventDefault();
        setIndex((i) => nextIndex(i, queue.length));
      } else if (event.key === "ArrowLeft" || event.key === "Backspace" || event.key === "u") {
        event.preventDefault();
        undo();
      } else if (event.key === "n") {
        event.preventDefault();
        noteRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decide, undo, queue.length]);

  if (queue.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-gray-700">Nada para triar nesta visão.</div>
        <div className="max-w-md text-xs text-gray-500">
          Escolha outra visão na barra lateral — &quot;Triagem pendente&quot; reúne quem tem potencial e ainda não foi avaliado por você.
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-lg font-semibold text-gray-900">Fila concluída</div>
        <div className="text-sm text-gray-600">
          {progress.judged.toLocaleString("pt-BR")} decisões nesta sessão. O score já foi recalculado para cada uma.
        </div>
        <button
          onClick={() => setIndex(0)}
          className="rounded-md border border-gray-300 px-4 py-2 text-xs text-gray-700 transition hover:border-gray-400"
        >
          Revisar a fila desde o início
        </button>
      </div>
    );
  }

  // An undone decision is an explicit null in `decisions`, which must win over
  // whatever the record carried when the queue was built.
  const decision: Triage | null = current.id in decisions ? decisions[current.id] : (current.triage as Triage | null) ?? null;
  const breakdown = breakdowns[current.id] ?? current.scoreBreakdown;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-gray-200 px-6 pb-3 pt-12">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            Triando <span className="font-semibold text-gray-700">{viewLabel}</span> ·{" "}
            <span className="font-semibold text-gray-700">{progress.judged.toLocaleString("pt-BR")}</span> decididas ·{" "}
            {progress.remaining.toLocaleString("pt-BR")} restantes · registro {(index + 1).toLocaleString("pt-BR")} de{" "}
            {queue.length.toLocaleString("pt-BR")}
          </span>
          <span className="flex items-center gap-3">
            {saving > 0 && <span className="text-gray-400">salvando…</span>}
            {backlog && backlog.count > queue.length && (
              <button onClick={backlog.onOpen} className="text-gray-600 underline decoration-neutral-700 underline-offset-2 hover:text-gray-800">
                triar os {backlog.count.toLocaleString("pt-BR")} pendentes da rede →
              </button>
            )}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded bg-gray-100">
          <div className="h-full rounded bg-neutral-400 transition-all" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">{current.name}</h2>
              {current.role && <p className="mt-1 text-sm leading-snug text-gray-600">{current.role}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {[current.company, current.location, current.connectedAt ? `conexão de ${current.connectedAt.slice(0, 7)}` : null, current.source ? SOURCE_LABELS[current.source] ?? current.source : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-3xl font-semibold tabular-nums" style={{ color: scoreColor(current.score) }}>
                {current.score ?? "—"}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">score</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {current.seniority && (
              <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-700">{SENIORITY_LABELS[current.seniority]}</span>
            )}
            {current.functions.map((f) => (
              <span key={f} className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                {FUNCTION_LABELS[f] ?? f}
              </span>
            ))}
            {current.themes.map((t) => (
              <span key={t} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: THEME_COLORS[t], color: THEME_COLORS[t] }}>
                {THEME_LABELS[t] ?? t}
              </span>
            ))}
          </div>

          {breakdown && (
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Por que apareceu aqui</div>
              <div className="flex flex-col gap-2.5">
                {breakdown.axes.map((axis) => (
                  <div key={axis.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-700">{axis.label}</span>
                      <span className="tabular-nums text-gray-500">
                        {axis.points}/{axis.max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-gray-100">
                      <div className="h-full rounded bg-neutral-300" style={{ width: `${(axis.points / axis.max) * 100}%` }} />
                    </div>
                    {axis.reasons.length > 0 && <div className="mt-1 text-[11px] leading-snug text-gray-500">{axis.reasons.join(" · ")}</div>}
                  </div>
                ))}
                {breakdown.penalties.map((p) => (
                  <div key={p.label} className="text-[11px] text-red-400">
                    −{p.points} {p.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {current.linkedinUrl && (
              <a
                href={current.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-sky-800 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-950"
              >
                Abrir perfil no LinkedIn ↗
              </a>
            )}
            <button
              onClick={() => onOpenProfile(current.id)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:border-gray-400"
            >
              Ver ficha completa
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {readOnly ? (
            <div className="text-xs text-gray-500">Workspace de demonstração — triagem desativada.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {TRIAGE_OPTIONS.map((option, i) => {
                  const active = decision === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => decide(active ? null : option.id)}
                      title={TRIAGE_HINTS[option.id]}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition ${
                        active ? "border-neutral-100 bg-neutral-100 text-gray-900" : "border-gray-300 text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      <span className={`rounded px-1 text-[10px] tabular-nums ${active ? "bg-black/15" : "bg-gray-100"}`}>{i + 1}</span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <input
                ref={noteRef}
                value={notes[current.id] ?? current.triageNote ?? ""}
                onChange={(e) => setNotes((all) => ({ ...all, [current.id]: e.target.value }))}
                onBlur={() => {
                  const note = notes[current.id];
                  if (note !== undefined && note.trim() !== (current.triageNote ?? "") && decision) void save(current, decision, note);
                }}
                placeholder="Nota opcional — como se conhecem, próximo passo… (n)"
                className="w-full rounded-md border border-gray-200 bg-black px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 focus:border-neutral-600 focus:outline-none"
              />
            </>
          )}
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
            <span>1–4 decidir</span>
            <span>→ ou Enter pular</span>
            <span>← desfazer</span>
            <span>n escrever nota</span>
          </div>
        </div>
      </div>
    </div>
  );
}
