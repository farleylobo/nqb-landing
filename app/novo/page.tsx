import CreateWorkspaceForm from "./CreateWorkspaceForm";

export const metadata = { title: "Criar workspace — Rede" };

export default function NewWorkspacePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-neutral-100">Criar workspace</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Um workspace guarda uma rede (a sua, ou a de um cliente). Você recebe uma chave de acesso — ela é a única forma de abrir o workspace, então guarde-a
        em lugar seguro.
      </p>
      <CreateWorkspaceForm />
    </main>
  );
}
