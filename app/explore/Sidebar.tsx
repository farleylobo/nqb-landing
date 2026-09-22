"use client";

import { useMemo, useState, type ReactNode } from "react";
import { facetCounts, filterNetwork, NO_TRIAGE, type EntityFilters } from "@/lib/filterEntities";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DATA_QUALITY_LABELS, type DataQuality } from "@/lib/dataQuality";
import { GROUP_BY_OPTIONS, type GroupBy } from "@/lib/enrichment/grouping";
import { countPeopleByCompany, type CompanyCount } from "@/lib/enrichment/hubs";
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FUNCTION_LABELS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ORG_TYPE_LABELS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SENIORITY_LABELS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SOURCE_LABELS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  THEME_COLORS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  THEME_LABELS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TRIAGE_LABELS,
} from "@/lib/enrichment/labels";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SENIORITY_LEVELS, type WorkspaceSettings } from "@/lib/enrichment/taxonomy";
import { SAVED_VIEWS, type ViewContext, type ViewId } from "@/lib/enrichment/views";
import type { Entity, EntityType } from "@/lib/types";

const TYPE_LABELS: Record<EntityType, string> = {
  person: "Pessoas",
  organization: "Organizações",
  framework: "Frameworks",
  network: "Redes",
};

interface Props {
  entities: Entity[];
  settings: WorkspaceSettings;
  viewCtx: ViewContext;
  hubs: CompanyCount[];
  savedView: ViewId;
  onSavedViewChange: (view: ViewId) => void;
  filters: EntityFilters;
  onFiltersChange: (filters: EntityFilters) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  showGroupBy: boolean;
  allClusters: string[];
}

function toggle(list: string[] | undefined, value: string): string[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

type ArrayFilterKey = "themes" | "seniority" | "functions" | "orgTypes" | "companyKeys" | "sources" | "triage" | "types" | "clusters" | "dataQuality";

export default function Sidebar({
  entities,
  settings,
  viewCtx,
  hubs,
  savedView,
  onSavedViewChange,
  filters,
  onFiltersChange,
  groupBy,
  onGroupByChange,
  showGroupBy,
  allClusters,
}: Props) {
  // Facet counts reflect the active view and search, not the other chip filters,
  // so each chip shows how many records selecting it would add.
  const base = useMemo(() => filterNetwork(entities, savedView, { query: filters.query }, viewCtx), [entities, savedView, filters.query, viewCtx]);
  const viewCounts = useMemo(() => {
    const counts = new Map<ViewId, number>();
    for (const view of SAVED_VIEWS) counts.set(view.id, filterNetwork(entities, view.id, {}, viewCtx).length);
    return counts;
  }, [entities, viewCtx]);

  // Same base (current view + search, before the other chip filters) as every
  // other facet below — the hub panel used to show raw, view-independent
  // counts (hub.people/hub.decisionMakers from the whole network), which
  // made a chip promise e.g. "141 pessoas" while the active view (often
  // "Prioridades" by default on a large network) actually matched none of
  // them once selected. Reported as "o filtro parece não funcionar".
  const hubBaseCounts = useMemo(() => countPeopleByCompany(base), [base]);
  const themeCounts = useMemo(() => facetCounts(base, (e) => e.themes), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const seniorityCounts = useMemo(() => facetCounts(base, (e) => [e.seniority]), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const functionCounts = useMemo(() => facetCounts(base, (e) => e.functions), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const orgCounts = useMemo(() => facetCounts(base, (e) => [e.orgType]), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sourceCounts = useMemo(() => facetCounts(base, (e) => [e.source]), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const triageCounts = useMemo(() => facetCounts(base, (e) => [e.triage ?? NO_TRIAGE]), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const typeCounts = useMemo(() => facetCounts(base, (e) => [e.type]), [base]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of entities) if (e.connectedAt) set.add(new Date(e.connectedAt).getUTCFullYear());
    return [...set].sort((a, b) => a - b);
  }, [entities]);

  const set = (patch: Partial<EntityFilters>) => onFiltersChange({ ...filters, ...patch });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleIn = (key: ArrayFilterKey, value: string) => set({ [key]: toggle(filters[key] as string[] | undefined, value) } as Partial<EntityFilters>);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "query" && (Array.isArray(v) ? v.length > 0 : !!v)).length;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const themeOrder = [...settings.coreThemes, ...settings.adjacentThemes, ...[...themeCounts.keys()].filter((t) => !settings.coreThemes.includes(t as never) && !settings.adjacentThemes.includes(t as never))];

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white text-sm">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
        <input
          type="search"
          placeholder="Buscar nome, cargo, organização…"
          value={filters.query ?? ""}
          onChange={(e) => set({ query: e.target.value })}
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-5 p-4">
        <Section title="Visões">
          <div className="flex flex-col gap-0.5">
            {SAVED_VIEWS.map((view) => {
              const active = view.id === savedView;
              return (
                <button
                  key={view.id}
                  onClick={() => onSavedViewChange(view.id)}
                  title={view.question}
                  className={`flex items-center justify-between rounded px-2 py-1.5 text-left transition ${
                    active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{view.label}</span>
                  <span className={`text-xs tabular-nums ${active ? "text-gray-400" : "text-gray-500"}`}>
                    {(viewCounts.get(view.id) ?? 0).toLocaleString("pt-BR")}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {showGroupBy && (
          <Section title="Agrupar mapa por">
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1.5 text-gray-900"
            >
              {GROUP_BY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Section>
        )}

        {/* FILTERS SECTION TEMPORARILY REMOVED FOR LAYOUT FIX */}
      </div>
    </aside>
  );
}
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="mb-2 flex w-full items-center justify-between text-left">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
        <span className="text-xs text-gray-400">{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </div>
  );
}

function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({ active, color, count, onClick, children }: { active: boolean; color?: string; count?: number; onClick: () => void; children: ReactNode }) {
  const style = color ? (active ? { backgroundColor: color, borderColor: color } : { borderColor: color, color }) : undefined;
  return (
    <button
      onClick={onClick}
      style={style}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        active ? (color ? "text-white" : "border-neutral-100 bg-gray-900 text-white") : color ? "hover:opacity-80" : "border-gray-300 text-gray-700 hover:border-gray-400"
      }`}
    >
      {children}
      {count !== undefined && <span className={`ml-1 tabular-nums ${active ? "opacity-70" : "text-gray-500"}`}>{count}</span>}
    </button>
  );
}

function YearSelect({ years, value, onChange, placeholder }: { years: number[]; value: number | null; onChange: (v: number | null) => void; placeholder: string }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-900"
    >
      <option value="">{placeholder}</option>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
