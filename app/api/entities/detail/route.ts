import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { getEntity } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Full entity (including the score explanation) for the profile panel: GET ?id=<entityId>. */
export async function GET(request: Request) {
  const resolved = await resolveWorkspace(request, { write: false });
  if ("response" in resolved) return resolved.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const entity = await getEntity(resolved.workspace.id, id);
  if (!entity) return NextResponse.json({ error: "entity not found in this workspace" }, { status: 404 });
  return NextResponse.json({ entity: { ...entity, rawSource: null } });
}
