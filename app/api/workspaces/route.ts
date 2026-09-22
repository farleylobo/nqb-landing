import { NextResponse } from "next/server";
import { createWorkspace, listAllWorkspaces } from "@/lib/db";
import { generateApiKey } from "@/lib/auth";
import { isSettingsPreset } from "@/lib/enrichment/taxonomy";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

interface CreateWorkspaceBody {
  name?: string;
  /** Taxonomy preset ("padrao" | "rnq"); defaults to "padrao". */
  settingsPreset?: string;
}

export async function POST(request: Request) {
  let body: CreateWorkspaceBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const preset = isSettingsPreset(body.settingsPreset) ? body.settingsPreset : "padrao";
  const apiKey = generateApiKey();
  const workspace = await createWorkspace(name.slice(0, 120), apiKey, { preset });

  return NextResponse.json(
    {
      id: workspace.id,
      name: workspace.name,
      apiKey: workspace.api_key,
      createdAt: workspace.created_at,
      settings: workspace.settings,
    },
    { status: 201 },
  );
}
// Admin-only: lists every workspace (used by the admin page to build the
// "vincular a este workspace" dropdown when creating a pilot account — see
// ADR-004). Unlike POST above, this is not part of the public self-serve
// workspace-creation flow.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "acesso restrito ao admin" }, { status: 403 });

  const workspaces = await listAllWorkspaces();
  return NextResponse.json({ workspaces });
}
