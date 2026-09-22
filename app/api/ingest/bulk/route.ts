import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { BulkImportError, parseWorkbookRows, prepareBulkImport } from "@/lib/bulkImport";
import { completeIngestionJob, createIngestionJob, failIngestionJob, insertEntity } from "@/lib/db";
import { ExtractionError, extractFicha } from "@/lib/extraction";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { finalizeIngestedEntity } from "@/lib/networkService";
import type { Entity, ExtractedFicha } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RowResult {
  row: number;
  name: string;
  status: "created" | "error";
  entity?: Entity;
  error?: string;
}

export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;
  const { workspace } = resolved;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "campo 'file' (multipart) com a planilha é obrigatório" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let prepared: ReturnType<typeof prepareBulkImport>;
  try {
    const rows = parseWorkbookRows(buffer);
    prepared = prepareBulkImport(rows);
  } catch (err) {
    const message = err instanceof BulkImportError ? err.message : "não foi possível processar a planilha";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const results: RowResult[] = [];

  if (prepared.format === "structured") {
    for (let i = 0; i < prepared.structuredFichas.length; i++) {
      const ficha = prepared.structuredFichas[i];
      const result = await insertFicha(workspace.id, ficha, null, i);
      if (result.entity) result.entity = await finalizeIngestedEntity(workspace, result.entity);
      results.push(result);
    }
  } else {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY is not configured on this deployment. Set it in Netlify environment variables to enable ingestão de perfis em texto livre.",
        },
        { status: 503 },
      );
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (let i = 0; i < prepared.freetextRows.length; i++) {
      const rawText = prepared.freetextRows[i];
      const job = await createIngestionJob(workspace.id, rawText);
      try {
        const ficha = await extractFicha({ client, rawText });
        const entity = await insertEntity({
          workspaceId: workspace.id,
          type: ficha.type,
          name: ficha.name,
          role: ficha.role,
          country: ficha.country,
          linkedinUrl: ficha.linkedinUrl,
          website: ficha.website,
          summary: ficha.summary,
          cluster: null,
          tags: ficha.tags,
          rawSource: rawText,
          source: "ingestao-ia",
        });
        await completeIngestionJob(job.id, entity.id);
        const enriched = await finalizeIngestedEntity(workspace, entity);
        results.push({ row: i, name: enriched.name, status: "created", entity: { ...enriched, rawSource: null } });
      } catch (err) {
        const message = err instanceof ExtractionError ? err.message : "extraction failed";
        await failIngestionJob(job.id, message);
        results.push({ row: i, name: rawText.slice(0, 40), status: "error", error: message });
      }
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const failed = results.length - created;

  return NextResponse.json({ format: prepared.format, total: results.length, created, failed, results }, { status: 201 });
}

async function insertFicha(workspaceId: string, ficha: ExtractedFicha, rawSource: string | null, index: number): Promise<RowResult> {
  try {
    const entity = await insertEntity({
      workspaceId,
      type: ficha.type,
      name: ficha.name,
      role: ficha.role,
      country: ficha.country,
      linkedinUrl: ficha.linkedinUrl,
      website: ficha.website,
      summary: ficha.summary,
      cluster: null,
      tags: ficha.tags,
      rawSource,
      source: "planilha",
    });
    return { row: index, name: entity.name, status: "created", entity };
  } catch (err) {
    const message = err instanceof Error ? err.message : "insert failed";
    return { row: index, name: ficha.name, status: "error", error: message };
  }
}
