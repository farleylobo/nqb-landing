import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, setActionItemStatus } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Muda o status de um item (ADR-005): "a-fazer" | "contatado" |
 * "em-conversa" | "concluido". `outcome`/`customOutcomeText` são opcionais
 * e usados na prática só ao marcar "concluido" (resultado-ao-concluir) —
 * por isso não existe um endpoint dedicado só para resultado.
 * Body: { actionItemId, status, outcome?: string|null, customOutcomeText?: string|null }.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { actionItemId?: string; status?: string; outcome?: string | null; customOutcomeText?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.actionItemId) return NextResponse.json({ error: "actionItemId is required" }, { status: 400 });
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  try {
    const item = await setActionItemStatus(
      resolved.workspace,
      body.actionItemId,
      body.status,
      "outcome" in body ? body.outcome ?? null : undefined,
      body.customOutcomeText ?? null
    );
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
