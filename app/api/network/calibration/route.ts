import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { listEntities, listPeopleCompanies } from "@/lib/db";
import { buildCalibration } from "@/lib/enrichment/calibration";
import { countPeopleByCompany } from "@/lib/enrichment/hubs";
import { resolveSettings } from "@/lib/enrichment/taxonomy";

export const dynamic = "force-dynamic";

/**
 * How well the score agrees with the owner's own triage decisions.
 *
 * Read-only and aggregate by construction: counts, AUC per variant and per
 * axis, and the mean blind score per triage option. No names, no rows — this
 * is the number that justifies the axis weights, not a data export.
 */
export async function GET(request: Request) {
  const resolved = await resolveWorkspace(request, { write: false });
  if ("response" in resolved) return resolved.response;
  const { workspace } = resolved;

  const settings = resolveSettings(workspace.settings);
  const [entities, people] = await Promise.all([listEntities(workspace.id), listPeopleCompanies(workspace.id)]);
  const counts = countPeopleByCompany(people);

  const report = buildCalibration({
    entities,
    context: (entity) => {
      const count = entity.companyKey ? counts.get(entity.companyKey) : undefined;
      return {
        settings,
        companyContacts: entity.type === "person" ? count?.people ?? 0 : 0,
        companyDisplayName: count?.displayName ?? entity.company,
      };
    },
  });

  return NextResponse.json({ workspace: { id: workspace.id, name: workspace.name }, report });
}
