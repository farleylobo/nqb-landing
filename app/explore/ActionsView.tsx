"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { actionTypeLabel, isFollowUpOverdue, outcomeLabel, sortActionItems } from "@/lib/actionItems";
import { scoreColor } from "@/lib/enrichment/labels";
import {
  ACTION_OUTCOME_OPTIONS,
  ACTION_STATUS_OPTIONS,
  ACTION_TYPE_OPTIONS,
  type ActionStatus,
} from "@/lib/enrichment/types";
import type { ActionItem, Entity } from "@/lib/types";

interface Props {
  entityById: Map<string, Entity>;
  workspaceKey: string;
  readOnly: boolean;
  onSelectEntity: (id: string) => void;
}

type StatusFilter = "todos" | ActionStatus;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  ...ACTION_STATUS_OPTIONS.map((o) => ({ id: o.id as StatusFilter, label: o.label })),
];

export default function ActionsView({ entityById, workspaceKey, readOnly, onSelectEntity }: Props) {
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const key = encodeURIComponent(workspaceKey);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/actions?workspace=${key}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `falha ao carregar ações (${res.status})`);
        if (!cancelled) setItems(body.items as ActionItem[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "erro desconhecido");
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  function patchItem(updated: ActionItem) {
    setItems((all) => (all ? all.map((i) => (i.id === updated.id ? updated : i)) : all));
  }

  function removeItem(id: string) {
    setItems((all) => (all ? all.filter((i) => i.id !== id) : all));
  }

  const sorted = useMemo(() => (items ? sortActionItems(items) : []), [items]);
  const filtered = useMemo(
    () => (statusFilter === "todos" ? sorted : sorted.filter((i) => i.status === statusFilter)),
    [sorted, statusFilter]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of sorted) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [sorted]);

  if (error) {
    return <div className="m-6 rounded-lg border border-red-300 bg-red-50 p-6 text-red-800">Não foi possível carregar as ações: {error}</div>;
  }
  if (!items) {
    return <div className="flex h-full items-center justify-center text-gray-400">Carregando ações…</div>;
  }

  return (
    <div className="h-full overflow-auto px-6 py-6">
      <div className="mb-4 flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              statusFilter === f.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 text-gray-700 hover:border-gray-400"
            }`}
          >
            {f.label}
            {f.id !== "todos" && counts[f.id] ? ` (${counts[f.id]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-[60%] flex-col items-center justify-center gap-2 text-center text-gray-500">
          <p>Nenhum item aqui ainda.</p>
          <p className="text-xs">Use &quot;Adicionar às ações&quot; na ficha de uma pessoa ou na Lista para começar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <ActionCard
              key={`${item.id}:${item.updatedAt}`}
              item={item}
              person={entityById.get(item.personId) ?? null}
              workspaceKey={workspaceKey}
              readOnly={readOnly}
              onUpdated={patchItem}
              onRemoved={removeItem}
              onSelectEntity={onSelectEntity}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  item,
  person,
  workspaceKey,
  readOnly,
  onUpdated,
  onRemoved,
  onSelectEntity,
}: {
  item: ActionItem;
  person: Entity | null;
  workspaceKey: string;
  readOnly: boolean;
  onUpdated: (item: ActionItem) => void;
  onRemoved: (id: string) => void;
  onSelectEntity: (id: string) => void;
}) {
  const key = encodeURIComponent(workspaceKey);
  const [note, setNote] = useState(item.note ?? "");
  const [followUp, setFollowUp] = useState(item.followUpDate ?? "");
  const [customAction, setCustomAction] = useState(item.customActionText ?? "");
  const [customOutcome, setCustomOutcome] = useState(item.customOutcomeText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${path}?workspace=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId: item.id, ...body }),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseBody.error ?? `falha ao salvar (${res.status})`);
      onUpdated(responseBody.item as ActionItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/actions/remove?workspace=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId: item.id }),
      });
      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        throw new Error(responseBody.error ?? `falha ao remover (${res.status})`);
      }
      onRemoved(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
      setSaving(false);
    }
  }

  const overdue = isFollowUpOverdue(item.followUpDate);
  const name = person?.name ?? "(pessoa removida)";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <button onClick={() => onSelectEntity(item.personId)} className="truncate text-sm font-semibold text-gray-900 hover:underline">
            {name}
          </button>
          <div className="truncate text-xs text-gray-600">
            {person?.role ?? ""}
            {person?.role && person?.company ? " · " : ""}
            {person?.company ?? ""}
          </div>
          {item.snapshotReasons.length > 0 && (
            <div className="mt-1 text-[11px] text-gray-500">Por que apareceu: {item.snapshotReasons.slice(0, 2).join("; ")}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.snapshotScore !== null && (
            <span className="rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums text-gray-900" style={{ backgroundColor: scoreColor(item.snapshotScore) }}>
              {item.snapshotScore}
            </span>
          )}
          {item.snapshotRank !== null && <span className="text-[11px] text-gray-500">#{item.snapshotRank}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Status">
          <select
            value={item.status}
            disabled={readOnly || saving}
            onChange={(e) => post("status", { status: e.target.value })}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50"
          >
            {ACTION_STATUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Próxima ação">
          <select
            value={item.actionType ?? ""}
            disabled={readOnly || saving}
            onChange={(e) => post("type", { actionType: e.target.value || null, customText: customAction || null })}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50"
          >
            <option value="">— escolher —</option>
            {ACTION_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {item.actionType === "outro" && (
            <input
              value={customAction}
              disabled={readOnly}
              onChange={(e) => setCustomAction(e.target.value)}
              onBlur={() => customAction !== (item.customActionText ?? "") && post("type", { actionType: "outro", customText: customAction || null })}
              placeholder="Qual ação?"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 placeholder-gray-400"
            />
          )}
        </Field>

        <Field label="Follow-up">
          <input
            type="date"
            value={followUp}
            disabled={readOnly}
            onChange={(e) => setFollowUp(e.target.value)}
            onBlur={() => followUp !== (item.followUpDate ?? "") && post("follow-up", { followUpDate: followUp || null })}
            className={`w-full rounded-md border bg-white px-2 py-1.5 text-xs text-gray-900 ${overdue ? "border-red-300 text-red-700" : "border-gray-200"}`}
          />
          {overdue && <div className="mt-0.5 text-[10px] text-red-600">vencido</div>}
        </Field>

        {item.status === "concluido" ? (
          <Field label="Resultado">
            <select
              value={item.outcome ?? ""}
              disabled={readOnly || saving}
              onChange={(e) => post("status", { status: "concluido", outcome: e.target.value || null, customOutcomeText: customOutcome || null })}
              className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-50"
            >
              <option value="">— escolher —</option>
              {ACTION_OUTCOME_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {item.outcome === "outro" && (
              <input
                value={customOutcome}
                disabled={readOnly}
                onChange={(e) => setCustomOutcome(e.target.value)}
                onBlur={() =>
                  customOutcome !== (item.customOutcomeText ?? "") &&
                  post("status", { status: "concluido", outcome: "outro", customOutcomeText: customOutcome || null })
                }
                placeholder="Qual resultado?"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 placeholder-gray-400"
              />
            )}
          </Field>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>

      <textarea
        value={note}
        disabled={readOnly}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note.trim() !== (item.note ?? "") && post("note", { note: note.trim() || null })}
        placeholder="Nota (contexto, próximo passo…)"
        rows={2}
        className="mt-3 w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 placeholder-gray-400"
      />

      <div className="mt-2 flex items-center justify-between">
        <div className="text-[11px] text-gray-500">
          {actionTypeLabel(item) && <span>{actionTypeLabel(item)}</span>}
          {item.status === "concluido" && outcomeLabel(item) && <span> · {outcomeLabel(item)}</span>}
        </div>
        {!readOnly && (
          <button onClick={remove} disabled={saving} className="text-[11px] text-gray-500 hover:text-red-600 disabled:opacity-50">
            remover
          </button>
        )}
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">{label}</div>
      {children}
    </div>
  );
}
