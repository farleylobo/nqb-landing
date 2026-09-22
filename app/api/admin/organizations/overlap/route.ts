import { NextResponse } from "next/server";
import { getOrganizationById } from "@/lib/db";
import { computeOrganizationOverlap } from "@/lib/organizationService";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Admin-only: GET /api/admin/organizations/overlap?organizationId=...
// Returns the Fase 1 overlap report (ADR-006) — who/what appears in 2+ of
// the organization's member workspaces. Read-only.
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "acesso restrito ao admin" }, { status: 403 });

  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!organizationId) return NextResponse.json({ error: "organizationId é obrigatório" }, { status: 400 });

  const organization = await getOrganizationById(organizationId);
  if (!organization) return NextResponse.json({ error: "organização não encontrada" }, { status: 404 });

  const result = await computeOrganizationOverlap(organizationId);
  return NextResponse.json({ organization: { id: organization.id, name: organization.name }, ...result });
}
