"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { distinctClusters, filterNetwork, type EntityFilters } from "@/lib/filterEntities";
import { planHubs } from "@/lib/enrichment/hubs";
import { groupKeyFor, type GroupBy } from "@/lib/enrichment/grouping";
import { resolveSettings, type WorkspaceSettings } from "@/lib/enrichment/taxonomy";
import { matchesView, SAVED_VIEWS, type ViewId } from "@/lib/enrichment/views";
import type { Entity, GraphLink } from "@/lib/types";
import Sidebar from "./Sidebar";
import EntityDetailPanel from "./EntityDetailPanel";
import ListView from "./ListView";
import ImportNetworkPanel from "./ImportNetworkPanel";
import RefinementRoundPanel from "./RefinementRoundPanel";
import BulkImportPanel from "./BulkImportPanel";
import DiagnosticsView from "./DiagnosticsView";
import TriageView from "./TriageView";
import ActionsView from "./ActionsView";

// Both visualizations touch the DOM/window directly (canvas sizing, WebGL),
// so they're loaded client-side only.
const NetworkView2D = dynamic(() => import("./NetworkView2D"), { ssr: false });
const GraphView3D = dynamic(() => import("@/app/graph/GraphView"), { ssr: false });

export type ViewMode = "diagnostics" | "network2d" | "network3d" | "list" | "triage" | "actions";

const VIEW_MODES: [ViewMode, string][] = [
  ["diagnostics", "Diagnóstico"],
  ["network2d", "Mapa"],
  ["network3d", "Grafo 3D"],
  ["list", "Lista"],
  ["triage", "Triar"],
  ["actions", "Ações"],
];

interface NetworkResponse {
  workspace: { id: string; name: string; readOnly: boolean };
  settings: WorkspaceSettings;
  entities: Entity[];
  links: GraphLink[];
}

interface Props {
  workspaceKey: string;
  /** True only when the workspace was resolved from a logged-in pilot session (see app/explore/page.tsx) — shows a "Sair" link. Admin/demo/direct-key links never see it. */
  showLogout?: boolean;
}

export const EMPTY_FILTERS: EntityFilters = {};

export default function ExploreShell({ workspaceKey, showLogout = false }: Props) {
  const router = useRouter();
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>("network2d");
  const [savedView, setSavedView] = useState<ViewId>("toda");
  const [groupBy, setGroupBy] = useState<GroupBy>("tema");
  const [filters, setFilters] = useState<EntityFilters>(EMPTY_FILTERS);
  // Same rule as Sidebar's own "limpar (n)" button — kept in sync manually
  // since it's cheap and pulling it into a shared helper isn't worth it for
  // one boolean used in the list's empty-state recovery action.
  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([k, v]) => k !== "query" && (Array.isArray(v) ? v.length > 0 : !!v)).length,
    [filters]
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [freeTextOpen, setFreeTextOpen] = useState(false);

  // On a narrow window the 320px sidebar would leave almost nothing for the map,
  // so it starts collapsed and opens as an overlay. This has to run as an
  // effect (not a useState lazy initializer) on purpose: the server render
  // has no `window`, so the initial state is always `true`; deciding this
  // during render would make the client's first paint disagree with the
  // server's and trigger a hydration mismatch. Deferring to an effect lets
  // it apply only after hydration is already done.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above; pre-existing, unrelated to ADR-006
    if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/network?workspace=${encodeURIComponent(workspaceKey)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `falha ao carregar a rede (${res.status})`);
        if (!cancelled) {
          const response = body as NetworkResponse;
          setData({ ...response, settings: resolveSettings(response.settings) });
          // Large networks open on the question that matters; small ones show everything.
          const people = response.entities.filter((e) => e.type === "person").length;
          setSavedView((current) => (current === "toda" && people > 400 ? "prioridades" : current));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "erro desconhecido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [workspaceKey, refreshCounter]);

  const entities = useMemo(() => data?.entities ?? [], [data]);
  const links = useMemo(() => data?.links ?? [], [data]);
  const settings = useMemo(() => data?.settings ?? resolveSettings(null), [data]);

  const hubs = useMemo(() => planHubs(entities, settings.hubMinContacts).hubs, [entities, settings.hubMinContacts]);
  const hubCompanyKeys = useMemo(() => new Set(hubs.map((h) => h.companyKey)), [hubs]);
  const hubNames = useMemo(() => new Map(hubs.map((h) => [h.companyKey, h.displayName])), [hubs]);
  const viewCtx = useMemo(() => ({ settings, hubCompanyKeys }), [settings, hubCompanyKeys]);

  const filteredEntities = useMemo(
    () => filterNetwork(entities, savedView, filters, viewCtx),
    [entities, savedView, filters, viewCtx]
  );

  const groupOf = useCallback((e: Entity) => groupKeyFor(e, groupBy, { settings, hubNames }), [groupBy, settings, hubNames]);

  const selectedEntity = useMemo(() => entities.find((e) => e.id === selectedEntityId) ?? null, [entities, selectedEntityId]);
  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const allClusters = useMemo(() => distinctClusters(entities), [entities]);

  const handleEntityUpdated = useCallback((updated: Entity) => {
    setData((current) =>
      current ? { ...current, entities: current.entities.map((e) => (e.id === updated.id ? { ...e, ...updated, scoreBreakdown: null } : e)) } : current
    );
  }, []);

  const openTriage = useCallback(() => {
    // Triage runs over whatever the owner is currently looking at, except "the
    // whole network", where the useful queue is the pending-decision one.
    setSavedView((current) => (current === "toda" ? "triagem" : current));
    setViewMode("triage");
  }, []);

  const applyDrilldown = useCallback((next: { view?: ViewId; filters?: EntityFilters; mode?: ViewMode }) => {
    if (next.view) setSavedView(next.view);
    setFilters(next.filters ?? EMPTY_FILTERS);
    setViewMode(next.mode ?? "list");
  }, []);

  const people = entities.filter((e) => e.type === "person").length;
  const backlogCount = useMemo(() => entities.filter((e) => matchesView(e, "triagem", viewCtx)).length, [entities, viewCtx]);
  const activeView = SAVED_VIEWS.find((v) => v.id === savedView);

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-white text-gray-900">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-gray-200 bg-gray-50 px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight text-gray-900">
          Rede
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate text-gray-700">{data?.workspace.name ?? "Carregando…"}</span>
          {data?.workspace.readOnly && (
            <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-600">
              demo · somente leitura
            </span>
          )}
          {showLogout && (
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Sair
            </button>
          )}
        </div>
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          aria-expanded={sidebarOpen}
          title="Visões e filtros"
          className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
            sidebarOpen ? "border-gray-300 bg-gray-200 text-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Filtros
        </button>
        <nav className="mx-auto flex gap-1 rounded-md bg-gray-100 p-1">
          {VIEW_MODES.map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => (mode === "triage" ? openTriage() : setViewMode(mode))}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                viewMode === mode ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="hidden text-xs text-gray-500 md:block">
          {filteredEntities.length.toLocaleString("pt-BR")} de {entities.length.toLocaleString("pt-BR")} · {people.toLocaleString("pt-BR")} pessoas
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-50"
        >
          Importar rede
        </button>
        <button
          onClick={() => setRefinementOpen(true)}
          disabled={data?.workspace.readOnly}
          title={data?.workspace.readOnly ? "Workspace de demonstração — somente leitura" : undefined}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 transition hover:border-gray-400 disabled:opacity-30"
        >
          Rodada de refinamento
        </button>
      </header>

      {error ? (
        <div className="m-6 rounded-lg border border-red-300 bg-red-50 p-6 text-red-800">Não foi possível carregar a rede: {error}</div>
      ) : (
        <div className="relative flex min-h-0 flex-1">
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar visões e filtros"
              className="absolute inset-0 z-10 cursor-default bg-white/60 lg:hidden"
            />
          )}
          <div
            className={`${sidebarOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-20 max-w-[85vw] shrink-0 lg:static lg:z-auto lg:max-w-none`}
          >
            <Sidebar
              entities={entities}
              settings={settings}
              viewCtx={viewCtx}
              hubs={hubs}
              savedView={savedView}
              onSavedViewChange={setSavedView}
              filters={filters}
              onFiltersChange={setFilters}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              showGroupBy={viewMode === "network2d" || viewMode === "network3d"}
              allClusters={allClusters}
            />
          </div>

          <section className="relative min-w-0 flex-1 overflow-hidden">
            {activeView && viewMode !== "diagnostics" && viewMode !== "triage" && viewMode !== "actions" && (
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md bg-white/70 px-3 py-1.5 text-xs text-gray-600 backdrop-blur">
                <span className="font-semibold text-gray-800">{activeView.label}</span> · {activeView.question}
              </div>
            )}
            {loading ? (
              <div className="flex h-full items-center justify-center text-gray-600">Carregando rede…</div>
            ) : viewMode === "diagnostics" ? (
              <DiagnosticsView entities={entities} settings={settings} onDrilldown={applyDrilldown} onSelectEntity={setSelectedEntityId} />
            ) : viewMode === "triage" ? (
              <TriageView
                key={`${savedView}:${JSON.stringify(filters)}`}
                entities={filteredEntities}
                viewLabel={activeView?.label ?? "a rede"}
                backlog={
                  savedView === "triagem"
                    ? null
                    : { count: backlogCount, onOpen: () => { setSavedView("triagem"); setFilters(EMPTY_FILTERS); } }
                }
                workspaceKey={workspaceKey}
                readOnly={data?.workspace.readOnly ?? true}
                onEntityUpdated={handleEntityUpdated}
                onOpenProfile={setSelectedEntityId}
              />
            ) : viewMode === "list" ? (
              <ListView
                entities={filteredEntities}
                onSelect={setSelectedEntityId}
                selectedId={selectedEntityId}
                onResetView={savedView !== "toda" ? () => setSavedView("toda") : undefined}
                onClearFilters={activeFilterCount > 0 ? () => setFilters({ query: filters.query }) : undefined}
                workspaceKey={workspaceKey}
                readOnly={data?.workspace.readOnly ?? true}
              />
            ) : viewMode === "actions" ? (
              <ActionsView
                entityById={entityById}
                workspaceKey={workspaceKey}
                readOnly={data?.workspace.readOnly ?? true}
                onSelectEntity={setSelectedEntityId}
              />
            ) : viewMode === "network3d" ? (
              <GraphView3D
                workspaceKey={workspaceKey}
                entities={filteredEntities}
                links={links}
                groupOf={groupOf}
                onSelect={setSelectedEntityId}
              />
            ) : (
              <NetworkView2D
                entities={filteredEntities}
                links={links}
                groupOf={groupOf}
                onSelect={setSelectedEntityId}
                selectedId={selectedEntityId}
              />
            )}
          </section>

          {selectedEntity && (
            <div className="absolute inset-y-0 right-0 z-20 flex max-w-[92vw] shrink-0 lg:static lg:z-auto lg:max-w-none">
              <EntityDetailPanel
                key={selectedEntity.id}
                entity={selectedEntity}
                links={links}
                entityById={entityById}
                workspaceKey={workspaceKey}
                readOnly={data?.workspace.readOnly ?? true}
                savedView={savedView}
                onClose={() => setSelectedEntityId(null)}
                onSelectEntity={setSelectedEntityId}
                onEntityUpdated={handleEntityUpdated}
              />
            </div>
          )}
        </div>
      )}

      {importOpen && (
        <ImportNetworkPanel
          workspaceKey={workspaceKey}
          readOnly={data?.workspace.readOnly ?? false}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            setRefreshCounter((n) => n + 1);
          }}
          onOpenFreeText={() => {
            setImportOpen(false);
            setFreeTextOpen(true);
          }}
        />
      )}

      {refinementOpen && (
        <RefinementRoundPanel
          workspaceKey={workspaceKey}
          objective="merlin"
          entityById={entityById}
          onClose={() => setRefinementOpen(false)}
          onEntityUpdated={handleEntityUpdated}
          onSelectEntity={setSelectedEntityId}
        />
      )}

      {freeTextOpen && (
        <BulkImportPanel
          workspaceKey={workspaceKey}
          onClose={() => setFreeTextOpen(false)}
          onImported={() => {
            setFreeTextOpen(false);
            setRefreshCounter((n) => n + 1);
          }}
        />
      )}
    </main>
  );
}
