import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { recomputeHubs, recomputeScoresPage, recomputeWorkspace } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Finalizes an import. `?phase=hubs` rebuilds institutional hubs; `?phase=scores&offset=N`
 * re-enriches and re-scores one page (loop until nextOffset is null). Without `phase`,
 * does everything in one call — fine for small workspaces.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;
  const url = new URL(request.url);
  const phase = url.searchParams.get("phase");
  if (phase === "hubs") return NextResponse.json(await recomputeHubs(resolved.workspace));
  if (phase === "scores") {
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    return NextResponse.json(await recomputeScoresPage(resolved.workspace, offset));
  }
  return NextResponse.json(await recomputeWorkspace(resolved.workspace));
}
