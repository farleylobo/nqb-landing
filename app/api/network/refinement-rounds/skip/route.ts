import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, skipRefinementItem } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/** Body: { roundId, itemId }. Pula um item sem tocar em score ou ações. */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { roundId?: string; itemId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.roundId) return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  if (!body.itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  try {
    const item = await skipRefinementItem(resolved.workspace, body.roundId, body.itemId);
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof ImportBatchError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
