// Disparada automaticamente pelo Netlify a cada envio verificado do formulário.
// Encaminha os dados para a planilha do Google (Apps Script Web App).
// Variáveis de ambiente (Netlify > Project configuration > Environment variables):
//   SHEETS_WEBHOOK_URL  URL do Web App do Apps Script (termina em /exec)
//   SHEETS_SECRET       mesmo segredo definido em SECRET no Code.gs

export const handler = async (event) => {
  const { payload } = JSON.parse(event.body || '{}');
  if (!payload || payload.form_name !== 'analisar-rede') {
    return { statusCode: 200, body: 'ignored' };
  }

  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) {
    console.error('SHEETS_WEBHOOK_URL não configurada; envio salvo apenas no Netlify Forms.');
    return { statusCode: 200, body: 'no webhook' };
  }

  const d = payload.data || {};
  const row = {
    secret: process.env.SHEETS_SECRET || '',
    data_envio: payload.created_at || new Date().toISOString(),
    nome: d.nome || '',
    email: d.email || '',
    telefone: d.telefone || '',
    linkedin: d.linkedin || '',
    site: d.site || '',
    oferta: [d.oferta, d.oferta_outro].filter(Boolean).join(': '),
    objetivo: d.objetivo || '',
    tamanho_rede: d.tamanho_rede || '',
    id_netlify: payload.id || '',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
      redirect: 'follow',
    });
    const text = await res.text();
    if (!res.ok || !text.includes('ok')) console.error('Planilha respondeu:', res.status, text.slice(0, 300));
  } catch (err) {
    console.error('Falha ao enviar para a planilha:', err);
  }
  return { statusCode: 200, body: 'done' };
};
