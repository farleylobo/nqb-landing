import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import AdminUsersPanel from "./AdminUsersPanel";

export const metadata = { title: "Usuários — Rede" };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/explore");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-12">
      <h1 className="text-2xl font-semibold text-neutral-100">Usuários</h1>
      <p className="mt-2 text-sm text-neutral-400">Crie o acesso de cada piloto e vincule à rede (workspace) correta.</p>
      <AdminUsersPanel />
    </main>
  );
}
