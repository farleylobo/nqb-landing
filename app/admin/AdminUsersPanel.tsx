"use client";

import { useEffect, useState, type FormEvent } from "react";

interface WorkspaceOption {
  id: string;
  name: string;
  api_key: string;
}

interface UserRow {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  workspaces: { id: string; name: string }[];
}

export default function AdminUsersPanel() {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Same shape as ExploreShell's data-loading effect: the loader lives
  // inside the effect and reloads are triggered by bumping a counter, not
  // by calling an outer function imperatively (that pattern trips the
  // react-hooks "no setState directly in an effect" rule).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [wsRes, usersRes] = await Promise.all([fetch("/api/workspaces"), fetch("/api/admin/users")]);
        const wsBody = await wsRes.json().catch(() => ({}));
        const usersBody = await usersRes.json().catch(() => ({}));
        if (!wsRes.ok) throw new Error(wsBody.error ?? "falha ao carregar workspaces");
        if (!usersRes.ok) throw new Error(usersBody.error ?? "falha ao carregar usuários");
        if (!cancelled) {
          const ws: WorkspaceOption[] = wsBody.workspaces ?? [];
          setWorkspaces(ws);
          setUsers(usersBody.users ?? []);
          setWorkspaceId((current) => current || ws[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "erro ao carregar dados");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadCounter]);

  async function handleCreateWorkspace() {
    const name = newWorkspaceName.trim();
    if (!name) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "falha ao criar workspace");
      setNewWorkspaceName("");
      setWorkspaceId(body.id);
      setFeedback(`Workspace "${name}" criado.`);
      setReloadCounter((n) => n + 1);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "erro ao criar workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, workspaceId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "falha ao criar usuário");
      setFeedback(`Conta criada para ${body.email}. Envie o e-mail e a senha para a pessoa por um canal seguro (não pelo chat com a IA).`);
      setEmail("");
      setPassword("");
      setReloadCounter((n) => n + 1);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "erro ao criar usuário");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-neutral-400">Carregando…</p>;
  if (loadError) return <p className="mt-6 text-sm text-red-400">{loadError}</p>;

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section className="rounded-md border border-neutral-800 p-4">
        <h2 className="text-sm font-semibold text-neutral-100">Nova conta</h2>
        <form onSubmit={handleCreateUser} className="mt-3 flex flex-col gap-3">
          <label className="text-sm text-neutral-300">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Senha inicial (mín. 8 caracteres)
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </label>
          <label className="text-sm text-neutral-300">
            Workspace (rede)
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !workspaceId}
            className="mt-1 self-start rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
          >
            Criar conta
          </button>
        </form>

        <div className="mt-4 flex items-end gap-2 border-t border-neutral-800 pt-4">
          <label className="flex-1 text-sm text-neutral-300">
            Ou crie um workspace novo primeiro
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              placeholder="Nome da rede"
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </label>
          <button
            type="button"
            onClick={handleCreateWorkspace}
            disabled={busy || !newWorkspaceName.trim()}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-60"
          >
            Criar workspace
          </button>
        </div>

        {feedback && <p className="mt-3 text-sm text-neutral-300">{feedback}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-100">Contas existentes</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {users.map((user) => (
            <li key={user.id} className="rounded-md border border-neutral-800 px-4 py-3 text-sm">
              <span className="text-neutral-100">{user.email}</span>
              {user.is_admin && <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-400">admin</span>}
              <span className="ml-2 text-neutral-500">{user.workspaces.map((workspace) => workspace.name).join(", ") || "sem workspace"}</span>
            </li>
          ))}
          {users.length === 0 && <p className="text-sm text-neutral-500">Nenhuma conta criada ainda.</p>}
        </ul>
      </section>
    </div>
  );
}
