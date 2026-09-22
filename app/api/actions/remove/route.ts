import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, removeActionItem } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Remove um item de "Ações" (ADR-005) — remoção não-destrutiva do ponto de
 * vista do produto: some da aba, mas não apaga nenhum outro dado da pessoa.
 * Body: { actionItemId }.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { actionItemId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.actionItemId) return NextResponse.json({ error: "actionItemId is required" }, { status: 400 });

  try {
    await removeActionItem(resolved.workspace, body.actionItemId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
