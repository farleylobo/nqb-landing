import { redirect } from "next/navigation";
import { listAllWorkspaces, listWorkspacesForUser } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import ExploreShell from "./ExploreShell";
import WorkspacePicker from "./WorkspacePicker";

// Next.js 16: searchParams is a Promise and must be awaited (synchronous
// access was removed — before this fix, ?workspace= was silently ignored
// and every visit fell back to the demo workspace).
export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;

  // An explicit key in the URL always wins — this is the demo link and any
  // workspace link shared directly, untouched by ADR-004's login layer.
  if (workspace) {
    return <ExploreShell workspaceKey={workspace} />;
  }

  // No key in the URL: this request only reaches here if middleware.ts saw a
  // session cookie, but that check was DB-free — resolve and validate the
  // session for real now (see lib/session.ts).
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.isAdmin) {
    const workspaces = await listAllWorkspaces();
    return <WorkspacePicker workspaces={workspaces} />;
  }

  const memberships = await listWorkspacesForUser(user.id);
  const workspaceRecord = memberships[0];
  if (!workspaceRecord) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-100">Nenhuma rede vinculada</h1>
        <p className="mt-2 text-sm text-neutral-400">Sua conta ainda não está associada a um workspace. Fale com quem te convidou.</p>
      </main>
    );
  }

  return <ExploreShell workspaceKey={workspaceRecord.api_key} showLogout />;
}
