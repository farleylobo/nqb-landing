/**
 * Atria: recebe os envios do formulário "Analisar minha rede" e grava na planilha.
 * Como instalar: veja README.md, seção "Google Sheets".
 */
const SECRET = 'TROQUE-ESTE-SEGREDO'; // use o mesmo valor em SHEETS_SECRET no Netlify
const SHEET_NAME = 'Respostas';
const HEADERS = ['Data do envio', 'Nome', 'E-mail', 'Telefone', 'LinkedIn', 'Site ou portfólio', 'Objetivo', 'Tamanho da rede', 'ID Netlify'];

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (body.secret !== SECRET) {
    return ContentService.createTextOutput('unauthorized');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(body.data_envio || Date.now()),
    body.nome, body.email, body.telefone, body.linkedin, body.site,
    body.objetivo, body.tamanho_rede, body.id_netlify,
  ]);
  return ContentService.createTextOutput('ok');
}
