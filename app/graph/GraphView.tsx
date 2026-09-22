"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { NodeObject } from "react-force-graph-3d";
import { colorForGroup } from "@/lib/enrichment/labels";
import type { Entity, GraphJson, GraphLink, GraphNode } from "@/lib/types";

// react-force-graph-3d touches `window` at import time, so it must be loaded
// client-side only — ssr:false is required here, not optional polish.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

interface Node3D {
  id: string;
  name: string;
  type: GraphNode["type"];
  group: string;
  score: number;
  company: string | null;
}

// The library's accessor callbacks receive its own loose NodeObject shape;
// cast once at the boundary instead of sprinkling `any` through the props.
function asNode(node: NodeObject): Node3D {
  return node as unknown as Node3D;
}

const TYPE_COLORS: Record<string, string> = {
  person: "#7dd3fc",
  organization: "#fbbf24",
  framework: "#c084fc",
  network: "#f87171",
};

interface Props {
  workspaceKey: string;
  /** When provided (embedded in /explore), renders these filtered entities instead of fetching the whole graph. */
  entities?: Entity[];
  links?: GraphLink[];
  groupOf?: (entity: Entity) => string;
  onSelect?: (id: string) => void;
}

export default function GraphView({ workspaceKey, entities, links, groupOf, onSelect }: Props) {
  const embedded = entities !== undefined;
  const [fetched, setFetched] = useState<GraphJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (embedded) return;
    let cancelled = false;
    fetch(`/api/graph?workspace=${encodeURIComponent(workspaceKey)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `request failed with ${res.status}`);
        }
        return res.json();
      })
      .then((json: GraphJson) => {
        if (!cancelled) setFetched(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceKey, embedded]);

  // Size to the container (fills the explore panel / the full page), never a fixed height.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((observed) => {
      const entry = observed[0];
      if (entry) setDimensions({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (embedded) {
      const ids = new Set(entities.map((e) => e.id));
      return {
        nodes: entities.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          group: groupOf ? groupOf(e) : e.cluster ?? "",
          score: e.score ?? 0,
          company: e.company,
        })),
        links: (links ?? []).filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({ ...l })),
      };
    }
    if (!fetched) return { nodes: [], links: [] };
    return {
      nodes: fetched.nodes.map((n) => ({ id: n.id, name: n.name, type: n.type, group: n.cluster ?? "", score: 0, company: null })),
      links: fetched.links.map((l) => ({ ...l })),
    };
  }, [embedded, entities, links, groupOf, fetched]);

  if (error) {
    return <div className="m-6 rounded-lg border border-red-800 bg-red-950/40 p-6 text-red-200">Não foi possível carregar o grafo: {error}</div>;
  }

  const ready = embedded || fetched;

  return (
    <div ref={containerRef} className="h-full w-full bg-black">
      {!ready ? (
        <div className="flex h-full items-center justify-center text-neutral-400">Carregando rede…</div>
      ) : graphData.nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-neutral-500">Nenhum registro corresponde à visão e aos filtros atuais.</div>
      ) : dimensions.width > 0 ? (
        <ForceGraph3D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          nodeId="id"
          nodeLabel={(node: NodeObject) => {
            const n = asNode(node);
            return `${n.name}${n.company ? ` · ${n.company}` : ""}${n.group ? ` — ${n.group}` : ""}`;
          }}
          nodeColor={(node: NodeObject) => {
            const n = asNode(node);
            if (n.type !== "person") return TYPE_COLORS[n.type] ?? "#a3a3a3";
            return embedded ? colorForGroup(n.group) : TYPE_COLORS.person;
          }}
          nodeVal={(node: NodeObject) => {
            const n = asNode(node);
            if (n.type === "network") return 8;
            if (n.type === "organization") return 5;
            return 0.6 + (n.score / 100) * 4;
          }}
          onNodeClick={(node: NodeObject) => onSelect?.(asNode(node).id)}
          linkColor={() => "rgba(255,255,255,0.22)"}
          linkOpacity={0.35}
          backgroundColor="#000000"
          warmupTicks={graphData.nodes.length > 1500 ? 40 : 0}
          cooldownTicks={graphData.nodes.length > 1500 ? 120 : 300}
        />
      ) : null}
    </div>
  );
}
