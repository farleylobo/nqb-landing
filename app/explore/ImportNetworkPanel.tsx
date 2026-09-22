"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { enrichEntity } from "@/lib/enrichment/enrich";
import {
  chunk,
  dedupeEntities,
  ImportFormatError,
  parseCsv,
  parseImportPayload,
  tabularRowsToEntities,
} from "@/lib/enrichment/importFormats";
import { FUNCTION_LABELS, SENIORITY_LABELS, THEME_LABELS } from "@/lib/enrichment/labels";
import { SETTINGS_PRESETS } from "@/lib/enrichment/taxonomy";
import type { ImportPayload } from "@/lib/enrichment/types";

const ENTITY_BATCH = 400;
const EDGE_BATCH = 1500;
const PROFILE_BATCH = 1500;

type Stage = "pick" | "preview" | "importing" | "done";

interface Prepared {
  fileName: string;
  format: "linkedin" | "planilha" | "json";
  payload: ImportPayload;
  duplicatesMerged: number;
  skippedRows: number;
  discardedEmails: boolean;
}

interface Props {
  workspaceKey: string;
  readOnly: boolean;
  onClose: () => void;
  onImported: () => void;
  /** Opens the AI free-text profile import (one pasted profile per spreadsheet row). */
  onOpenFreeText: () => void;
}

async function readFile(file: File): Promise<Prepared> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    const payload = parseImportPayload(JSON.parse(await file.text()));
    const { entities, duplicates } = dedupeEntities(payload.entities);
    return { fileName: file.name, format: "json", payload: { ...payload, entities }, duplicatesMerged: duplicates, skippedRows: 0, discardedEmails: false };
  }
  let rows: unknown[][];
  let format: Prepared["format"] = "linkedin";
  if (name.endsWith(".csv")) {
    rows = parseCsv(await file.text());
  } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellFormula: false, cellHTML: false, bookVBA: false });
    // Worked spreadsheets often have several tabs (summary, triage…): use the largest tab with a recognizable header.
    let best: { rows: unknown[][]; count: number } | null = null;
    for (const sheetName of workbook.SheetNames) {
      const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
      try {
        const result = tabularRowsToEntities(sheetRows);
        if (!best || result.entities.length > best.count) best = { rows: sheetRows, count: result.entities.length };
      } catch {
        // tab without a recognizable header
      }
    }
    if (!best) throw new ImportFormatError("Nenhuma aba da planilha tem colunas reconhecíveis (nome + URL, empresa ou cargo).");
    rows = best.rows;
    format = "planilha";
  } else {
    throw new ImportFormatError("Formato não suportado. Use o CSV de conexões do LinkedIn, uma planilha .xlsx ou um JSON nqb-import.");
  }
  const result = tabularRowsToEntities(rows);
  const { entities, duplicates } = dedupeEntities(result.entities);
  return {
    fileName: file.name,
    format,
    payload: { format: "nqb-import", version: 1, entities, edges: [], companyProfiles: [] },
    duplicatesMerged: duplicates,
    skippedRows: result.skippedRows,
    discardedEmails: result.discardedEmailColumn,
  };
}

export default function ImportNetworkPanel({ workspaceKey, readOnly, onClose, onImported, onOpenFreeText }: Props) {
  const [stage, setStage] = useState<Stage>("pick");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [preset, setPreset] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ label: "", done: 0, total: 1 });
  const [summary, setSummary] = useState<{ entities: number; edges: number; profiles: number; hubs: number } | null>(null);
  const [classifying, setClassifying] = useState<{ remaining: number | null; running: boolean; error: string | null }>({ remaining: null, running: false, error: null });
  const [interaction, setInteraction] = useState<{ running: boolean; matched: number | null; error: string | null }>({ running: false, matched: null, error: null });
  const interactionFiles = useRef<{ messagesCsv?: string; invitationsCsv?: string }>({});

  const key = encodeURIComponent(workspaceKey);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const result = await readFile(file);
      if (result.payload.entities.length === 0) throw new ImportFormatError("Nenhum registro com nome encontrado no arquivo.");
      setPrepared(result);
      setPreset(result.payload.settingsPreset ?? "");
      setStage("preview");
    } catch (err) {
      setError(err instanceof ImportFormatError ? err.message : err instanceof SyntaxError ? "JSON inválido." : "Não foi possível ler o arquivo.");
    }
  }

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `falha (${res.status})`);
    return json;
  }

  async function runImport() {
    if (!prepared) return;
    const { payload } = prepared;
    const entityBatches = chunk(payload.entities, ENTITY_BATCH);
    const edgeBatches = chunk(payload.edges ?? [], EDGE_BATCH);
    const profileBatches = chunk(payload.companyProfiles ?? [], PROFILE_BATCH);
    const total = profileBatches.length + entityBatches.length + edgeBatches.length + 2;
    let done = 0;
    const totals = { entities: 0, edges: 0, profiles: 0, hubs: 0 };
    setStage("importing");
    setError(null);
    try {
      // Company knowledge first, so entities are enriched with it on arrival.
      for (const [i, batch] of profileBatches.entries()) {
        setProgress({ label: `Organizações ${i + 1}/${profileBatches.length}`, done, total });
        const r = await post(`/api/import/network?workspace=${key}`, { companyProfiles: batch, ...(i === 0 && preset ? { settingsPreset: preset } : {}) });
        totals.profiles += r.companyProfiles;
        done++;
      }
      for (const [i, batch] of entityBatches.entries()) {
        setProgress({ label: `Registros ${i + 1}/${entityBatches.length}`, done, total });
        const first = i === 0 && profileBatches.length === 0 && preset;
        const r = await post(`/api/import/network?workspace=${key}`, { entities: batch, ...(first ? { settingsPreset: preset } : {}) });
        totals.entities += r.entities;
        done++;
      }
      for (const [i, batch] of edgeBatches.entries()) {
        setProgress({ label: `Conexões ${i + 1}/${edgeBatches.length}`, done, total });
        const r = await post(`/api/import/network?workspace=${key}`, { edges: batch });
        totals.edges += r.edges;
        done++;
      }
      setProgress({ label: "Montando organizações-hub", done, total });
      const hubs = await post(`/api/network/recompute?workspace=${key}&phase=hubs`, {});
      totals.hubs = hubs.hubs;
      done++;
      let offset: number | null = 0;
      while (offset !== null) {
        setProgress({ label: `Calculando scores (${offset.toLocaleString("pt-BR")})`, done, total });
        const page: { nextOffset: number | null } = await post(`/api/network/recompute?workspace=${key}&phase=scores&offset=${offset}`, {});
        offset = page.nextOffset;
      }
      done++;
      setProgress({ label: "Concluído", done, total });
      setSummary(totals);
      setStage("done");
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "erro desconhecido"} — os lotes anteriores já foram gravados; importar de novo é seguro (atualiza em vez de duplicar).`);
      setStage("preview");
    }
  }

  async function classifyCompanies() {
    setClassifying({ remaining: null, running: true, error: null });
    try {
      let remaining = Infinity;
      let guard = 0;
      while (remaining > 0 && guard < 200) {
        const r: { remaining: number } = await post(`/api/companies/classify?workspace=${key}`, {});
        remaining = r.remaining;
        setClassifying({ remaining, running: true, error: null });
        guard++;
      }
      await post(`/api/network/recompute?workspace=${key}&phase=hubs`, {});
      let offset: number | null = 0;
      while (offset !== null) {
        const page: { nextOffset: number | null } = await post(`/api/network/recompute?workspace=${key}&phase=scores&offset=${offset}`, {});
        offset = page.nextOffset;
      }
      setClassifying({ remaining: 0, running: false, error: null });
    } catch (err) {
      setClassifying((c) => ({ ...c, running: false, error: err instanceof Error ? err.message : "erro" }));
    }
  }

  async function readInteractionFile(kind: "messagesCsv" | "invitationsCsv", file: File | undefined) {
    if (!file) {
      delete interactionFiles.current[kind];
      return;
    }
    interactionFiles.current[kind] = await file.text();
  }

  async function addInteractionSignal() {
    const { messagesCsv, invitationsCsv } = interactionFiles.current;
    if (!messagesCsv && !invitationsCsv) return;
    setInteraction({ running: true, matched: null, error: null });
    try {
      const r: { matched: number } = await post(`/api/import/interactions?workspace=${key}`, { messagesCsv, invitationsCsv });
      await post(`/api/network/recompute?workspace=${key}&phase=hubs`, {});
      let offset: number | null = 0;
      while (offset !== null) {
        const page: { nextOffset: number | null } = await post(`/api/network/recompute?workspace=${key}&phase=scores&offset=${offset}`, {});
        offset = page.nextOffset;
      }
      setInteraction({ running: false, matched: r.matched, error: null });
    } catch (err) {
      setInteraction({ running: false, matched: null, error: err instanceof Error ? err.message : "erro" });
    }
  }

  const sample = prepared?.payload.entities.filter((e) => (e.type ?? "person") === "person").slice(0, 8) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-gray-300 bg-white text-sm text-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="text-base font-semibold text-gray-900">Importar rede</div>
          <button onClick={onClose} disabled={stage === "importing"} className="text-gray-500 hover:text-gray-800 disabled:opacity-30" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {readOnly ? (
            <div className="flex flex-col gap-3">
              <p className="text-gray-700">Este é o workspace de demonstração, que é somente leitura.</p>
              <p className="text-gray-600">Crie um workspace próprio para importar a sua rede — leva menos de um minuto.</p>
              <Link href="/novo" className="self-start rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50">
                Criar workspace
              </Link>
            </div>
          ) : stage === "pick" ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="mb-2 font-semibold text-gray-700">Formatos aceitos</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    <span className="text-gray-800">Export do LinkedIn</span> — <code>Connections.csv</code> (Configurações → Privacidade de dados → Obter
                    cópia dos seus dados → Conexões).
                  </li>
                  <li>
                    <span className="text-gray-800">Planilha</span> (.xlsx/.csv) com colunas de nome e URL, empresa ou cargo — em português ou inglês,
                    mesmo com linhas de título acima do cabeçalho.
                  </li>
                  <li>
                    <span className="text-gray-800">JSON nqb-import</span> — rede curada com núcleo, conexões e classificação de organizações.
                  </li>
                </ul>
                <p className="mt-2">
                  O arquivo é lido no seu navegador. <span className="text-gray-800">E-mails são descartados</span> antes de qualquer envio. Importar de
                  novo atualiza os registros existentes, sem duplicar.
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800"
              />
              {error && <div className="text-red-400">{error}</div>}
              <button onClick={onOpenFreeText} className="self-start text-xs text-sky-400 hover:underline">
                Tem perfis em texto livre (colados do LinkedIn)? Use a extração por IA →
              </button>
            </div>
          ) : stage === "preview" && prepared ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Registros" value={prepared.payload.entities.length} />
                <Stat label="Com LinkedIn" value={prepared.payload.entities.filter((e) => e.linkedinUrl).length} />
                <Stat label="Conexões" value={prepared.payload.edges?.length ?? 0} />
                <Stat label="Organizações classificadas" value={prepared.payload.companyProfiles?.length ?? 0} />
              </div>
              <div className="text-xs text-gray-500">
                Arquivo <span className="text-gray-700">{prepared.fileName}</span>
                {prepared.duplicatesMerged > 0 && ` · ${prepared.duplicatesMerged} duplicados mesclados`}
                {prepared.skippedRows > 0 && ` · ${prepared.skippedRows} linhas sem nome ignoradas`}
                {prepared.discardedEmails && " · coluna de e-mail descartada"}
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600">
                Taxonomia do workspace:
                <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-gray-900">
                  <option value="">manter a atual</option>
                  {Object.keys(SETTINGS_PRESETS).map((p) => (
                    <option key={p} value={p}>
                      {p === "rnq" ? "Rede Novo Quilombo" : "Padrão"}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Prévia da classificação automática</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="pb-2 pr-3 font-medium">Nome</th>
                        <th className="pb-2 pr-3 font-medium">Cargo · Organização</th>
                        <th className="pb-2 pr-3 font-medium">Poder</th>
                        <th className="pb-2 pr-3 font-medium">Função</th>
                        <th className="pb-2 font-medium">Temas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sample.map((e, i) => {
                        const x = enrichEntity({
                          type: "person",
                          name: e.name,
                          role: e.title ?? null,
                          company: e.company ?? null,
                          summary: e.summary ?? null,
                          cluster: e.cluster ?? null,
                          tags: e.tags ?? [],
                          source: e.source ?? null,
                          attributes: e.attributes ?? {},
                        });
                        return (
                          <tr key={`${e.externalKey ?? e.name}-${i}`} className="border-t border-neutral-900 align-top">
                            <td className="py-1.5 pr-3 text-gray-800">{e.name}</td>
                            <td className="py-1.5 pr-3 text-gray-600">
                              {[e.title, e.company].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className="py-1.5 pr-3 text-gray-600">{x.seniority ? SENIORITY_LABELS[x.seniority] : "—"}</td>
                            <td className="py-1.5 pr-3 text-gray-600">{x.functions.map((f) => FUNCTION_LABELS[f] ?? f).join(", ") || "—"}</td>
                            <td className="py-1.5 text-gray-600">{x.themes.map((t) => THEME_LABELS[t] ?? t).join(", ") || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {error && <div className="text-red-400">{error}</div>}
            </div>
          ) : stage === "importing" ? (
            <div className="flex flex-col gap-3 py-6">
              <div className="text-gray-700">{progress.label}…</div>
              <div className="h-2 overflow-hidden rounded bg-gray-100">
                <div className="h-full rounded bg-neutral-100 transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
              <div className="text-xs text-gray-500">Não feche esta janela.</div>
            </div>
          ) : stage === "done" && summary ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Registros gravados" value={summary.entities} />
                <Stat label="Conexões novas" value={summary.edges} />
                <Stat label="Organizações classificadas" value={summary.profiles} />
                <Stat label="Organizações-hub" value={summary.hubs} />
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="mb-2 text-gray-700">Opcional: classificar organizações com IA</p>
                <p className="mb-3">
                  Envia apenas <span className="text-gray-800">nomes de organizações</span> (nunca dados de pessoas) para identificar tipo, setor e missão —
                  melhora temas e portas institucionais. A classificação fica salva e é reaproveitada.
                </p>
                <button
                  onClick={classifyCompanies}
                  disabled={classifying.running}
                  className="rounded-md border border-neutral-600 px-3 py-1.5 text-xs text-gray-800 hover:border-neutral-400 disabled:opacity-50"
                >
                  {classifying.running
                    ? `Classificando… ${classifying.remaining !== null ? `${classifying.remaining} restantes` : ""}`
                    : classifying.remaining === 0
                      ? "Organizações classificadas ✓"
                      : "Classificar organizações pendentes"}
                </button>
                {classifying.error && <div className="mt-2 text-red-400">{classifying.error}</div>}
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="mb-2 text-gray-700">Opcional: sinal de interação real (mensagens e convites)</p>
                <p className="mb-3">
                  No export <span className="text-gray-800">completo</span> do LinkedIn (Configurações → Privacidade de dados → Obter uma cópia dos seus
                  dados → Completa), envie <code>messages.csv</code> e/ou <code>Invitations.csv</code>. Isso melhora a Proximidade com recência e
                  reciprocidade reais de mensagem, em vez de só a data de conexão. Só enxerga o seu lado das conversas.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => readInteractionFile("messagesCsv", e.target.files?.[0])}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                    aria-label="messages.csv"
                  />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => readInteractionFile("invitationsCsv", e.target.files?.[0])}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-800"
                    aria-label="Invitations.csv"
                  />
                </div>
                <button
                  onClick={addInteractionSignal}
                  disabled={interaction.running}
                  className="mt-2 rounded-md border border-neutral-600 px-3 py-1.5 text-xs text-gray-800 hover:border-neutral-400 disabled:opacity-50"
                >
                  {interaction.running
                    ? "Processando…"
                    : interaction.matched !== null
                      ? `${interaction.matched} contatos atualizados ✓`
                      : "Adicionar sinal de interação"}
                </button>
                {interaction.error && <div className="mt-2 text-red-400">{interaction.error}</div>}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          {stage === "preview" && (
            <>
              <button onClick={() => setStage("pick")} className="rounded-md px-4 py-2 text-xs text-gray-600 hover:text-gray-800">
                Trocar arquivo
              </button>
              <button onClick={runImport} className="rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50">
                Importar {prepared?.payload.entities.length.toLocaleString("pt-BR")} registros
              </button>
            </>
          )}
          {stage === "done" && (
            <button onClick={onImported} disabled={classifying.running} className="rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50">
              Ver a rede
            </button>
          )}
          {stage === "pick" && (
            <button onClick={onClose} className="rounded-md px-4 py-2 text-xs text-gray-600 hover:text-gray-800">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-gray-900">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}
