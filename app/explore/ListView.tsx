"use client";

import { useEffect, useMemo, useState } from "react";
import { FUNCTION_LABELS, scoreColor, SENIORITY_LABELS, THEME_COLORS, THEME_LABELS, TRIAGE_LABELS } from "@/lib/enrichment/labels";
import { SENIORITY_LEVELS } from "@/lib/enrichment/taxonomy";
import type { ActionItem, Entity } from "@/lib/types";

type SortKey = "score" | "name" | "company" | "seniority" | "connectedAt";

const SENIORITY_RANK: Record<string, number> = Object.fromEntries(SENIORITY_LEVELS.map((s) => [s.id, s.rank]));
const PAGE = 200;

interface Props {
  entities: Entity[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  /** Only shown in the empty state, as a recovery action — see ExploreShell. */
  onResetView?: () => void;
  onClearFilters?: () => void;
  workspaceKey: string;
  readOnly: boolean;
}

export default function ListView({ entities, onSelect, selectedId, onResetView, onClearFilters, workspaceKey, readOnly }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [visible, setVisible] = useState(PAGE);
  // "Adicionar às ações" por linha (ADR-005) — carregado uma vez para saber quem já
  // está na aba Ações (mesmo objetivo "merlin" único de hoje) e não duplicar.
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addErrorId, setAddErrorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/actions?workspace=${encodeURIComponent(workspaceKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { items?: ActionItem[] } | null) => {
        if (!cancelled && body?.items) {
          setAddedIds(new Set(body.items.filter((i) => i.objective === "merlin").map((i) => i.personId)));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceKey]);

  async function addToActions(entityId: string) {
    setAddingId(entityId);
    setAddErrorId(null);
    try {
      const res = await fetch(`/api/actions/add?workspace=${encodeURIComponent(workspaceKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, objective: "merlin" }),
      });
      if (!res.ok) throw new Error();
      setAddedIds((prev) => new Set(prev).add(entityId));
    } catch {
      setAddErrorId(entityId);
    } finally {
      setAddingId(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "score" || key === "seniority" || key === "connectedAt" ? -1 : 1);
    }
  }

  const sorted = useMemo(() => {
    const copy = [...entities];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "score") cmp = (a.score ?? -1) - (b.score ?? -1);
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "company") cmp = (a.company ?? "").localeCompare(b.company ?? "");
      else if (sortKey === "seniority") cmp = (SENIORITY_RANK[a.seniority ?? ""] ?? 0) - (SENIORITY_RANK[b.seniority ?? ""] ?? 0);
      else if (sortKey === "connectedAt") cmp = (a.connectedAt ?? "").localeCompare(b.connectedAt ?? "");
      return cmp * sortDir;
    });
    return copy;
  }, [entities, sortKey, sortDir]);

  if (entities.length === 0) {
    // The visão and the chip filters are AND-ed (e.g. a company chip inside
    // "Prioridades" only matches that company's high-score people, which can
    // easily be none) — this can look like the filter itself is broken, so
    // offer the two independent ways out instead of a dead-end message.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-500">
        <p>Nenhum registro corresponde à visão e aos filtros atuais.</p>
        {(onResetView || onClearFilters) && (
          <div className="flex gap-2">
            {onResetView && (
              <button onClick={onResetView} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition hover:border-gray-400 hover:text-gray-900">
                Ver toda a rede
              </button>
            )}
            {onClearFilters && (
              <button onClick={onClearFilters} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition hover:border-gray-400 hover:text-gray-900">
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 pb-6 pt-12">
      {/* Fixed layout: the columns keep their share of the width and long values
          truncate, instead of the table growing past the viewport. */}
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[5.5rem]" />
          <col className="w-[22%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[18%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600">
            <Th label="Score" active={sortKey === "score"} dir={sortDir} onClick={() => toggleSort("score")} />
            <Th label="Nome" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
            <Th label="Organização" active={sortKey === "company"} dir={sortDir} onClick={() => toggleSort("company")} />
            <Th label="Decisão" active={sortKey === "seniority"} dir={sortDir} onClick={() => toggleSort("seniority")} />
            <th className="px-3 py-2">Função</th>
            <th className="px-3 py-2">Temas</th>
            <th className="px-3 py-2">Triagem</th>
            <Th label="Conexão" active={sortKey === "connectedAt"} dir={sortDir} onClick={() => toggleSort("connectedAt")} />
            <th className="px-3 py-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, visible).map((entity) => (
            <tr
              key={entity.id}
              onClick={() => onSelect(entity.id)}
              className={`cursor-pointer border-b border-gray-200 align-top transition hover:bg-gray-50 ${selectedId === entity.id ? "bg-gray-50" : ""}`}
            >
              <td className="px-3 py-2">
                {entity.score !== null ? (
                  <span className="inline-block min-w-9 rounded px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums text-gray-900" style={{ backgroundColor: scoreColor(entity.score) }}>
                    {entity.score}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="truncate font-medium text-gray-900">{entity.name}</div>
                {entity.role && <div className="truncate text-xs text-gray-600">{entity.role}</div>}
              </td>
              <td className="truncate px-3 py-2 text-gray-700">{entity.company ?? "—"}</td>
              <td className="truncate px-3 py-2 text-xs text-gray-600">{entity.seniority ? SENIORITY_LABELS[entity.seniority] : "—"}</td>
              <td className="truncate px-3 py-2 text-xs text-gray-600">
                {entity.functions.slice(0, 2).map((f) => FUNCTION_LABELS[f] ?? f).join(", ") || "—"}
              </td>
              {/* One line per row: chips never wrap, so 3.500 rows stay scannable. */}
              <td className="px-3 py-2">
                <div className="flex items-center gap-1 overflow-hidden">
                  {entity.themes.slice(0, 1).map((t) => (
                    <span
                      key={t}
                      className="min-w-0 truncate rounded-full border px-1.5 py-0.5 text-[10px]"
                      style={{ borderColor: THEME_COLORS[t], color: THEME_COLORS[t] }}
                    >
                      {THEME_LABELS[t] ?? t}
                    </span>
                  ))}
                  {entity.themes.length > 1 && (
                    <span className="shrink-0 text-[10px] text-gray-500">+{entity.themes.length - 1}</span>
                  )}
                </div>
              </td>
              <td className="truncate px-3 py-2 text-xs text-gray-600">{entity.triage ? TRIAGE_LABELS[entity.triage] : ""}</td>
              <td className="truncate px-3 py-2 text-xs tabular-nums text-gray-500">{entity.connectedAt ? entity.connectedAt.slice(0, 7) : ""}</td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {entity.type === "person" && !readOnly ? (
                  addedIds.has(entity.id) ? (
                    <span className="text-xs text-emerald-600">✓ ações</span>
                  ) : (
                    <button
                      onClick={() => addToActions(entity.id)}
                      disabled={addingId === entity.id}
                      className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-700 transition hover:border-gray-400 hover:text-gray-900 disabled:opacity-50"
                      title="Adicionar às ações"
                    >
                      {addingId === entity.id ? "…" : "+ Ações"}
                    </button>
                  )
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                {addErrorId === entity.id && <div className="mt-0.5 text-[10px] text-red-600">falhou</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {visible < sorted.length && (
        <div className="mt-4 flex justify-center">
          <button onClick={() => setVisible((v) => v + PAGE)} className="rounded-md border border-gray-300 px-4 py-2 text-xs text-gray-700 hover:border-gray-400">
            Mostrar mais ({(sorted.length - visible).toLocaleString("pt-BR")} restantes)
          </button>
        </div>
      )}
    </div>
  );
}

function Th({ label, active, dir, onClick }: { label: string; active: boolean; dir: 1 | -1; onClick: () => void }) {
  return (
    <th className="cursor-pointer select-none truncate px-3 py-2 hover:text-gray-700" onClick={onClick}>
      {label} {active ? (dir === 1 ? "↑" : "↓") : ""}
    </th>
  );
}
