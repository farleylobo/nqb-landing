import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, setObjectiveFeedback } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Salva o feedback do dono sobre o fit de uma pessoa para um objetivo
 * comercial declarado (ADR-003) — distinto da triagem geral em
 * /api/entities/triage.
 * Body: { entityId, objective: "merlin", decision: "concordo"|"ajustar"|"discordo"|null, note? }.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { entityId?: string; objective?: string; decision?: string | null; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  if (!body.objective) return NextResponse.json({ error: "objective is required" }, { status: 400 });

  try {
    const entity = await setObjectiveFeedback(resolved.workspace, body.entityId, body.objective, body.decision ?? null, body.note ?? null);
    if (!entity) return NextResponse.json({ error: "entity not found in this workspace" }, { status: 404 });
    return NextResponse.json({ entity });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
