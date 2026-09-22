import { NextResponse } from "next/server";
import { isReadOnlyWorkspace, resolveWorkspace } from "@/lib/apiWorkspace";
import { loadNetwork } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/** Everything the explore experience needs in one call: workspace, settings, entities and links. */
export async function GET(request: Request) {
  const resolved = await resolveWorkspace(request, { write: false });
  if ("response" in resolved) return resolved.response;
  const { workspace } = resolved;
  const network = await loadNetwork(workspace);
  return NextResponse.json({
    workspace: { id: workspace.id, name: workspace.name, readOnly: isReadOnlyWorkspace(workspace) },
    ...network,
  });
}
