import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { getRefinementRoundDetail } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/** GET ?workspace=&roundId= — rodada + itens (personId, status, answers). */
export async function GET(request: Request) {
  const resolved = await resolveWorkspace(request, { write: false });
  if ("response" in resolved) return resolved.response;
  const roundId = new URL(request.url).searchParams.get("roundId");
  if (!roundId) return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  const detail = await getRefinementRoundDetail(resolved.workspace, roundId);
  if (!detail) return NextResponse.json({ error: "rodada não encontrada" }, { status: 404 });
  return NextResponse.json(detail);
}
