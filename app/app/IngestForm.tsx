"use client";

import { useState } from "react";
import type { Entity } from "@/lib/types";

interface Props {
  workspaceKey: string;
  onIngested: (entity: Entity) => void;
}

export default function IngestForm({ workspaceKey, onIngested }: Props) {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workspaceKey}`,
        },
        body: JSON.stringify({ rawText }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "falha ao processar o perfil");
      }

      onIngested(body.entity as Entity);
      setRawText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="rawText" className="block text-sm font-medium text-neutral-300">
        Cole o texto do perfil (LinkedIn, bio, PDF exportado)
      </label>
      <textarea
        id="rawText"
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={10}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder:text-neutral-500"
        placeholder="Cole aqui o texto do perfil…"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading || !rawText.trim()}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Extraindo…" : "Extrair ficha"}
      </button>
    </form>
  );
}
