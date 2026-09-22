import { NextResponse } from "next/server";
import { getWorkspaceByApiKey, listEdges, listEntities } from "@/lib/db";
import { buildGraphJson } from "@/lib/graph";
import { extractApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const [entities, edges] = await Promise.all([
    listEntities(workspace.id),
    listEdges(workspace.id),
  ]);

  const graph = buildGraphJson(entities, edges);
  return NextResponse.json(graph);
}
