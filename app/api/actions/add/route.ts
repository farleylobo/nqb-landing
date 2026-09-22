import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { addToActions, ImportBatchError } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * "Adicionar às ações" — usado tanto pela ficha quanto pela Lista (ADR-005).
 * Idempotente: se já existe um item para essa (pessoa, objetivo), devolve o
 * existente em vez de criar duplicado.
 * Body: { entityId, objective }.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { entityId?: string; objective?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  if (!body.objective) return NextResponse.json({ error: "objective is required" }, { status: 400 });

  try {
    const item = await addToActions(resolved.workspace, body.entityId, body.objective);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
