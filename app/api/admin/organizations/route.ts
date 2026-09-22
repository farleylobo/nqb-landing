import { NextResponse } from "next/server";
import { addOrganizationMember, createOrganization, listOrganizations } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (!user.isAdmin) return { response: NextResponse.json({ error: "acesso restrito ao admin" }, { status: 403 }) };
  return { user };
}

// Admin-only: lists every organization (used to build the overlap report
// picker — see ADR-006). Member workspace names come from a separate call
// to the overlap route, which already returns them.
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const organizations = await listOrganizations();
  return NextResponse.json({ organizations });
}

interface CreateOrganizationBody {
  name?: string;
  workspaceIds?: string[];
}

// Creates an organization and attaches its member workspaces in one call.
// Fase 1 only: this does not create a collective workspace — that is a
// separate, not-yet-implemented step (see ADR-006).
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  let body: CreateOrganizationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });

  const workspaceIds = Array.isArray(body.workspaceIds)
    ? body.workspaceIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (workspaceIds.length < 2) {
    return NextResponse.json(
      { error: "informe ao menos 2 workspaceIds — uma organização de 1 membro não tem o que cruzar" },
      { status: 400 }
    );
  }

  const organization = await createOrganization(name.slice(0, 120));
  for (const workspaceId of workspaceIds) {
    await addOrganizationMember(organization.id, workspaceId);
  }

  return NextResponse.json({ id: organization.id, name: organization.name, workspaceIds }, { status: 201 });
}
