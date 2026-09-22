import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { addWorkspaceMember, createUser, getUserByEmail, listUsersWithWorkspaces } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };
  if (!user.isAdmin) return { response: NextResponse.json({ error: "acesso restrito ao admin" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const users = await listUsersWithWorkspaces();
  return NextResponse.json({ users });
}

interface CreateUserBody {
  email?: string;
  password?: string;
  workspaceId?: string;
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  let body: CreateUserBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";

  if (!email || !email.includes("@")) return NextResponse.json({ error: "e-mail inválido" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "a senha precisa de ao menos 8 caracteres" }, { status: 400 });
  if (!workspaceId) return NextResponse.json({ error: "workspaceId é obrigatório" }, { status: 400 });

  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "já existe uma conta com esse e-mail" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser(email, passwordHash, false);
  await addWorkspaceMember(user.id, workspaceId);

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
