import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rede — inteligência de rede com propósito",
  description:
    "Importe sua rede do jeito que ela está, veja quem decide, quem atua na sua missão e onde estão as portas — com score explicável.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 font-sans">
        {children}
      </body>
    </html>
  );
}
