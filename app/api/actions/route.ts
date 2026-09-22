import { NextResponse } from "next/server";
import { resolveWorkspace } from "@/lib/apiWorkspace";
import { listActions } from "@/lib/networkService";

export const dynamic = "force-dynamic";

/**
 * Lista os itens de "Ações" do workspace (ADR-005). Não faz join com
 * entities: o cliente resolve nome/cargo/organização/score a partir do
 * entityById já carregado (mesmo padrão de /api/network), casando por
 * `personId`.
 */
export async function GET(request: Request) {
  const resolved = await resolveWorkspace(request, { write: false });
  if ("response" in resolved) return resolved.response;
  const items = await listActions(resolved.workspace);
  return NextResponse.json({ items });
}
