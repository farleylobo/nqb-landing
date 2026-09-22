import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, submitRefinementAnswer } from "@/lib/networkService";
import type { RefinementAnswers } from "@/lib/enrichment/refinement";

export const dynamic = "force-dynamic";

/**
 * Registra as respostas de um item da rodada (ADR-008).
 * Body: { roundId, itemId, answers: { tema?, decisao?, proximidade?, alcance?, acao? } }.
 * Cada eixo respondido vira um override; "acao" (quando não é "nenhuma
 * agora") cria/atualiza um item em Ações. O dono pode responder só parte
 * das perguntas — campos omitidos não mexem em nada.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { roundId?: string; itemId?: string; answers?: RefinementAnswers };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.roundId) return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  if (!body.itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  try {
    const result = await submitRefinementAnswer(resolved.workspace, body.roundId, body.itemId, body.answers ?? {});
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
