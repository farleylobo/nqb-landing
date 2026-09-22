import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspaceByApiKey, listEdges, listEntities, saveRecommendation } from "@/lib/db";
import { computeSynergyScore, generateSynergyNarrative, rankSynergies } from "@/lib/recommend";
import { extractApiKey } from "@/lib/auth";
import type { Entity } from "@/lib/types";

/**
 * Signals used for similarity: curated tags plus the enriched axes (themes,
 * functions, organization). Most imported contacts have no tags, so without
 * this the ranking would be empty for large networks.
 */
function withSignals(entity: Entity): Entity {
  return {
    ...entity,
    tags: [
      ...entity.tags,
      ...entity.themes.map((t) => `tema:${t}`),
      ...entity.functions.map((f) => `funcao:${f}`),
      ...(entity.companyKey && entity.companyKey !== "autonomo" ? [`org:${entity.companyKey}`] : []),
    ],
  };
}

export const dynamic = "force-dynamic";

interface RecommendBody {
  entityId?: string;
  compareToEntityId?: string; // if omitted, ranks against the whole workspace
  withNarrative?: boolean;
}

export async function POST(request: Request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "missing workspace api key (Bearer header or ?workspace=)" },
      { status: 401 },
    );
  }

  const workspace = await getWorkspaceByApiKey(apiKey);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  let body: RecommendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.entityId) {
    return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  }

  const [rawEntities, edges] = await Promise.all([
    listEntities(workspace.id, { withScoreBreakdown: false }),
    listEdges(workspace.id),
  ]);
  const entities = rawEntities.map(withSignals);

  const target = entities.find((e) => e.id === body.entityId);
  if (!target) {
    return NextResponse.json({ error: "entity not found in this workspace" }, { status: 404 });
  }

  // Single-pair comparison with an optional narrative.
  if (body.compareToEntityId) {
    const other = entities.find((e) => e.id === body.compareToEntityId);
    if (!other) {
      return NextResponse.json(
        { error: "compareToEntityId not found in this workspace" },
        { status: 404 },
      );
    }

    const result = computeSynergyScore(target, other, edges);
    let narrative: string | null = null;

    if (body.withNarrative) {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(
          {
            error:
              "ANTHROPIC_API_KEY is not configured on this deployment; narrative generation is unavailable, but the score below is still valid.",
            score: result,
          },
          { status: 503 },
        );
      }
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      narrative = await generateSynergyNarrative({
        client,
        entityA: target,
        entityB: other,
        sharedTags: result.sharedTags,
      });
    }

    const saved = await saveRecommendation({
      workspaceId: workspace.id,
      entityAId: target.id,
      entityBId: other.id,
      score: result.score,
      sharedTags: result.sharedTags,
      narrative,
    });

    return NextResponse.json({ ...result, narrative, recommendationId: saved.id });
  }

  // Ranked list against the whole workspace.
  const ranked = rankSynergies(target, entities, edges);
  // Top matches only: large networks would otherwise return thousands of rows per request.
  return NextResponse.json({ target: target.id, ranked: ranked.slice(0, 20) });
}
