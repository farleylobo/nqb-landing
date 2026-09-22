"use client";

import { useState } from "react";

interface RowResult {
  row: number;
  name: string;
  status: "created" | "error";
  error?: string;
}

interface BulkImportResponse {
  format: "freetext" | "structured";
  total: number;
  created: number;
  failed: number;
  results: RowResult[];
}

interface Props {
  workspaceKey: string;
  onClose: () => void;
  onImported: () => void;
}

export default function BulkImportPanel({ workspaceKey, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<BulkImportResponse | null>(null);

  async function handleSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setResponse(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/ingest/bulk?workspace=${encodeURIComponent(workspaceKey)}`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? `falha na importação (${res.status})`);
      }
      setResponse(body as BulkImportResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-gray-300 bg-white text-sm text-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="text-base font-semibold text-gray-900">Importar perfis em massa</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!response && (
            <>
              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="mb-2 font-semibold text-gray-700">Dois formatos aceitos (detectados automaticamente):</p>
                <p className="mb-1">
                  <span className="text-gray-800">Texto livre:</span> uma coluna chamada <code>texto</code> com o
                  perfil colado por linha (como colar do LinkedIn) — cada linha passa pelo mesmo extrator por IA.
                </p>
                <p>
                  <span className="text-gray-800">Estruturado:</span> colunas <code>nome</code>, <code>tipo</code>,{" "}
                  <code>cargo</code>, <code>tags</code> etc. já preenchidas — mais rápido, sem IA.
                </p>
                <p className="mt-2">Limite de 50 linhas por importação. Formatos: .xlsx ou .csv.</p>
              </div>

              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-800"
              />

              {error && <div className="mt-3 text-red-400">{error}</div>}
            </>
          )}

          {response && (
            <div>
              <div className="mb-3 text-gray-700">
                Formato detectado: <span className="text-gray-900">{response.format === "freetext" ? "texto livre" : "estruturado"}</span>
                {" · "}
                <span className="text-emerald-400">{response.created} criados</span>
                {response.failed > 0 && <span className="text-red-400"> · {response.failed} com erro</span>}
              </div>
              <div className="flex flex-col gap-1">
                {response.results.map((r) => (
                  <div
                    key={r.row}
                    className={`flex items-center justify-between rounded px-2 py-1.5 ${
                      r.status === "created" ? "bg-emerald-950/40" : "bg-red-950/40"
                    }`}
                  >
                    <span className="truncate text-gray-800">{r.name}</span>
                    <span className={`text-xs ${r.status === "created" ? "text-emerald-400" : "text-red-400"}`}>
                      {r.status === "created" ? "criado" : r.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
          {response ? (
            <button
              onClick={onImported}
              className="rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
            >
              Concluir
            </button>
          ) : (
            <>
              <button onClick={onClose} className="rounded-md px-4 py-2 text-xs text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!file || submitting}
                className="rounded-md bg-neutral-100 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Importando…" : "Importar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
