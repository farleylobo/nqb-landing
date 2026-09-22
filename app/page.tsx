'use client';

import { useState } from 'react';
import Image from 'next/image';
import AnalyzeModal from './components/AnalyzeModal';

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* HEADER */}
      <header className="border-b border-neutral-200 bg-white py-8">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo/atria-logo.png"
              alt="Atria Logo"
              width={60}
              height={60}
              className="h-16 w-16 object-contain"
            />
            <div>
              <h1 className="text-2xl font-black tracking-wide text-neutral-900">ATRIA</h1>
              <p className="mt-1 text-xs font-medium tracking-wider text-neutral-600">
                Conexões com propósito
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-gradient-to-b from-white to-stone-100 px-6 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-4 text-4xl font-black leading-tight text-neutral-900 md:text-5xl">
            Sua próxima oportunidade pode já estar na sua rede. O difícil é saber onde.
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-neutral-600 md:text-xl">
            Atria ajuda especialistas e organizações a descobrir quem acionar na rede que já construíram e por quê.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-neutral-900 px-8 py-3 font-semibold text-white transition-all hover:bg-neutral-800 hover:translate-y-[-2px]"
            >
              Analisar minha rede
            </button>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-4xl font-black text-neutral-900 md:text-5xl">
            Ao longo da carreira, você acumulou relacionamentos valiosos.
          </h2>
          <div className="mx-auto max-w-2xl">
            <p className="mb-6 text-lg leading-relaxed text-neutral-700">
              Clientes, ex-colegas, parceiros, líderes, especialistas e pessoas de diferentes empresas. Relações construídas ao longo de anos: cada uma carregando contextos, histórias e possibilidades diferentes.
            </p>
            <p className="mb-8 text-lg leading-relaxed text-neutral-700">
              Mas quando surge um objetivo concreto, como lançar uma nova oferta, chegar a uma empresa, encontrar um parceiro ou abrir um novo mercado, começa o problema: com quem falar primeiro?
            </p>
            <p className="mb-8 text-lg leading-relaxed text-neutral-700">
              Você tenta lembrar. Pesquisa no LinkedIn. Volta às mesmas pessoas. E, algumas semanas
              depois, percebe que já conhecia alguém que poderia ter ajudado.
            </p>
            <div className="rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 border-l-4 border-neutral-600 px-8 py-6">
              <p className="text-lg font-semibold text-neutral-900">
                Não faltam contatos. Falta <span className="font-black">clareza</span> sobre quais
                relações importam agora.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PREMISSA */}
      <section className="bg-stone-100 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-4xl font-black text-neutral-900 md:text-5xl">
            Talvez você não precise de mais contatos
          </h2>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-6 text-lg leading-relaxed text-neutral-700">
              A resposta padrão para gerar oportunidades costuma ser: postar mais, aumentar a
              audiência, prospectar mais, conhecer mais pessoas.
            </p>
            <p className="mb-6 text-lg leading-relaxed text-neutral-700">
              Mas e se parte das oportunidades que você procura já estiver na rede que construiu?
            </p>
            <p className="mb-8 text-lg leading-relaxed text-neutral-700">
              Antes de buscar mais conexões, vale entender melhor as que você já tem.
            </p>
            <p className="border-t border-neutral-300 pt-8 text-lg font-semibold text-neutral-900">
              Você não precisa virar influencer para extrair mais valor da rede que já construiu.
            </p>
          </div>
        </div>
      </section>

      {/* ALTERNATIVAS */}
      <section className="bg-neutral-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-4xl font-black text-neutral-900 md:text-5xl">
            As ferramentas ajudam. Mas ainda deixam uma pergunta sem resposta.
          </h2>
          <div className="grid gap-10 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-8">
              <h3 className="mb-3 text-xl font-bold text-neutral-900">CRM</h3>
              <p className="text-neutral-600">
                Excelente para acompanhar processos e relacionamentos. Mas foi feito para registrar
                o que aconteceu — não necessariamente para dizer quem merece sua atenção agora.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-8">
              <h3 className="mb-3 text-xl font-bold text-neutral-900">LinkedIn</h3>
              <p className="text-neutral-600">
                Tem sua rede inteira. Mas encontrar manualmente as pessoas certas para um objetivo
                específico ainda depende de pesquisa, filtros e memória.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-8">
              <h3 className="mb-3 text-xl font-bold text-neutral-900">Planilhas</h3>
              <p className="text-neutral-600">
                Flexíveis para organizar contatos. Difíceis de manter e ainda dependem de você para
                decidir quem realmente importa.
              </p>
            </div>
            <div className="rounded-2xl bg-white p-8">
              <h3 className="mb-3 text-xl font-bold text-neutral-900">Memória e indicações</h3>
              <p className="text-neutral-600">
                Funcionam — mas naturalmente favorecem quem está mais presente na memória. Pessoas
                relevantes podem simplesmente ficar fora do radar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-center text-4xl font-black text-neutral-900 md:text-5xl">
            Um objetivo. As pessoas certas. O próximo passo.
          </h2>
          <p className="mb-16 text-center text-lg text-neutral-600">
            Atria parte do seu objetivo, encontra sinais na sua rede e combina esses dados com o
            contexto que só você conhece para mostrar onde concentrar sua atenção.
          </p>

          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 text-3xl font-black text-white mx-auto">
                1
              </div>
              <h3 className="mb-2 text-lg font-bold text-neutral-900">Você define o objetivo</h3>
              <p className="text-neutral-600">
                &quot;Quero gerar conversas comerciais para esta nova oferta.&quot;
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 text-3xl font-black text-white mx-auto">
                2
              </div>
              <h3 className="mb-2 text-lg font-bold text-neutral-900">
                Atria encontra os sinais que importam
              </h3>
              <p className="text-neutral-600">
                Analisa sua rede a partir desse objetivo e cria uma primeira leitura das pessoas com
                maior relevância.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 text-3xl font-black text-white mx-auto">
                3
              </div>
              <h3 className="mb-2 text-lg font-bold text-neutral-900">Você entende e calibra</h3>
              <p className="text-neutral-600">
                Cada prioridade vem acompanhada dos fatores que levaram aquela pessoa até ali. Você
                adiciona contexto, proximidade, histórico e nuances que os dados sozinhos não
                conseguem revelar.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 text-3xl font-black text-white mx-auto">
                4
              </div>
              <h3 className="mb-2 text-lg font-bold text-neutral-900">
                Você transforma clareza em ação
              </h3>
              <p className="text-neutral-600">
                Com a análise calibrada, escolha quem abordar, defina o próximo passo e acompanhe o
                resultado.
              </p>
            </div>
          </div>

          <div className="mt-16 border-t border-neutral-200 pt-8 text-center">
            <p className="text-xl font-bold text-neutral-900">
              Atria traz estrutura. Você traz o contexto que só você conhece.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-4xl font-black text-neutral-900 md:text-5xl">
            Perguntas frequentes
          </h2>

          <div className="mx-auto max-w-2xl space-y-8">
            <div>
              <h3 className="mb-3 text-lg font-bold text-neutral-900">Isso é um CRM?</h3>
              <p className="text-neutral-600">
                Não. Um CRM ajuda você a registrar e acompanhar relacionamentos. Atria começa antes:
                ajuda você a descobrir quais relações merecem sua atenção para um objetivo
                específico.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-neutral-900">
                Como meus dados entram na Atria?
              </h3>
              <p className="text-neutral-600">
                Você importa os dados que deseja analisar. Atria trabalha somente com as informações
                fornecidas por você e deixa claro quando os dados não são suficientes para uma
                conclusão.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-neutral-900">
                Vai ser mais uma ferramenta que preciso ficar alimentando?
              </h3>
              <p className="text-neutral-600">
                Essa não é a proposta. Atria foi pensada para trabalhar principalmente com dados que
                você já possui, reduzindo ao máximo a necessidade de manutenção manual.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-bold text-neutral-900">Atria decide por mim?</h3>
              <p className="text-neutral-600">
                Não. Atria organiza sinais e ajuda você a enxergar padrões e prioridades que seriam
                difíceis de perceber manualmente. Mas nenhum dado conhece toda a história de uma
                relação. Por isso, você pode calibrar a análise com o contexto que só você possui.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-neutral-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-4xl font-black md:text-5xl">
            Sua próxima conversa importante pode começar com alguém que você já conhece.
          </h2>
          <p className="mb-8 text-lg text-neutral-300">
            Seja para gerar uma oportunidade, encontrar um parceiro ou mobilizar uma rede, Atria
            ajuda você a descobrir quem merece atenção agora — e por quê.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-neutral-900 px-8 py-3 font-semibold text-white border border-white transition-all hover:bg-white hover:text-neutral-900 hover:translate-y-[-2px]"
            >
              Analisar minha rede
            </button>
          </div>

          <p className="mt-8 text-sm text-neutral-400">
            Sem scraping oculto. Sem inventar relações. Você controla os dados usados na análise.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-neutral-900 px-6 py-12 text-white text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex justify-center">
            <div className="rounded-lg bg-white p-3">
              <Image
                src="/logo/atria-logo.png"
                alt="Atria Logo"
                width={50}
                height={50}
                className="h-12 w-12 object-contain"
              />
            </div>
          </div>
          <h3 className="mb-2 text-2xl font-black">Atria</h3>
          <p className="text-neutral-400">Conexões com propósito</p>
          <p className="mt-6 text-xs text-neutral-600">© 2026 Atria. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* MODAL */}
      <AnalyzeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
