import Dashboard from "./Dashboard";

export default async function AppPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  return <Dashboard initialWorkspaceKey={workspace ?? "demo-nqb-key"} />;
}
