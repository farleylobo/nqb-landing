import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, importInteractions } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Imports a real interaction signal from the owner's full LinkedIn data
 * export: { messagesCsv?, invitationsCsv? } as raw CSV text. Separate from
 * POST /api/import/network (which handles Connections.csv / planilha /
 * nqb-import) because this is a distinct, optional file from a different
 * LinkedIn export flow ("Obter uma cópia dos seus dados" completa, não a
 * exportação simples de Conexões) — see ADR-007.
 *
 * Does not recompute scores; the client follows up with the same
 * POST /api/network/recompute (?phase=hubs, then ?phase=scores) already
 * used after a network import.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;
  const { workspace } = resolved;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const messagesCsv = typeof body.messagesCsv === "string" ? body.messagesCsv : undefined;
  const invitationsCsv = typeof body.invitationsCsv === "string" ? body.invitationsCsv : undefined;
  if (!messagesCsv && !invitationsCsv) {
    return NextResponse.json({ error: "envie messagesCsv e/ou invitationsCsv" }, { status: 422 });
  }

  try {
    const result = await importInteractions(workspace, { messagesCsv, invitationsCsv });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ImportBatchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
