"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ROUND_SIZE, MAX_ROUND_SIZE, REFINEMENT_ACTION_OPTIONS, REFINEMENT_AXIS_QUESTIONS, type RefinementAnswers } from "@/lib/enrichment/refinement";
import type { Entity, RefinementRound, RefinementRoundItem } from "@/lib/types";

// Rodada de Refinamento (ADR-008). Um questionário fechado e sequencial
// sobre um lote limitado de pessoas (padrão 20), para o dono aprofundar o
// perfil de quem já está no topo do score sem virar trabalho sem fim. Cada
// resposta vira, no servidor, um override de eixo já existente ou um item
// em Ações — este componente só coleta as respostas e mostra progresso.

interface Props {
  workspaceKey: string;
  objective: string; // hoje sempre "merlin" (único objetivo existente) — mesmo padrão hardcoded do resto do app
  entityById: Map<string, Entity>;
  onClose: () => void;
  onEntityUpdated: (entity: Entity) => void;
  /** Abre a ficha de uma pessoa — usado no recap final pra ir direto a quem acabou de ser respondido. */
  onSelectEntity: (entityId: string) => void;
}

type Stage = "start" | "question" | "done";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `falha (${res.status})`);
  return json as T;
}

export default function RefinementRoundPanel({ workspaceKey, objective, entityById, onClose, onEntityUpdated, onSelectEntity }: Props) {
  const key = encodeURIComponent(workspaceKey);
  const [stage, setStage] = useState<Stage>("start");
  const [size, setSize] = useState(DEFAULT_ROUND_SIZE);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState<RefinementRound | null>(null);
  const [items, setItems] = useState<RefinementRoundItem[]>([]);
  const [current, setCurrent] = useState<RefinementRoundItem | null>(null);
  const [answers, setAnswers] = useState<RefinementAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [existingRounds, setExistingRounds] = useState<RefinementRound[]>([]);
  // Recap da tela final: pessoa + resultado, na ordem em que foram processadas.
  const [processed, setProcessed] = useState<{ personId: string; entity: Entity | null; skipped: boolean }[]>([]);

  useEffect(() => {
    fetch(`/api/network/refinement-rounds?workspace=${key}`)
      .then((r) => r.json())
      .then((body: { rounds?: RefinementRound[] }) => setExistingRounds((body.rounds ?? []).filter((r) => r.status === "em-andamento" && r.objective === objective)))
      .catch(() => {});
  }, [key, objective]);

  function pickNextPending(list: RefinementRoundItem[]) {
    const next = list.find((i) => i.status === "pendente") ?? null;
    setCurrent(next);
    setAnswers({});
    if (!next) setStage("done");
  }

  async function startRound() {
    setCreating(true);
    setError(null);
    try {
      const detail = await post<{ round: RefinementRound; items: RefinementRoundItem[] }>(`/api/network/refinement-rounds?workspace=${key}`, {
        objective,
        size,
      });
      setRound(detail.round);
      setItems(detail.items);
      setStage("question");
      pickNextPending(detail.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao criar a rodada");
    } finally {
      setCreating(false);
    }
  }

  async function resumeRound(r: RefinementRound) {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/network/refinement-rounds/detail?workspace=${key}&roundId=${r.id}`);
      const body: { round: RefinementRound; items: RefinementRoundItem[] } = await res.json();
      if (!res.ok) throw new Error("não foi possível abrir a rodada");
      setRound(body.round);
      setItems(body.items);
      setStage("question");
      pickNextPending(body.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao abrir a rodada");
    } finally {
      setCreating(false);
    }
  }

  async function submitAnswer() {
    if (!round || !current) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await post<{ item: RefinementRoundItem; entity: Entity | null }>(`/api/network/refinement-rounds/answer?workspace=${key}`, {
        roundId: round.id,
        itemId: current.id,
        answers,
      });
      if (result.entity) onEntityUpdated(result.entity);
      setProcessed((prev) => [...prev, { personId: current.personId, entity: result.entity, skipped: false }]);
      const nextItems = items.map((i) => (i.id === result.item.id ? result.item : i));
      setItems(nextItems);
      pickNextPending(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao salvar resposta");
    } finally {
      setSubmitting(false);
    }
  }

  async function skipCurrent() {
    if (!round || !current) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await post<{ item: RefinementRoundItem }>(`/api/network/refinement-rounds/skip?workspace=${key}`, { roundId: round.id, itemId: current.id });
      setProcessed((prev) => [...prev, { personId: current.personId, entity: null, skipped: true }]);
      const nextItems = items.map((i) => (i.id === result.item.id ? result.item : i));
      setItems(nextItems);
      pickNextPending(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao pular");
    } finally {
      setSubmitting(false);
    }
  }

  function openFicha(personId: string) {
    onSelectEntity(personId);
    onClose();
  }

  const answered = items.filter((i) => i.status !== "pendente").length;
  const entity = current ? entityById.get(current.personId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-gray-300 bg-white text-sm text-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="text-base font-semibold text-gray-900">Rodada de refinamento</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {stage === "start" && (
            <div className="flex flex-col gap-4">
              <p className="text-gray-600">
                Responda algumas perguntas fechadas sobre um lote de pessoas do topo do score, pra deixar o perfil delas mais preciso. Cada resposta ajusta o
                score diretamente (mesmo mecanismo de ajuste manual da ficha) ou vira um item em Ações — não é um score novo, é o mesmo de sempre, mais
                informado.
              </p>
              {existingRounds.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rodadas em andamento</p>
                  <div className="flex flex-col gap-2">
                    {existingRounds.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => resumeRound(r)}
                        disabled={creating}
                        className="rounded-md border border-gray-300 px-3 py-2 text-left text-xs hover:border-neutral-400 disabled:opacity-50"
                      >
                        Rodada iniciada em {new Date(r.createdAt).toLocaleDateString("pt-BR")} — continuar
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Quantas pessoas nesta rodada (sugestão automática, top do score):
                <input
                  type="number"
                  min={1}
                  max={MAX_ROUND_SIZE}
                  value={size}
                  onChange={(e) => setSize(Math.max(1, Math.min(MAX_ROUND_SIZE, Number(e.target.value) || DEFAULT_ROUND_SIZE)))}
                  className="w-20 rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-gray-900"
                />
              </label>
              {error && <div className="text-red-400">{error}</div>}
              <button
                onClick={startRound}
                disabled={creating}
                className="self-start rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                {creating ? "Criando…" : "Iniciar nova rodada"}
              </button>
            </div>
          )}

          {stage === "question" && current && (
            <div className="flex flex-col gap-4">
              <div className="text-xs text-gray-500">
                {answered} de {items.length} · pode pular qualquer pessoa ou pergunta
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900">{entity?.name ?? "Pessoa"}</div>
                <div className="text-xs text-gray-600">{[entity?.role, entity?.company].filter(Boolean).join(" · ") || "—"}</div>
              </div>

              {REFINEMENT_AXIS_QUESTIONS.map((q) => (
                <fieldset key={q.axis} className="rounded-md border border-gray-200 p-3">
                  <legend className="px-1 text-xs font-medium text-gray-700">{q.prompt}</legend>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {q.options.map((opt) => (
                      <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                        <input
                          type="radio"
                          name={q.axis}
                          checked={answers[q.axis] === opt.id}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.axis]: opt.id }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              <fieldset className="rounded-md border border-gray-200 p-3">
                <legend className="px-1 text-xs font-medium text-gray-700">Ação imediata (opcional)</legend>
                <div className="mt-2 flex flex-col gap-1.5">
                  {REFINEMENT_ACTION_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-xs text-gray-700">
                      <input type="radio" name="acao" checked={answers.acao === opt.id} onChange={() => setAnswers((prev) => ({ ...prev, acao: opt.id }))} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {error && <div className="text-red-400">{error}</div>}
            </div>
          )}

          {stage === "done" && (
            <div className="flex flex-col gap-3">
              <div className="text-center">
                <div className="text-gray-900">Rodada concluída — {answered} de {items.length} pessoas processadas.</div>
                <p className="text-xs text-gray-500">Os scores ajustados já estão refletidos na rede. Ações criadas aparecem na aba Ações.</p>
              </div>
              {processed.length > 0 && (
                <div className="rounded-md border border-gray-200">
                  {processed.map(({ personId, entity: resultEntity, skipped }) => {
                    const person = resultEntity ?? entityById.get(personId);
                    return (
                      <button
                        key={personId}
                        onClick={() => openFicha(personId)}
                        className="flex w-full items-center justify-between border-b border-neutral-900 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-gray-50"
                      >
                        <span className="truncate text-gray-800">{person?.name ?? "Pessoa"}</span>
                        <span className="shrink-0 text-gray-500">{skipped ? "pulada" : `score ${person?.score ?? "—"}`}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          {stage === "question" && (
            <>
              <button onClick={skipCurrent} disabled={submitting} className="rounded-md px-4 py-2 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50">
                Pular esta pessoa
              </button>
              <button
                onClick={submitAnswer}
                disabled={submitting}
                className="rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
              >
                {submitting ? "Salvando…" : "Salvar e continuar"}
              </button>
            </>
          )}
          {stage === "done" && (
            <button onClick={onClose} className="rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50">
              Fechar
            </button>
          )}
          {stage === "start" && (
            <button onClick={onClose} className="rounded-md px-4 py-2 text-xs text-gray-600 hover:text-gray-800">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
