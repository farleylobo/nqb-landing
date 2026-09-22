"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Entity } from "@/lib/types";
import IngestForm from "./IngestForm";
import EntityList from "./EntityList";

export default function Dashboard({ initialWorkspaceKey }: { initialWorkspaceKey: string }) {
  const [workspaceKeyInput, setWorkspaceKeyInput] = useState(initialWorkspaceKey);
  const [activeWorkspaceKey, setActiveWorkspaceKey] = useState(initialWorkspaceKey);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetches entities whenever the *active* workspace key changes (not on
  // every keystroke in the input). Cancellation guard avoids setting state
  // from a stale response if the user switches workspaces quickly.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/entities?workspace=${encodeURIComponent(activeWorkspaceKey)}`,
        );
        const nextEntities = res.ok ? ((await res.json()).entities ?? []) : [];
        if (!cancelled) setEntities(nextEntities);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceKey]);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-100">Ingestão de perfis</h1>
        <p className="text-sm text-neutral-400">
          Cole o texto de um perfil por vez. A extração roda via LLM e o resultado entra
          direto na visualização 3D da rede.
        </p>
      </header>

      <section className="space-y-2">
        <label htmlFor="workspaceKey" className="block text-sm font-medium text-neutral-300">
          Chave da workspace
        </label>
        <div className="flex gap-2">
          <input
            id="workspaceKey"
            value={workspaceKeyInput}
            onChange={(e) => setWorkspaceKeyInput(e.target.value)}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
          />
          <button
            onClick={() => setActiveWorkspaceKey(workspaceKeyInput)}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200"
          >
            Trocar
          </button>
        </div>
        <Link
          href={`/graph?workspace=${encodeURIComponent(activeWorkspaceKey)}`}
          className="inline-block text-sm text-sky-400 underline"
        >
          Ver visualização 3D desta workspace →
        </Link>
      </section>

      <section>
        <IngestForm
          workspaceKey={activeWorkspaceKey}
          onIngested={(entity) => setEntities((prev) => [...prev, entity])}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-neutral-100">Perfis ({entities.length})</h2>
        {loading ? (
          <p className="text-sm text-neutral-500">Carregando…</p>
        ) : (
          <EntityList entities={entities} />
        )}
      </section>
    </main>
  );
}
