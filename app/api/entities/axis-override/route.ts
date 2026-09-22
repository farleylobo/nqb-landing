import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { ImportBatchError, setAxisOverride } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Salva o ajuste manual do dono para um eixo do score ("Por que apareceu
 * aqui" na ficha) — distinto da triagem geral em /api/entities/triage e do
 * feedback por objetivo em /api/entities/objective-feedback (ver CONTEXT.md
 * seção 4.8/4.9).
 * Body: { entityId, axis: "tema"|"decisao"|"proximidade"|"alcance", value: number|null }.
 * `value: null` remove o ajuste e volta ao valor calculado por regra.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;

  let body: { entityId?: string; axis?: string; value?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.entityId) return NextResponse.json({ error: "entityId is required" }, { status: 400 });
  if (!body.axis) return NextResponse.json({ error: "axis is required" }, { status: 400 });

  try {
    const entity = await setAxisOverride(resolved.workspace, body.entityId, body.axis, body.value ?? null);
    if (!entity) return NextResponse.json({ error: "entity not found in this workspace" }, { status: 404 });
    
    // Ensure the response is JSON-serializable and contains required fields
    return NextResponse.json({
      entity: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        type: entity.type,
        name: entity.name,
        role: entity.role,
        score: entity.score,
        scoreBreakdown: entity.scoreBreakdown,
        // Include other fields needed by frontend
        themes: entity.themes ?? [],
        functions: entity.functions ?? [],
        seniority: entity.seniority,
        triage: entity.triage,
        triageNote: entity.triageNote,
        company: entity.company,
        location: entity.location,
        connectedAt: entity.connectedAt,
        linkedinUrl: entity.linkedinUrl,
        attributes: entity.attributes,
      },
    });
  } catch (err) {
    // Handle all error types, not just ImportBatchError
    if (err instanceof ImportBatchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    
    // Log unexpected errors for debugging
    console.error("Error in axis-override API:", err);
    
    // Return a proper error response instead of crashing
    const errorMessage = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: `failed to save axis override: ${errorMessage}` },
      { status: 500 }
    );
  }
}
