import Link from "next/link";

interface WorkspaceOption {
  id: string;
  name: string;
  api_key: string;
}

interface Props {
  workspaces: WorkspaceOption[];
}

// Shown only to the admin (Farley) when he opens /explore with no explicit
// ?workspace= — pilots never see this, they land straight in their one
// workspace (see app/explore/page.tsx).
export default function WorkspacePicker({ workspaces }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-neutral-100">Workspaces</h1>
      <p className="mt-2 text-sm text-neutral-400">Você está logado como admin — escolha uma rede para abrir.</p>
      <ul className="mt-6 flex flex-col gap-2">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <Link
              href={`/explore?workspace=${encodeURIComponent(workspace.api_key)}`}
              className="block rounded-md border border-neutral-800 px-4 py-3 text-sm text-neutral-100 transition hover:border-neutral-600"
            >
              {workspace.name}
            </Link>
          </li>
        ))}
        {workspaces.length === 0 && <p className="text-sm text-neutral-500">Nenhum workspace criado ainda.</p>}
      </ul>
      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/admin" className="text-neutral-400 hover:text-neutral-200">
          Gerenciar usuários →
        </Link>
        <Link href="/novo" className="text-neutral-400 hover:text-neutral-200">
          Criar workspace →
        </Link>
      </div>
    </main>
  );
}
