import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, triageEntity } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/** Saves the owner's triage ({ entityId, triage: "priorizar"|"reconheco"|"nao-reconheco"|"ruido"|null, note? }). */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { entityId?: string; triage?: string | null; note?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 });

  try {
    const entity = await triageEntity(resolved.workspace, body.entityId, body.triage ?? null, body.note ?? null);
    if (!entity) return NextResponse.json({ error: "entity not found in this workspace" }, { status: 404 });
    return NextResponse.json({ entity });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
