import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, setActionItemFollowUp } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Define (ou limpa, com null) a data de follow-up de um item (ADR-005).
 * Body: { actionItemId, followUpDate: string|null } (formato YYYY-MM-DD).
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { actionItemId?: string; followUpDate?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.actionItemId) return NextResponse.json({ error: "actionItemId is required" }, { status: 400 });

  try {
    const item = await setActionItemFollowUp(resolved.workspace, body.actionItemId, body.followUpDate ?? null);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
