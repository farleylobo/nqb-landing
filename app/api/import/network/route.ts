import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { updateWorkspaceSettings } from "@/lib/db";
import { isSettingsPreset } from "@/lib/enrichment/taxonomy";
import { ImportBatchError, importBatch } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Imports one batch of a network: { entities?, edges?, companyProfiles?, settingsPreset? }.
 * The browser parses the file (LinkedIn export, spreadsheet or nqb-import JSON), shows a
 * preview, and sends batches here; POST /api/network/recompute finalizes hubs and scores.
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

  if (isSettingsPreset(body.settingsPreset)) {
    const settings = { ...workspace.settings, preset: body.settingsPreset };
    await updateWorkspaceSettings(workspace.id, settings);
    workspace.settings = settings;
  }

  try {
    const result = await importBatch(workspace, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ImportBatchError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }
}
