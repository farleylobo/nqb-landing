import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { createRefinementRound, ImportBatchError, listRefinementRounds } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/** Lista as rodadas do workspace (mais recente primeiro). Cliente resolve nome/cargo/score dos itens pelo personId, mesmo padrão de /api/actions. */
export async function GET(request: Request) {
  const resolved = await resolveWorkspace(request, { write: false });
  if ("response" in resolved) return resolved.response;
  const rounds = await listRefinementRounds(resolved.workspace);
  return NextResponse.json({ rounds });
}

/**
 * Cria uma Rodada de Refinamento (ADR-008).
 * Body: { objective, size?, personIds? }. Sem personIds, sugere as top
 * `size` (padrão 20) pessoas por score; com personIds, usa exatamente essa
 * lista (o dono pode pedir mais que o padrão).
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { objective?: string; size?: number; personIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.objective) return NextResponse.json({ error: "objective is required" }, { status: 400 });

  try {
    const detail = await createRefinementRound(resolved.workspace, body.objective, { size: body.size, personIds: body.personIds });
    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
