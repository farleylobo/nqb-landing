import { NextResponse } from "next/server";
import { getWorkspaceByApiKey, listEntities } from "@/lib/db";
import { extractApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: "missing workspace api key (Bearer header or ?workspace=)" },
      { status: 401 },
    );
  }

  const workspace = await getWorkspaceByApiKey(apiKey);
  if (!workspace) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  const entities = await listEntities(workspace.id);
  return NextResponse.json({ entities });
}
