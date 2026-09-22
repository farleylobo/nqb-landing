import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { countUnclassifiedCompanies, listUnclassifiedCompanies, upsertCompanyProfiles } from "@/lib/db";
import { classifyCompanies, CompanyClassificationError, MAX_COMPANIES_PER_CALL } from "@/lib/enrichment/companyClassifier";

export const dynamic = "force-dynamic";

/**
 * Classifies the next batch of this workspace's organizations that have no AI/human
 * profile yet. Only organization names are sent to the model. The client calls this
 * repeatedly until `remaining` is 0, then POST /api/network/recompute.
 */
export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;
  const { workspace } = resolved;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não está configurada neste deploy; a classificação de empresas por IA está indisponível." },
      { status: 503 }
    );
  }

  const batch = await listUnclassifiedCompanies(workspace.id, 40);
  if (batch.length === 0) return NextResponse.json({ classified: 0, remaining: 0 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const profiles = await classifyCompanies({ client, companies: batch.slice(0, MAX_COMPANIES_PER_CALL) });
    // Companies the model skipped are stored as rule-level placeholders so the loop always advances.
    const returned = new Set(profiles.map((p) => p.companyKey));
    const placeholders = batch
      .filter((c) => !returned.has(c.companyKey))
      .map((c) => ({ companyKey: c.companyKey, displayName: c.displayName, orgType: null, sector: "outros", themes: [], source: "ia" as const }));
    await upsertCompanyProfiles([...profiles, ...placeholders]);
    const remaining = await countUnclassifiedCompanies(workspace.id);
    return NextResponse.json({ classified: batch.length, remaining });
  } catch (err) {
    const message = err instanceof CompanyClassificationError ? err.message : "falha ao classificar empresas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
