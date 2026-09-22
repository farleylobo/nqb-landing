"use client";

import type { Entity } from "@/lib/types";

interface Props {
  entities: Entity[];
}

export default function EntityList({ entities }: Props) {
  if (entities.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum perfil ainda nesta workspace.</p>;
  }

  return (
    <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800">
      {entities.map((e) => (
        <li key={e.id} className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-neutral-100">{e.name}</span>
            <span className="text-xs uppercase tracking-wide text-neutral-500">{e.type}</span>
          </div>
          {e.role && <p className="text-sm text-neutral-400">{e.role}</p>}
          {e.summary && <p className="mt-1 text-sm text-neutral-300">{e.summary}</p>}
          {e.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {e.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
