"use client";

import { useState } from "react";
import Link from "next/link";

export default function CreateWorkspaceForm() {
  const [name, setName] = useState("");
  const [preset, setPreset] = useState("padrao");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, settingsPreset: preset }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `falha (${res.status})`);
      setCreated({ name: body.name, apiKey: body.apiKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const href = `/explore?workspace=${encodeURIComponent(created.apiKey)}`;
    return (
      <div className="mt-8 flex flex-col gap-4 rounded-lg border border-emerald-800 bg-emerald-950/30 p-5">
        <div className="text-sm text-emerald-200">
          Workspace <span className="font-semibold">{created.name}</span> criado.
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Chave de acesso</div>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded-md bg-neutral-900 px-3 py-2 text-xs text-neutral-100">{created.apiKey}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(created.apiKey);
                setCopied(true);
              }}
              className="rounded-md border border-neutral-700 px-3 text-xs text-neutral-200"
            >
              {copied ? "Copiada" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-400">Guarde esta chave agora. Quem tiver a chave (ou o link abaixo) acessa a rede.</p>
        </div>
        <Link href={href} className="self-start rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-black hover:bg-white">
          Abrir e importar a rede →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-neutral-300">
        Nome
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Rede do Farley"
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-neutral-300">
        Taxonomia de temas
        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100">
          <option value="padrao">Padrão — impacto social, equidade, clima, educação</option>
          <option value="rnq">Rede Novo Quilombo — missão com ancestralidade, território e desenvolvimento humano</option>
        </select>
      </label>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button disabled={submitting || !name.trim()} className="self-start rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-black hover:bg-white disabled:opacity-50">
        {submitting ? "Criando…" : "Criar workspace"}
      </button>
    </form>
  );
}
