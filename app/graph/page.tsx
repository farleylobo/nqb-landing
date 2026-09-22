import Link from "next/link";
import GraphView from "./GraphView";

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const workspaceKey = workspace ?? "demo-nqb-key";

  return (
    <main className="flex h-dvh w-full flex-col bg-black">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 text-sm">
        <span className="font-semibold text-neutral-100">Visualização 3D da rede</span>
        <span className="text-xs text-neutral-500">Arraste para girar · role para zoom · passe o mouse sobre um nó</span>
        <Link href={`/explore?workspace=${encodeURIComponent(workspaceKey)}`} className="text-xs text-sky-400 hover:underline">
          Abrir exploração completa →
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <GraphView workspaceKey={workspaceKey} />
      </div>
    </main>
  );
}
