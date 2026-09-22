import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import LoginForm from "./LoginForm";

export const metadata = { title: "Entrar — Rede" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/explore");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-neutral-100">Entrar</h1>
      <p className="mt-2 text-sm text-neutral-400">Acesse sua rede com o e-mail e a senha que você recebeu.</p>
      <LoginForm />
    </main>
  );
}
