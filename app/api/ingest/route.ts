import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  completeIngestionJob,
  createIngestionJob,
  failIngestionJob,
  insertEntity,
} from "@/lib/db";
import { ExtractionError, extractFicha } from "@/lib/extraction";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { finalizeIngestedEntity } from "@/lib/networkService";

export const dynamic = "force-dynamic";

interface IngestBody {
  rawText?: string;
}

export async function POST(request: Request) {
  const resolved = await resolveWorkspace(request, { write: true });
  if ("response" in resolved) return resolved.response;
  const { workspace } = resolved;

  let body: IngestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rawText = body.rawText?.trim();
  if (!rawText) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured on this deployment. Set it in Netlify environment variables to enable ingestion.",
      },
      { status: 503 },
    );
  }

  const job = await createIngestionJob(workspace.id, rawText);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    return NextResponse.json({ jobId: job.id, entity: { ...enriched, rawSource: null } }, { status: 201 });
  } catch (err) {
    const message = err instanceof ExtractionError ? err.message : "extraction failed";
    await failIngestionJob(job.id, message);
    return NextResponse.json({ jobId: job.id, error: message }, { status: 422 });
  }
}
