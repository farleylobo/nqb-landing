"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { forceCollide, forceManyBody, forceSimulation, type Simulation } from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { computeClusterCenters, type ClusterCenter } from "@/lib/clusterLayout";
import { colorForGroup } from "@/lib/enrichment/labels";
import type { Entity, GraphLink } from "@/lib/types";

// Bubble map: entities are pulled toward the center of their group (theme,
// function, decision power, hub… — chosen in the sidebar). Node size follows
// the relevance score, so what matters is visible first; connection lines
// are drawn only for the selected node, which keeps thousands of contacts
// legible. Pattern inspired by mapping-ai.org's public map (independent
// implementation — their repository has no license).

interface SimNode extends Entity {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  group: string;
  radius: number;
}

function radiusFor(entity: Entity, large: boolean): number {
  if (entity.type === "network") return 14;
  if (entity.type === "organization") return entity.source === "derivado" ? 9 : 10;
  if (entity.type === "framework") return 9;
  const score = entity.score ?? 0;
  const base = large ? 2.2 : 4;
  return base + (score / 100) * (large ? 6 : 7);
}

interface Props {
  entities: Entity[];
  links: GraphLink[];
  groupOf: (entity: Entity) => string;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

export default function NetworkView2D({ entities, links, groupOf, onSelect, selectedId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const nodesRef = useRef<SimNode[]>([]);
  const centersRef = useRef<ClusterCenter[]>([]);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const simulationRef = useRef<Simulation<SimNode, undefined> | null>(null);
  const hoveredRef = useRef<SimNode | null>(null);
  const selectedIdRef = useRef(selectedId);
  const drawRef = useRef<() => void>(() => {});

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of links) {
      if (!map.has(l.source)) map.set(l.source, new Set());
      if (!map.has(l.target)) map.set(l.target, new Set());
      map.get(l.source)!.add(l.target);
      map.get(l.target)!.add(l.source);
    }
    return map;
  }, [links]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    drawRef.current();
  }, [selectedId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setDimensions({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Rebuild the simulation when the visible set, grouping or canvas size change.
  // Existing positions are preserved by id so filtering doesn't reset the layout.
  useEffect(() => {
    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;
    const large = entities.length > 800;
    const previous = new Map(nodesRef.current.map((n) => [n.id, n]));
    const counts: Record<string, number> = {};
    const groups = entities.map((e) => {
      const g = groupOf(e);
      counts[g] = (counts[g] ?? 0) + 1;
      return g;
    });
    const centers = computeClusterCenters(counts, { width, height, ringFraction: Object.keys(counts).length > 12 ? 0.38 : 0.3 });
    centersRef.current = centers;
    const centerByGroup = new Map(centers.map((c) => [c.cluster, c]));

    const nodes: SimNode[] = entities.map((entity, i) => {
      const prior = previous.get(entity.id);
      const center = centerByGroup.get(groups[i]);
      const samePlace = prior && prior.group === groups[i];
      return {
        ...entity,
        group: groups[i],
        radius: radiusFor(entity, large),
        x: samePlace ? prior.x : (center?.x ?? width / 2) + (Math.random() - 0.5) * 30,
        y: samePlace ? prior.y : (center?.y ?? height / 2) + (Math.random() - 0.5) * 30,
      };
    });
    nodesRef.current = nodes;

    simulationRef.current?.stop();
    const simulation = forceSimulation(nodes)
      .force("charge", forceManyBody<SimNode>().strength(large ? -1.5 : -10).distanceMax(120))
      .force("collide", forceCollide<SimNode>().radius((d) => d.radius + (large ? 0.6 : 1.5)).iterations(large ? 1 : 2))
      .force("groupX", groupForce(centerByGroup, "x"))
      .force("groupY", groupForce(centerByGroup, "y"))
      .alpha(1)
      .alphaDecay(large ? 0.045 : 0.025)
      .on("tick", () => drawRef.current());
    simulationRef.current = simulation;
    return () => {
      simulation.stop();
    };
  }, [entities, groupOf, dimensions]);

  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current;
      const { width, height } = dimensions;
      if (!canvas || width === 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);
      const t = transformRef.current;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const nodes = nodesRef.current;
      const selected = selectedIdRef.current;
      const connected = selected ? adjacency.get(selected) ?? new Set<string>() : null;

      // Group extents from actual node positions (not the layout target), so halos and labels sit on the group.
      const groupStats = new Map<string, { x: number; y: number; n: number; extent: number }>();
      for (const node of nodes) {
        const g = groupStats.get(node.group) ?? { x: 0, y: 0, n: 0, extent: 0 };
        g.x += node.x;
        g.y += node.y;
        g.n += 1;
        groupStats.set(node.group, g);
      }
      for (const g of groupStats.values()) {
        g.x /= g.n;
        g.y /= g.n;
      }
      for (const node of nodes) {
        const g = groupStats.get(node.group)!;
        g.extent = Math.max(g.extent, Math.hypot(node.x - g.x, node.y - g.y) + node.radius);
      }
      for (const [group, g] of groupStats) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.extent + 14, 0, Math.PI * 2);
        ctx.fillStyle = colorForGroup(group) + "14";
        ctx.fill();
      }

      if (selected) {
        const selectedNode = nodes.find((n) => n.id === selected);
        if (selectedNode) {
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 1 / t.k;
          for (const node of nodes) {
            if (connected?.has(node.id)) {
              ctx.beginPath();
              ctx.moveTo(selectedNode.x, selectedNode.y);
              ctx.lineTo(node.x, node.y);
              ctx.stroke();
            }
          }
        }
      }

      for (const node of nodes) {
        const dim = connected && node.id !== selected && !connected.has(node.id);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.type === "person" ? colorForGroup(node.group) : "#e5e5e5";
        ctx.fill();
        if (node.type !== "person") {
          ctx.lineWidth = 2 / t.k;
          ctx.strokeStyle = colorForGroup(node.group);
          ctx.stroke();
        }
        if (node.triage === "priorizar") {
          ctx.lineWidth = 1.5 / t.k;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Group labels, just above each group's halo. The biggest groups are placed first;
      // a label that would collide with one already placed moves up, and is dropped if
      // it still collides — two labels stacked on the same pixels read as gibberish.
      ctx.textAlign = "center";
      const labelFontSize = 13 / t.k;
      ctx.font = `600 ${labelFontSize}px ui-sans-serif, system-ui, sans-serif`;
      const placedLabels: { x0: number; y0: number; x1: number; y1: number }[] = [];
      const byRelevance = [...groupStats].sort((a, b) => b[1].n - a[1].n);
      for (const [group, g] of byRelevance) {
        const label = `${group} · ${g.n.toLocaleString("pt-BR")}`;
        const halfWidth = ctx.measureText(label).width / 2;
        const lineHeight = labelFontSize * 1.35;
        let y = g.y - g.extent - 20 / t.k;
        let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const candidate = { x0: g.x - halfWidth, y0: y - lineHeight, x1: g.x + halfWidth, y1: y + lineHeight * 0.35 };
          const collides = placedLabels.some(
            (p) => candidate.x0 < p.x1 && candidate.x1 > p.x0 && candidate.y0 < p.y1 && candidate.y1 > p.y0
          );
          if (!collides) {
            box = candidate;
            break;
          }
          y -= lineHeight * 1.15;
        }
        if (!box) continue;
        placedLabels.push(box);
        ctx.lineWidth = 4 / t.k;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.strokeText(label, g.x, y);
        ctx.fillStyle = colorForGroup(group);
        ctx.fillText(label, g.x, y);
      }

      // Selected / hovered labels.
      const labelled = [...new Set([nodes.find((n) => n.id === selected), hoveredRef.current].filter((n): n is SimNode => !!n))];
      for (const node of labelled) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 2 / t.k, 0, Math.PI * 2);
        ctx.lineWidth = 2 / t.k;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        const fontSize = 12 / t.k;
        ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "left";
        const text = node.company ? `${node.name} · ${node.company}` : node.name;
        ctx.lineWidth = 4 / t.k;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(text, node.x + node.radius + 5 / t.k, node.y + 4 / t.k);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, node.x + node.radius + 5 / t.k, node.y + 4 / t.k);
      }
      ctx.restore();
    };
    drawRef.current();
  }, [dimensions, adjacency]);

  // Pan/zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const selection = select(canvas);
    const behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 8])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        drawRef.current();
      });
    selection.call(behavior);
    return () => {
      selection.on(".zoom", null);
    };
  }, [dimensions.width, dimensions.height, entities.length]);

  function nodeAt(clientX: number, clientY: number): SimNode | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;
    const x = (clientX - rect.left - t.x) / t.k;
    const y = (clientY - rect.top - t.y) / t.k;
    let closest: SimNode | null = null;
    let closestDist = Infinity;
    for (const node of nodesRef.current) {
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= node.radius + 3 / t.k && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }
    return closest;
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      {entities.length === 0 ? (
        <div className="flex h-full items-center justify-center text-gray-500">Nenhum registro corresponde à visão e aos filtros atuais.</div>
      ) : (
        <canvas
          ref={canvasRef}
          onClick={(e) => onSelect(nodeAt(e.clientX, e.clientY)?.id ?? null)}
          onMouseMove={(e) => {
            const node = nodeAt(e.clientX, e.clientY);
            if (node !== hoveredRef.current) {
              hoveredRef.current = node;
              if (canvasRef.current) canvasRef.current.style.cursor = node ? "pointer" : "grab";
              drawRef.current();
            }
          }}
          className="block"
        />
      )}
    </div>
  );
}

// Pulls each node toward its group's center along one axis; two instances (x, y) compose into 2D attraction.
function groupForce(centerByGroup: Map<string, { x: number; y: number }>, axis: "x" | "y") {
  let nodes: SimNode[] = [];
  function force(alpha: number) {
    for (const node of nodes) {
      const center = centerByGroup.get(node.group);
      if (!center) continue;
      if (axis === "x") node.vx = (node.vx ?? 0) + (center.x - node.x) * 0.09 * alpha;
      else node.vy = (node.vy ?? 0) + (center.y - node.y) * 0.09 * alpha;
    }
  }
  force.initialize = (initialized: SimNode[]) => {
    nodes = initialized;
  };
  return force;
}
