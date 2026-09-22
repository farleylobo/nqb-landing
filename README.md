# Atria: landing page

Site estático da Atria (réplica fiel do site feito no Lovable) + página de formulário **Analisar minha rede**.

- Hospedagem: Netlify (projeto `atria-landing`)
- CSS: Tailwind CSS v4, compilado no build (`src/styles.css` → `public/assets/styles.css`)
- Formulário: Netlify Forms, com cópia automática para uma planilha do Google Sheets

## Estrutura

```
public/
  index.html                 landing page (texto e visual idênticos ao Lovable)
  analisar/index.html        formulário "Analisar minha rede"
  analisar/obrigado/         página de confirmação após o envio
  assets/                    logo e imagem do produto
src/styles.css               tokens de cor/tipografia + Tailwind
netlify/functions/
  submission-created.mjs     envia cada resposta para o Google Sheets
google-apps-script/Code.gs   script que grava as respostas na planilha
```

## Rodar localmente

```bash
npm install
npm run build        # gera public/assets/styles.css
npx serve public     # ou qualquer servidor estático
```

Para editar textos, altere direto o HTML em `public/`. As classes são Tailwind; o build gera só o CSS usado.

## Formulário → Google Sheets (configuração única)

1. Crie uma planilha no Google Sheets (ex.: "Atria – Leads").
2. Na planilha: **Extensões → Apps Script**. Apague o conteúdo e cole `google-apps-script/Code.gs`.
3. Troque `TROQUE-ESTE-SEGREDO` por um texto aleatório longo.
4. **Implantar → Nova implantação → Tipo: App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Autorize e copie a URL (termina em `/exec`).
5. No Netlify: **Project configuration → Environment variables**, crie:
   - `SHEETS_WEBHOOK_URL` = URL copiada no passo 4
   - `SHEETS_SECRET` = o mesmo segredo do passo 3
6. Faça um novo deploy. A partir daí cada envio vira uma linha na aba **Respostas**.

Mesmo sem o passo acima, todas as respostas ficam salvas em **Netlify → Forms → analisar-rede**, com notificação por e-mail configurável em **Forms → Form notifications**.

## Proteção contra spam

Honeypot (`bot-field`) + filtro de spam do Netlify. Só envios verificados disparam a função que grava na planilha.
