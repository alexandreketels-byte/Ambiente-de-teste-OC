/**
 * PORTAL DE INDICADORES - Backend (Google Apps Script)
 *
 * Como implantar:
 * 1. Crie uma nova Planilha Google (vazia).
 * 2. Extensões > Apps Script, apague o conteúdo padrão e cole este arquivo inteiro.
 * 3. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem tem acesso: Qualquer pessoa
 * 4. Copie a URL do app da web (termina em /exec) e cole em API_URL no index.html.
 * 5. Sempre que editar este código, crie uma NOVA implantação (ou gerencie
 *    implantações > editar > nova versão) para a URL passar a refletir as mudanças.
 */

const TAB_DINAMICA_SHEET = 'TabDinamica';
const PEDIDOS_NAO_RECEBIDOS_SHEET = 'PedidosNaoRecebidos';
const META_SHEET = 'Meta';

// Guarda TODA previsão editada manualmente (por Pedido), numa aba própria e
// permanente — é a "fonte da verdade" das edições, independente de quantas
// vezes Pedidos Não Recebidos for reimportado.
const PREVISOES_MANUAIS_SHEET = 'PrevisoesManuais';
const PREVISOES_MANUAIS_HEADERS = ['Pedido', 'Previsao', 'EditadoEm'];

// Tipo de ocorrência corrigido à mão (por pedido). É a "fonte da verdade" dos
// ajustes: toda vez que um texto novo é processado, o tipo do pedido é
// trocado pelo que está aqui (PROCV por pedido) — assim os indicadores por
// tipo refletem o motivo REAL, não o que o vendedor escolheu ao abrir.
const OCORRENCIAS_MANUAIS_SHEET = 'OcorrenciasManuais';
const OCORRENCIAS_MANUAIS_HEADERS = ['Pedido', 'Tipo', 'TipoOriginal', 'EditadoPor', 'EditadoEm'];
const CHAVE_CACHE_OCORRENCIAS = 'ocorrencias_manuais_v1';

// Pedidos marcados como URGENTE à mão (caixinha na tabela de ocorrências). A linha existir = urgente;
// desmarcar apaga a linha. Fica numa aba pequena e vale pra equipe toda.
const URGENTES_SHEET = 'PedidosUrgentes';
const URGENTES_HEADERS = ['Pedido', 'MarcadoPor', 'MarcadoEm'];
const CHAVE_CACHE_URGENTES = 'urgentes_v1';

const USUARIOS_SHEET = 'Usuarios';
const USUARIOS_HEADERS = ['Nome', 'PIN'];

const TAB_DINAMICA_HEADERS = [
  'Data (Cadastro)', 'Status Entrega', 'NF', 'Emissao NF', 'NF Remessa', 'Emissao NF Remessa',
  'Loja', 'Pedido', 'Pedido Marketplace', 'Origem Pedido (Grupo)', 'CPF/CNPJ', 'Contrib ICMS',
  'Nome Cliente', 'Endereço (cadastro)', 'Número do endereço (cadastro)',
  'Complemento do endereço (cadastro)', 'Bairro (cadastro)', 'CEP (cadastro)',
  'Cidade (cadastro)', 'UF (cadastro)', 'Endereço (entrega)', 'Número do endereço (entrega)',
  'Complemento do endereço (entrega)', 'Bairro (entrega)', 'CEP (entrega)', 'Cidade (entrega)',
  'UF (entrega)', 'Telefone 1', 'Telefone 2', 'Telefone 3', 'Email', 'Vendedor', 'Indicador',
  'Transportadora', 'Entrega Imediata', 'Previsao Entrega', 'Data de Entrega',
  'Previsão de Entrega (Transp)', 'Receb Cliente', 'CPF/CNPJ Ind', 'Endereco Ind', 'Cidade Ind',
  'UF Ind', 'Email Ind 1', 'Email Ind 2', 'Email Ind 3', 'Cubagem', 'Peso', 'Volumes',
  'VL Frete', 'VL Custo Total (Real)', 'VL Total NF', 'VL Total', 'VL RA', 'RT',
  'Qtde Parcelas', 'Meio de Pagamento', 'VL Pago Cartão (Internet)'
];

const PEDIDOS_NAO_RECEBIDOS_HEADERS = [
  'Transportadora', 'Data Coleta', 'Prev Etg', 'Atraso', 'Pedido', 'Cidade', 'NF', 'VL NF',
  'Cubagem', 'Peso', 'Loja', 'Cliente', 'Prev Etg Manual'
];
// Índices de coluna (1-based) usados na edição/preservação manual da previsão
const PNR_COL_PREV_ETG = 3;
const PNR_COL_PEDIDO = 5;
const PNR_COL_PREV_ETG_MANUAL = 13;

const TRATATIVAS_SHEET = 'Tratativas';
const TRATATIVAS_HEADERS = [
  'Pedido', 'NF', 'Cliente', 'Transportadora', 'Loja', 'Vendedor', 'Ocorrencia', 'Status',
  'EmRota', 'Previsao', 'Entregue', 'DataEntrega', 'DataUltMsg', 'AutorUltMsg', 'Mensagem',
  'HistoricoJSON'
];

const BAIXA_GFW_SHEET = 'BaixaEntregaGFW';
const BAIXA_GFW_HEADERS = [
  'Nota', 'Emissao', 'Status', 'Evento', 'PrevEntrega', 'DtAgendamento', 'Entrega',
  'CnpjRemetente', 'NomeRemetente', 'CidadeRemetente', 'UfRemetente',
  'CnpjDestinatario', 'NomeDestinatario', 'CidadeDestinatario', 'UfDestinatario',
  'Recebedor', 'QtdeVolume', 'ValorMercadoria'
];

const BAIXA_RTE_SHEET = 'BaixaEntregaRTE';
const BAIXA_RTE_HEADERS = [
  'CNPJ', 'NF', 'NFMais1', 'UltimoStatus', 'UltAtualizacao', 'PrevisaoEntrega',
  'DataEntregaReal', 'Remetente', 'Destinatario', 'PrazoDiasUteis', 'Emissao',
  'Entregue', 'Atrasado'
];

// Entregas informadas no grupo de WhatsApp da GFW (os entregadores postam o número da
// NF = comprovante de entrega). Guarda só "NF" e "quando" (nunca telefone/nome).
// Diferente das outras importações, esta ACRESCENTA ao que já existe (a conversa é um
// histórico: se substituísse, as entregas de ontem sumiriam ao importar o arquivo de hoje).
const ENTREGAS_WHATS_SHEET = 'EntregasWhatsApp';
const ENTREGAS_WHATS_HEADERS = ['NF', 'DataHora'];
const ENTREGAS_WHATS_DIAS_GUARDADOS = 90;

const EM_ROTA_GFW_SHEET = 'EmRotaGFW';
const EM_ROTA_GFW_HEADERS = [
  'NotaFiscal', 'DtEmissao', 'EmissaoCon', 'NomeRemetente', 'NomeDestinatario',
  'DtEntrega', 'DtAgendamento', 'RomaneioEmissao', 'ObsOcorrencia', 'MotoristaNF', 'MotoristaRom'
];

/**
 * Acesso por PIN — cada pessoa (você e seus colaboradores) tem uma linha na
 * aba "Usuarios" (colunas Nome / PIN). Pra dar ou tirar acesso de alguém,
 * basta adicionar ou apagar a linha dela direto na planilha, sem mexer em
 * código nenhum.
 */
/**
 * Rode esta função UMA VEZ direto no editor do Apps Script (menu de funções
 * no topo > selecione "configurarAcessoInicial" > ▶ Executar) pra criar a
 * aba "Usuarios" com um PIN de exemplo. Depois é só editar a planilha
 * direto: uma linha por pessoa, com Nome e um PIN (numérico ou não) —
 * pode ter quantas linhas quiser, e pra tirar o acesso de alguém basta
 * apagar a linha dela.
 */
function configurarAcessoInicial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USUARIOS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USUARIOS_SHEET);
    sheet.getRange(1, 1, 1, USUARIOS_HEADERS.length).setValues([USUARIOS_HEADERS]);
    sheet.getRange(2, 1, 1, 2).setValues([['Seu nome aqui', '1234']]);
    sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1).setNumberFormat('@'); // PIN como texto puro
  }
}

const CHAVE_CACHE_USUARIOS = 'usuarios_v1';

function lerUsuariosDaPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(USUARIOS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const numRows = sheet.getLastRow() - 1;
  return sheet.getRange(2, 1, numRows, 2).getValues(); // [Nome, PIN]
}

// Lista de usuários com cache de 2 min: toda requisição confere a senha, e
// reler a aba Usuarios a cada uma era trabalho repetido. Usuário NOVO
// funciona na hora (se não achar no cache, relê a planilha); só a REMOÇÃO
// de alguém pode levar até 2 min pra valer.
function getUsuarios(forcarLeitura) {
  const cache = CacheService.getScriptCache();
  if (!forcarLeitura) {
    const guardado = cache.get(CHAVE_CACHE_USUARIOS);
    if (guardado) { try { return JSON.parse(guardado); } catch (e) { /* recalcula */ } }
  }
  const lista = lerUsuariosDaPlanilha();
  try { cache.put(CHAVE_CACHE_USUARIOS, JSON.stringify(lista), 120); } catch (e) { /* ignora */ }
  return lista;
}

function pinValido(pin) {
  if (!pin) return false;
  const alvo = String(pin).trim();
  const bate = lista => lista.some(r => String(r[1]).trim() !== '' && String(r[1]).trim() === alvo);
  if (bate(getUsuarios())) return true;
  return bate(getUsuarios(true)); // não achou no cache: confere na planilha de verdade
}

function nomePorPin(pin) {
  const alvo = String(pin).trim();
  let linha = getUsuarios().find(r => String(r[1]).trim() === alvo);
  if (!linha) linha = getUsuarios(true).find(r => String(r[1]).trim() === alvo);
  return linha ? linha[0] : '';
}

function doGet(e) {
  const inicioMs = Date.now();
  try {
    const action = e.parameter.action;
    if (action === 'login') {
      const ok = pinValido(e.parameter.pin);
      return jsonResponse(ok ? { ok: true, nome: nomePorPin(e.parameter.pin) } : { ok: false });
    }
    if (!pinValido(e.parameter.pin)) return jsonResponse({ error: 'Acesso não autorizado. Faça login de novo.' });

    if (action === 'getPainel') {
      const p = getPainelComCache();
      p.servidorMs = Date.now() - inicioMs; // só pra diagnóstico: quanto tempo o SCRIPT levou (o site compara com o tempo total)
      return jsonResponse(p);
    }
    if (action === 'getIndicadores') return jsonResponse(getIndicadores(true));
    if (action === 'getStatus') return jsonResponse(getStatus());
    if (action === 'getPedidosDetalhe') {
      const transportadora = e.parameter.transportadora || 'TODAS';
      const apenasAtraso = e.parameter.apenasAtraso === '1';
      const apenasIndefinido = e.parameter.apenasIndefinido === '1';
      const apenasEntregue = e.parameter.apenasEntregue === '1';
      const apenasEmRota = e.parameter.apenasEmRota === '1';
      return jsonResponse(getPedidosDetalhe(transportadora, apenasAtraso, apenasIndefinido, apenasEntregue, apenasEmRota));
    }
    if (action === 'getPedidosRecebidosDetalhe') return jsonResponse(getPedidosRecebidosDetalhe());
    if (action === 'getTabDinamicaLookup') return jsonResponse(getTabDinamicaLookupPorPedido());
    if (action === 'getTratativasDetalhe') return jsonResponse(getTratativasDetalhe());
    if (action === 'getEmRotaGFWLookup') return jsonResponse(getEmRotaGFWLookupParaFrontend());
    if (action === 'getProcvTratativas') {
      // Junta os dois PROCVs usados ao processar Tratativas (Tabela Dinâmica
      // + Em Rota) numa única chamada. Cada parte é protegida na própria
      // caixinha: se uma falhar, a outra continua chegando normalmente.
      let tabDinamica = {}, emRota = {}, avisos = [];
      try { tabDinamica = getTabDinamicaLookupPorPedido(); } catch (e) { avisos.push('previsão/loja/vendedor: ' + e.message); }
      try { emRota = getEmRotaGFWLookupParaFrontend(); } catch (e) { avisos.push('Em Rota: ' + e.message); }
      const resposta = { tabDinamica, emRota };
      if (avisos.length > 0) resposta.avisos = avisos;
      return jsonResponse(resposta);
    }
    if (action === 'debugBaixaGFW') return jsonResponse(debugBaixaGFW());
    return jsonResponse({ error: 'ação inválida' });
  } catch (err) {
    return jsonResponse({ error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!pinValido(data.pin)) return jsonResponse({ error: 'Acesso não autorizado. Faça login de novo.' });

    const action = data.action;

    // --- Leituras filtradas (POST só porque a lista de pedidos/NFs pode ser longa pra caber na URL) ---
    if (action === 'getProcvTratativasFiltrado') return jsonResponse(getProcvTratativasFiltrado(data.pedidos || [], data.nfs || []));
    if (action === 'getEmRotaFiltrado') return jsonResponse(getEmRotaFiltrado(data.nfs || []));

    // --- Escritas: qualquer uma delas invalida os caches derivados (painel, listas, Em Rota) ---
    let resposta;
    if (action === 'importTabDinamica') resposta = importTabDinamicaBatch(data);
    else if (action === 'importPedidosNaoRecebidos') resposta = importPedidosNaoRecebidosBatch(data);
    else if (action === 'importTratativas') resposta = importTratativasBatch(data);
    else if (action === 'importBaixaEntregaGFW') resposta = importBatch(data, BAIXA_GFW_SHEET, BAIXA_GFW_HEADERS);
    else if (action === 'importBaixaEntregaRTE') resposta = importBatch(data, BAIXA_RTE_SHEET, BAIXA_RTE_HEADERS);
    else if (action === 'importEmRotaGFW') resposta = importBatch(data, EM_ROTA_GFW_SHEET, EM_ROTA_GFW_HEADERS);
    else if (action === 'importEntregasWhatsApp') resposta = importEntregasWhatsAppBatch(data);
    else if (action === 'reconstruirTabDinamicaLookup') { reconstruirTabDinamicaLookupSheet(); resposta = { ok: true }; }
    else if (action === 'editarPrevisaoPedido') resposta = editarPrevisaoPedido(data);
    else if (action === 'editarOcorrenciaPedido') resposta = editarOcorrenciaPedido(data);
    else if (action === 'marcarUrgente') resposta = marcarUrgente(data);
    else return jsonResponse({ error: 'ação inválida' });

    if (action !== 'marcarUrgente') invalidarCachePainel(); // marcar urgente não muda nenhum número do painel
    return jsonResponse(resposta);
  } catch (err) {
    // Sem isso, um erro aqui dentro fazia o Google devolver uma página HTML
    // de erro em vez de JSON — o site não entendia a resposta e ficava
    // tentando de novo à toa.
    return jsonResponse({ error: String(err && err.message ? err.message : err) });
  }
}

function getPrevisoesManuaisSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PREVISOES_MANUAIS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PREVISOES_MANUAIS_SHEET);
    sheet.getRange(1, 1, 1, PREVISOES_MANUAIS_HEADERS.length).setValues([PREVISOES_MANUAIS_HEADERS]);
  }
  return sheet;
}

// Lê todas as previsões manuais salvas: { pedido: "dd/mm/aaaa" | "Indefinido" }
function carregarPrevisoesManuais() {
  const sheet = getPrevisoesManuaisSheet();
  const mapa = {};
  if (sheet.getLastRow() <= 1) return mapa;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(r => {
    const pedido = String(r[0]).trim();
    if (pedido) mapa[pedido] = r[1] instanceof Date ? normalizarDataBR(r[1]) : String(r[1]).trim();
  });
  return mapa;
}

// Grava (ou atualiza) previsões manuais: novas = { pedido: previsao }.
// Reescreve a aba inteira de uma vez (ela é pequena) em texto puro, pra o
// Sheets não converter "dd/mm/aaaa" em data e nunca trocar dia com mês.
function salvarPrevisoesManuais(novas) {
  const pedidos = Object.keys(novas);
  if (pedidos.length === 0) return;
  const sheet = getPrevisoesManuaisSheet();
  const atual = {};
  const ordem = [];
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().forEach(r => {
      const p = String(r[0]).trim();
      if (!p) return;
      if (!Object.prototype.hasOwnProperty.call(atual, p)) ordem.push(p);
      atual[p] = [r[1] instanceof Date ? normalizarDataBR(r[1]) : String(r[1]).trim(), r[2]];
    });
  }
  const agora = new Date();
  pedidos.forEach(p => {
    const valor = String(novas[p]).trim();
    if (!Object.prototype.hasOwnProperty.call(atual, p)) {
      ordem.push(p);
      atual[p] = [valor, agora];
    } else if (atual[p][0] !== valor) {
      atual[p] = [valor, agora]; // só atualiza a data de edição se o valor mudou
    }
  });
  const linhas = ordem.map(p => [p, atual[p][0], atual[p][1]]);
  sheet.getRange(2, 1, linhas.length, 2).setNumberFormat('@');
  sheet.getRange(2, 1, linhas.length, 3).setValues(linhas);
}

/**
 * Importação de Pedidos Não Recebidos: SUBSTITUI a aba (é sempre uma foto do
 * momento), mas preserva a "Prev Etg" de todo pedido que já teve a previsão
 * editada manualmente (aba PrevisoesManuais). Roda dentro de um "lock" pra
 * duas importações simultâneas não se atropelarem.
 */
function importPedidosNaoRecebidosBatch(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return importPedidosNaoRecebidosBatchInterno(data);
  } finally {
    lock.releaseLock();
  }
}

function importPedidosNaoRecebidosBatchInterno(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  if (!sheet) sheet = ss.insertSheet(PEDIDOS_NAO_RECEBIDOS_SHEET);

  if (data.batchIndex === 0) {
    // ANTES de limpar: garante que tudo que está marcado como manual na aba
    // atual já está salvo em PrevisoesManuais. Se isso falhar, a exceção
    // interrompe a importação antes do clear() — nada é perdido.
    const daAba = {};
    if (sheet.getLastRow() > 1) {
      const antigos = sheet.getRange(2, 1, sheet.getLastRow() - 1, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).getValues();
      antigos.forEach(r => {
        const pedido = String(r[PNR_COL_PEDIDO - 1]).trim();
        if (pedido && r[PNR_COL_PREV_ETG_MANUAL - 1] === 'Sim') {
          const valor = r[PNR_COL_PREV_ETG - 1];
          daAba[pedido] = valor instanceof Date ? normalizarDataBR(valor) : String(valor).trim();
        }
      });
    }
    salvarPrevisoesManuais(daAba);

    sheet.clear();
    sheet.getRange(1, 1, 1, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).setValues([PEDIDOS_NAO_RECEBIDOS_HEADERS]);
  }

  const previsoesManuais = carregarPrevisoesManuais();

  const rows = (data.rows || []).map(row => {
    const linha = row.slice(0, PEDIDOS_NAO_RECEBIDOS_HEADERS.length - 1); // garante as 12 colunas originais
    const pedido = String(linha[PNR_COL_PEDIDO - 1] || '').trim();
    if (pedido && Object.prototype.hasOwnProperty.call(previsoesManuais, pedido)) {
      linha[PNR_COL_PREV_ETG - 1] = previsoesManuais[pedido];
      linha.push('Sim');
    } else {
      linha.push('');
    }
    return linha;
  });

  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).setValues(rows);
  }

  if (data.isLast) {
    setImportMeta(PEDIDOS_NAO_RECEBIDOS_SHEET, sheet.getLastRow() - 1);
  }

  return { ok: true, sheet: PEDIDOS_NAO_RECEBIDOS_SHEET, batchIndex: data.batchIndex, imported: rows.length, isLast: !!data.isLast };
}

/**
 * Confere e padroniza a previsão digitada: "Indefinido" ou uma data real em
 * dd/mm/aaaa (aceita "5/10/2026" e "05/10/26"). Antes qualquer texto era
 * aceito — "5/10" ou "31/02/2026" eram gravados e o pedido passava a contar
 * como "indefinido" sem ninguém perceber. Devolve null se não for válida.
 */
function normalizarNovaPrevisao(txt) {
  const t = String(txt || '').trim();
  if (/^indefinid[oa]$/i.test(t)) return 'Indefinido';
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]), mes = Number(m[2]);
  let ano = Number(m[3]);
  if (ano < 100) ano += 2000;
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  const p = n => String(n).padStart(2, '0');
  return `${p(dia)}/${p(mes)}/${ano}`;
}

/**
 * Edita manualmente a previsão de entrega de um pedido em Pedidos Não
 * Recebidos. Marca a linha como "editada manualmente" para que a próxima
 * importação preserve esse valor em vez de sobrescrever com o da planilha.
 * novaPrevisao pode ser uma data (texto) ou o texto "Indefinido".
 */
function editarPrevisaoPedido(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return { ok: false, error: 'Nenhum dado de Pedidos Não Recebidos importado ainda.' };

  const alvo = String(data.pedido || '').trim().toUpperCase();
  if (!alvo) return { ok: false, error: 'Informe o número do pedido.' };
  if (!String(data.novaPrevisao || '').trim()) return { ok: false, error: 'Informe a nova previsão (data ou Indefinido).' };
  const novaPrevisao = normalizarNovaPrevisao(data.novaPrevisao);
  if (!novaPrevisao) return { ok: false, error: `"${String(data.novaPrevisao).trim()}" não é uma data válida. Use dd/mm/aaaa (ex: 05/10/2026) ou deixe em branco para Indefinido.` };

  const numRows = sheet.getLastRow() - 1;
  const pedidos = sheet.getRange(2, PNR_COL_PEDIDO, numRows, 1).getValues();
  // O mesmo pedido pode aparecer em mais de uma linha (ex: mais de uma NF):
  // antes só a primeira era atualizada e as outras continuavam com a data velha.
  let pedidoNaAba = '';
  const linhas = [];
  for (let i = 0; i < numRows; i++) {
    const p = String(pedidos[i][0]).trim();
    if (p.toUpperCase() === alvo) { if (!pedidoNaAba) pedidoNaAba = p; linhas.push(i + 2); }
  }
  if (linhas.length === 0) return { ok: false, error: 'Pedido não encontrado em Pedidos Não Recebidos.' };

  // Primeiro grava na aba permanente de edições manuais (é ela que
  // sobrevive às reimportações); depois atualiza as linhas visíveis.
  salvarPrevisoesManuais({ [pedidoNaAba]: novaPrevisao });
  linhas.forEach(linha => {
    const celula = sheet.getRange(linha, PNR_COL_PREV_ETG);
    celula.setNumberFormat('@'); // texto puro — evita o Sheets converter "dd/mm/aaaa" pra Data
    celula.setValue(novaPrevisao);
    sheet.getRange(linha, PNR_COL_PREV_ETG_MANUAL).setValue('Sim');
  });
  return { ok: true, novaPrevisao };
}

/**
 * RODE UMA VEZ, direto no editor do Apps Script (menu de funções >
 * "protegerPrevisoesManuaisAgora" > Executar), logo depois de colar este
 * código e ANTES da próxima importação: copia pra aba PrevisoesManuais tudo
 * que hoje está marcado como manual em PedidosNaoRecebidos. Depois disso,
 * nenhuma reimportação consegue mais apagar essas edições.
 */
function protegerPrevisoesManuaisAgora() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  const daAba = {};
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).getValues().forEach(r => {
      const pedido = String(r[PNR_COL_PEDIDO - 1]).trim();
      if (pedido && r[PNR_COL_PREV_ETG_MANUAL - 1] === 'Sim') {
        const valor = r[PNR_COL_PREV_ETG - 1];
        daAba[pedido] = valor instanceof Date ? normalizarDataBR(valor) : String(valor).trim();
      }
    });
  }
  salvarPrevisoesManuais(daAba);
  const total = Object.keys(carregarPrevisoesManuais()).length;
  Logger.log('Previsões manuais protegidas agora: ' + Object.keys(daAba).length + ' | total salvo na aba PrevisoesManuais: ' + total);
  return { protegidasAgora: Object.keys(daAba).length, totalSalvo: total };
}

/**
 * RECUPERAÇÃO de previsões manuais perdidas, a partir de uma CÓPIA da
 * planilha de antes da perda (Arquivo > Histórico de versões > escolher a
 * versão de antes da importação > "Fazer uma cópia"). Cole o ID da cópia
 * (o trecho da URL entre /d/ e /edit) na constante abaixo e rode
 * "recuperarPrevisoesDaCopia" no editor.
 */
const ID_PLANILHA_COPIA_RECUPERACAO = 'COLE_AQUI_O_ID_DA_COPIA';

function recuperarPrevisoesDaCopia() {
  if (!ID_PLANILHA_COPIA_RECUPERACAO || ID_PLANILHA_COPIA_RECUPERACAO.indexOf('COLE_AQUI') === 0) {
    throw new Error('Preencha ID_PLANILHA_COPIA_RECUPERACAO com o ID da cópia (trecho da URL entre /d/ e /edit).');
  }
  const copia = SpreadsheetApp.openById(ID_PLANILHA_COPIA_RECUPERACAO);
  const abaCopia = copia.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  if (!abaCopia || abaCopia.getLastRow() <= 1) throw new Error('A cópia não tem a aba PedidosNaoRecebidos com dados.');

  const recuperadas = {};
  abaCopia.getRange(2, 1, abaCopia.getLastRow() - 1, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).getValues().forEach(r => {
    const pedido = String(r[PNR_COL_PEDIDO - 1]).trim();
    if (pedido && r[PNR_COL_PREV_ETG_MANUAL - 1] === 'Sim') {
      const valor = r[PNR_COL_PREV_ETG - 1];
      recuperadas[pedido] = valor instanceof Date ? normalizarDataBR(valor) : String(valor).trim();
    }
  });
  // Não sobrescreve edições mais novas feitas depois da cópia: só entra o que ainda não existe.
  const jaSalvas = carregarPrevisoesManuais();
  const aSalvar = {};
  Object.keys(recuperadas).forEach(p => { if (!Object.prototype.hasOwnProperty.call(jaSalvas, p)) aSalvar[p] = recuperadas[p]; });
  salvarPrevisoesManuais(aSalvar);

  // Aplica na aba atual (só colunas Prev Etg e Prev Etg Manual)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  let aplicadas = 0;
  if (sheet && sheet.getLastRow() > 1) {
    const n = sheet.getLastRow() - 1;
    const atual = sheet.getRange(2, 1, n, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).getValues();
    const todas = carregarPrevisoesManuais();
    const colPrev = [], colFlag = [];
    atual.forEach(r => {
      const p = String(r[PNR_COL_PEDIDO - 1]).trim();
      if (Object.prototype.hasOwnProperty.call(todas, p)) {
        colPrev.push([todas[p]]); colFlag.push(['Sim']); aplicadas++;
      } else {
        colPrev.push([r[PNR_COL_PREV_ETG - 1]]); colFlag.push([r[PNR_COL_PREV_ETG_MANUAL - 1]]);
      }
    });
    sheet.getRange(2, PNR_COL_PREV_ETG, n, 1).setValues(colPrev);
    sheet.getRange(2, PNR_COL_PREV_ETG_MANUAL, n, 1).setValues(colFlag);
  }
  invalidarCachePainel();
  Logger.log('Encontradas na cópia: ' + Object.keys(recuperadas).length + ' | novas salvas: ' + Object.keys(aSalvar).length + ' | aplicadas na aba atual: ' + aplicadas);
  return { encontradasNaCopia: Object.keys(recuperadas).length, novasSalvas: Object.keys(aSalvar).length, aplicadasNaAbaAtual: aplicadas };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Índices das colunas usadas no upsert (0-based, dentro da linha recebida do front)
const TAB_COL_LOJA = 6;           // Loja
const TAB_COL_PEDIDO = 7;         // Pedido
const TAB_COL_STATUS_ENTREGA = 1; // Status Entrega
const TAB_COL_VENDEDOR = 31;      // Vendedor
const TAB_COL_TRANSPORTADORA = 33; // Transportadora
const TAB_COL_PREVISAO_TRANSP = 37; // Previsão de Entrega (Transp)
const TAB_COL_RECEB_CLIENTE = 38; // Receb Cliente (fica logo depois da Previsão Transp)

// Mini-tabela derivada da Tabela Dinâmica, só com as 7 colunas realmente
// usadas pelos indicadores, pelo relatório de Pedidos Recebidos e pelo
// PROCV das Tratativas. A Tabela Dinâmica tem ~40 colunas e dezenas de
// milhares de linhas — ler ela inteira em toda consulta é lento. Essa
// mini-tabela é reconstruída toda vez que a Tabela Dinâmica é importada.
const TAB_DINAMICA_LOOKUP_SHEET = 'TabDinamicaLookup';
const TAB_DINAMICA_LOOKUP_HEADERS = ['Pedido', 'StatusEntrega', 'PrevisaoTransp', 'RecebCliente', 'Loja', 'Vendedor', 'Transportadora'];

function reconstruirTabDinamicaLookupSheetInterno() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const origem = ss.getSheetByName(TAB_DINAMICA_SHEET);
  let destino = ss.getSheetByName(TAB_DINAMICA_LOOKUP_SHEET);
  if (!destino) destino = ss.insertSheet(TAB_DINAMICA_LOOKUP_SHEET);

  let linhas = [];
  if (origem && origem.getLastRow() > 1) {
    const numRows = origem.getLastRow() - 1;
    const numCols = Math.max(
      TAB_COL_PEDIDO, TAB_COL_STATUS_ENTREGA, TAB_COL_PREVISAO_TRANSP,
      TAB_COL_RECEB_CLIENTE, TAB_COL_LOJA, TAB_COL_VENDEDOR, TAB_COL_TRANSPORTADORA
    ) + 1;
    // Única leitura larga (quase 40 colunas) — mas só acontece AQUI, na
    // importação, não a cada vez que alguém abre um relatório.
    const dados = origem.getRange(2, 1, numRows, numCols).getValues();
    linhas = dados.map(r => [
      r[TAB_COL_PEDIDO], r[TAB_COL_STATUS_ENTREGA], r[TAB_COL_PREVISAO_TRANSP],
      r[TAB_COL_RECEB_CLIENTE], r[TAB_COL_LOJA], r[TAB_COL_VENDEDOR], r[TAB_COL_TRANSPORTADORA]
    ]);
  }

  // Só limpa DEPOIS de ter lido tudo: antes limpava primeiro, e quem abrisse o
  // site durante a leitura via a mini-tabela vazia (previsão/loja em branco).
  destino.clearContents();
  destino.getRange(1, 1, 1, TAB_DINAMICA_LOOKUP_HEADERS.length).setValues([TAB_DINAMICA_LOOKUP_HEADERS]);
  if (linhas.length > 0) {
    destino.getRange(2, 1, linhas.length, TAB_DINAMICA_LOOKUP_HEADERS.length).setValues(linhas);
  }
}

/**
 * Chamada pela ação explícita "reconstruirTabDinamicaLookup" (disparada
 * pelo site logo após importar a Tabela Dinâmica). Usa uma trava: se já
 * tiver uma reconstrução rodando, RECUSA rápido em vez de empilhar outra
 * execução pesada.
 */
function reconstruirTabDinamicaLookupSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    throw new Error('Outra operação de importação/atualização já está em andamento na planilha. Aguarde uns 2-3 minutos (sem tentar de novo) e depois tente uma vez só.');
  }
  try {
    reconstruirTabDinamicaLookupSheetInterno();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Usada pelos indicadores, por "Pedidos Recebidos" e pelo PROCV das
 * Tratativas: garante que a mini-tabela existe. NUNCA deve travar essas
 * leituras — se não conseguir a trava rápido, segue com o que tiver.
 */
function garantirTabDinamicaLookupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TAB_DINAMICA_LOOKUP_SHEET);
  if (sheet && sheet.getLastRow() > 1) return sheet;

  const lock = LockService.getScriptLock();
  if (lock.tryLock(2000)) {
    try {
      reconstruirTabDinamicaLookupSheetInterno();
    } finally {
      lock.releaseLock();
    }
    sheet = ss.getSheetByName(TAB_DINAMICA_LOOKUP_SHEET);
  }
  return sheet;
}

/**
 * Importação da Tabela Dinâmica em modo "upsert": a aba NUNCA é limpa.
 * Pedido já existente (mesma coluna "Pedido") -> atualiza só Status Entrega,
 * Previsão de Entrega (Transp) e Receb Cliente.
 * Pedido novo -> é adicionado ao final, preservando o histórico.
 * Roda com trava pra duas importações não gravarem a mesma linha ao mesmo tempo.
 */
function importTabDinamicaBatch(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return importTabDinamicaBatchInterno(data);
  } finally {
    lock.releaseLock();
  }
}

function chavePedidoTab(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function importTabDinamicaBatchInterno(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TAB_DINAMICA_SHEET);
  if (!sheet) sheet = ss.insertSheet(TAB_DINAMICA_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TAB_DINAMICA_HEADERS.length).setValues([TAB_DINAMICA_HEADERS]);
  }

  const rows = data.rows || [];
  let novos = 0;
  let atualizados = 0;

  if (rows.length > 0) {
    // Índice Pedido -> posição (0-based) na planilha, construído a partir do que já existe
    const n = sheet.getLastRow() - 1;
    const pedidoParaIdx = {};
    if (n > 0) {
      sheet.getRange(2, TAB_COL_PEDIDO + 1, n, 1).getValues().forEach((p, i) => {
        const k = chavePedidoTab(p[0]);
        if (k) pedidoParaIdx[k] = i;
      });
    }

    // DESEMPENHO: antes eram 3 gravações separadas (setValue) POR pedido já
    // existente — um lote de 2000 linhas virava ~6000 idas à planilha e era o
    // que fazia a importação demorar e estourar o tempo. Agora lê as 3 colunas
    // uma vez, altera em memória e grava tudo de volta em 2 chamadas.
    let colStatus = null, colPrevReceb = null;
    const novasLinhas = [];
    const idxNovaPorPedido = {};
    rows.forEach(row => {
      const k = chavePedidoTab(row[TAB_COL_PEDIDO]);
      if (k && Object.prototype.hasOwnProperty.call(pedidoParaIdx, k)) {
        if (!colStatus) {
          colStatus = sheet.getRange(2, TAB_COL_STATUS_ENTREGA + 1, n, 1).getValues();
          colPrevReceb = sheet.getRange(2, TAB_COL_PREVISAO_TRANSP + 1, n, 2).getValues();
        }
        // "Previsão de Entrega (Transp)" também entra aqui: ela costuma vir vazia
        // na primeira vez que o pedido aparece e só é preenchida numa importação
        // seguinte — sem atualizar, o pedido ficava pra sempre sem previsão.
        const i = pedidoParaIdx[k];
        colStatus[i][0] = row[TAB_COL_STATUS_ENTREGA];
        colPrevReceb[i][0] = row[TAB_COL_PREVISAO_TRANSP];
        colPrevReceb[i][1] = row[TAB_COL_RECEB_CLIENTE];
        atualizados++;
      } else if (k && Object.prototype.hasOwnProperty.call(idxNovaPorPedido, k)) {
        // Pedido repetido dentro do mesmo arquivo: antes entrava duas vezes
        // (contava em dobro). Agora só atualiza a linha nova já separada.
        const nova = novasLinhas[idxNovaPorPedido[k]];
        nova[TAB_COL_STATUS_ENTREGA] = row[TAB_COL_STATUS_ENTREGA];
        nova[TAB_COL_PREVISAO_TRANSP] = row[TAB_COL_PREVISAO_TRANSP];
        nova[TAB_COL_RECEB_CLIENTE] = row[TAB_COL_RECEB_CLIENTE];
      } else {
        if (k) idxNovaPorPedido[k] = novasLinhas.length;
        novasLinhas.push(row);
      }
    });

    if (colStatus) {
      sheet.getRange(2, TAB_COL_STATUS_ENTREGA + 1, n, 1).setValues(colStatus);
      sheet.getRange(2, TAB_COL_PREVISAO_TRANSP + 1, n, 2).setValues(colPrevReceb);
    }

    if (novasLinhas.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, novasLinhas.length, TAB_DINAMICA_HEADERS.length).setValues(novasLinhas);
    }
    novos = novasLinhas.length;
  }

  if (data.isLast) {
    setImportMeta(TAB_DINAMICA_SHEET, sheet.getLastRow() - 1);
    // A reconstrução da mini-tabela (TabDinamicaLookup) roda à parte: o
    // frontend chama a ação "reconstruirTabDinamicaLookup" logo depois.
  }

  return { ok: true, sheet: TAB_DINAMICA_SHEET, batchIndex: data.batchIndex, novos, atualizados, isLast: !!data.isLast };
}

/**
 * Recebe um lote (batch) de linhas e SUBSTITUI a aba inteira (bases que são
 * sempre uma foto do momento). No primeiro lote (batchIndex === 0) a aba é
 * limpa e recriada.
 */
function importBatch(data, sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  if (data.batchIndex === 0) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const rows = data.rows || [];
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  }

  if (data.isLast) {
    setImportMeta(sheetName, sheet.getLastRow() - 1);
  }

  return { ok: true, sheet: sheetName, batchIndex: data.batchIndex, imported: rows.length, isLast: !!data.isLast };
}

function setImportMeta(sheetName, totalRows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let meta = ss.getSheetByName(META_SHEET);
  if (!meta) {
    meta = ss.insertSheet(META_SHEET);
    meta.getRange(1, 1, 1, 3).setValues([['Aba', 'Última Importação', 'Total de Linhas']]);
  }
  const data = meta.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === sheetName) { rowIndex = i + 1; break; }
  }
  const now = new Date();
  if (rowIndex === -1) {
    meta.appendRow([sheetName, now, totalRows]);
  } else {
    meta.getRange(rowIndex, 2, 1, 2).setValues([[now, totalRows]]);
  }
}

/**
 * Mantém só os dígitos de um valor, pra comparar NF/Nota de forma robusta
 * mesmo que um lado esteja como número e o outro como texto, com espaços,
 * zeros à esquerda, etc.
 */
function normalizarChaveNF(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\D/g, '');
}

/**
 * Converte o que vier da planilha (Date, "dd/mm/aaaa", "dd/mm/aaaa hh:mm",
 * "24/09/2026, 12:17:00", ISO "2026-09-30...") num Date à meia-noite, ou null
 * ("—", vazio, texto qualquer). Usada pra comparar previsão x entrega.
 */
function parseDataQualquer(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const t = String(v === null || v === undefined ? '' : v).trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

/**
 * Monta um índice NF -> {status, entrega, evento} a partir da Baixa de
 * Entrega GFW, usado como "PROCV" para saber quais pedidos (por número de
 * NF) já foram entregues, em que data, e qual foi a última ocorrência
 * registrada (coluna "Evento").
 */
function getBaixaGFWLookupPorNF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BAIXA_GFW_SHEET);
  const lookup = {};
  if (!sheet || sheet.getLastRow() <= 1) return lookup;

  const numRows = sheet.getLastRow() - 1;
  const dados = sheet.getRange(2, 1, numRows, 7).getValues(); // até a coluna G (Entrega)

  for (let i = 0; i < numRows; i++) {
    const nota = normalizarChaveNF(dados[i][0]);
    if (!nota) continue;
    const info = { status: dados[i][2], evento: dados[i][3], entrega: dados[i][6] };
    // A mesma NF pode aparecer mais de uma vez no arquivo: antes valia a ÚLTIMA
    // linha, mesmo que uma anterior já dissesse "entregue" — o pedido voltava a
    // contar como pendente. Uma vez entregue, continua entregue.
    if (!lookup[nota] || !statusEhEntregue(lookup[nota]) || statusEhEntregue(info)) lookup[nota] = info;
  }
  return lookup;
}

function statusEhEntregue(info) {
  if (!info) return false;
  const statusOk = String(info.status || '').trim().toLowerCase() === 'entregue';
  const temDataEntrega = info.entrega !== '' && info.entrega !== null && info.entrega !== undefined;
  return statusOk || temDataEntrega;
}

/**
 * Monta um índice NF -> {entregue, entrega} a partir da Baixa de Entrega RTE
 * (rastreio Rodonaves). O próprio arquivo já traz a coluna "Entregue"
 * (SIM/NÃO), então usamos ela direto (a coluna de data vem com "—" quando
 * ainda não foi entregue).
 */
function getBaixaRTELookupPorNF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BAIXA_RTE_SHEET);
  const lookup = {};
  if (!sheet || sheet.getLastRow() <= 1) return lookup;

  const numRows = sheet.getLastRow() - 1;
  const dados = sheet.getRange(2, 1, numRows, 12).getValues(); // até a coluna L (Entregue)

  for (let i = 0; i < numRows; i++) {
    const nf = normalizarChaveNF(dados[i][1]);          // NF (col B)
    if (!nf) continue;
    const info = {
      ultimoStatus: dados[i][3],   // col D
      ultAtualizacao: dados[i][4], // col E
      entrega: dados[i][6], entregue: dados[i][11]
    };
    // Mesma regra da GFW: NF repetida não "desentrega" um pedido já entregue.
    if (!lookup[nf] || !statusEhEntregueRTE(lookup[nf]) || statusEhEntregueRTE(info)) lookup[nf] = info;
  }
  return lookup;
}

function statusEhEntregueRTE(info) {
  if (!info) return false;
  return String(info.entregue || '').trim().toUpperCase() === 'SIM';
}

/**
 * Monta um índice NF -> {dtAgendamento, romaneio, motorista, obsOcorrencia}
 * a partir da Baixa "Em Rota GFW" — pedidos que já saíram pra entrega
 * (tem romaneio de emissão) mas ainda não foram baixados como entregues.
 */
function getEmRotaGFWLookupPorNF() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EM_ROTA_GFW_SHEET);
  const lookup = {};
  if (!sheet || sheet.getLastRow() <= 1) return lookup;

  const numRows = sheet.getLastRow() - 1;
  const dados = sheet.getRange(2, 1, numRows, 11).getValues(); // até a coluna K (MotoristaRom)

  for (let i = 0; i < numRows; i++) {
    const nf = normalizarChaveNF(dados[i][0]); // NotaFiscal (col A)
    if (!nf) continue;
    const info = {
      dtAgendamento: dados[i][6],  // col G
      romaneio: dados[i][7],       // col H
      obsOcorrencia: dados[i][8],  // col I
      motorista: dados[i][10]      // col K
    };
    // NF em mais de um romaneio: vale o MAIS RECENTE (antes valia a última
    // linha do arquivo, que podia ser um romaneio antigo e tirar o "Em Rota").
    const anterior = lookup[nf] ? parseDataQualquer(lookup[nf].romaneio) : null;
    const novo = parseDataQualquer(info.romaneio);
    if (!lookup[nf] || !anterior || (novo && novo >= anterior)) lookup[nf] = info;
  }
  return lookup;
}

// Normaliza uma data (seja ela um objeto Date do Sheets ou um texto
// "dd/mm/aaaa") pro mesmo formato de texto, pra poder comparar igualdade.
function normalizarDataBR(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  return String(v || '').trim();
}

// A "Últ. Atualização" da Baixa RTE vem como texto tipo
// "24/09/2026, 12:17:00" — extrai só a parte dd/mm/aaaa pra comparar com hoje.
function extrairDataBR(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const m = String(v || '').match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : '';
}

function hojeFormatadoBR() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

// "Em Rota" só conta como TRUE se o Romaneio de Emissão (coluna H do
// relatório) for de HOJE.
function emRotaHoje(info) {
  if (!info) return false;
  return extrairDataBR(info.romaneio) === hojeFormatadoBR();
}

// Mesma ideia, só que a partir da própria Baixa de Entrega RTE: "Em Rota"
// quando o Último Status (coluna D) é "Mercadoria em rota de entrega" E a
// Últ. Atualização (coluna E) é de hoje.
function emRotaHojeRTE(info) {
  if (!info) return false;
  const statusOk = String(info.ultimoStatus || '').trim().toLowerCase().indexOf('mercadoria em rota de entrega') !== -1;
  if (!statusOk) return false;
  return extrairDataBR(info.ultAtualizacao) === hojeFormatadoBR();
}

// Junta as duas fontes de "Em Rota" (arquivo dedicado do GFW + Último
// Status da Baixa RTE) — cada pedido só deve bater com uma das duas.
function pedidoEmRotaHoje(infoEmRotaGFW, infoRTE) {
  return emRotaHoje(infoEmRotaGFW) || emRotaHojeRTE(infoRTE);
}

// Texto da data a mostrar quando o pedido está numa das duas bases mas o
// romaneio/atualização não é de hoje (mostra a data sem destaque verde).
function dataRotaTexto(infoEmRotaGFW, infoRTE) {
  if (infoEmRotaGFW && infoEmRotaGFW.romaneio) return normalizarDataBR(infoEmRotaGFW.romaneio);
  if (infoRTE && String(infoRTE.ultimoStatus || '').trim().toLowerCase().indexOf('mercadoria em rota de entrega') !== -1) {
    return extrairDataBR(infoRTE.ultAtualizacao);
  }
  return '';
}

/**
 * Versão do lookup "Em Rota GFW" já resolvida (emRota true/false + data do
 * romaneio em texto), indexada por NF — usada pelas Tratativas. Fica em cache
 * até a próxima importação/edição (ou a virada do dia): antes era recalculada
 * a cada abertura do site, a cada "Processar texto" e a cada importação RTE.
 */
function getEmRotaGFWLookupParaFrontend() {
  const chave = chaveCacheDerivado('emrota');
  const guardado = cacheGetGrande(chave);
  if (guardado) return guardado;

  const lookupGFW = getEmRotaGFWLookupPorNF();
  const lookupRTE = getBaixaRTELookupPorNF();
  const nfs = new Set(Object.keys(lookupGFW).concat(Object.keys(lookupRTE)));
  const resultado = {};
  nfs.forEach(nf => {
    const infoGFW = lookupGFW[nf];
    const infoRTE = lookupRTE[nf];
    const emRota = pedidoEmRotaHoje(infoGFW, infoRTE);
    const dataRomaneio = dataRotaTexto(infoGFW, infoRTE);
    // NF que não está em rota e não tem data nenhuma não precisa ir (deixa o cache bem menor)
    if (emRota || dataRomaneio) resultado[nf] = { emRota, dataRomaneio };
  });
  cachePutGrande(chave, resultado, SEGUNDOS_CACHE_PAINEL);
  return resultado;
}

/**
 * Monta um índice Pedido -> {ocorrencia, status, dataUltMsg} a partir da
 * planilha de Tratativas (ocorrências). Se o mesmo pedido aparecer mais de
 * uma vez em Tratativas, fica valendo a última linha (a mais recente).
 * Chave em MAIÚSCULAS e sem espaços (antes "474798n" ou "474798N " não batiam).
 */
function getTratativasLookupPorPedido() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRATATIVAS_SHEET);
  const lookup = {};
  if (!sheet || sheet.getLastRow() <= 1) return lookup;

  const numRows = sheet.getLastRow() - 1;
  const idxOcorrencia = TRATATIVAS_HEADERS.indexOf('Ocorrencia');
  const idxStatus = TRATATIVAS_HEADERS.indexOf('Status');
  const idxDataUltMsg = TRATATIVAS_HEADERS.indexOf('DataUltMsg');
  const idxMensagem = TRATATIVAS_HEADERS.indexOf('Mensagem');
  const idxHistorico = TRATATIVAS_HEADERS.indexOf('HistoricoJSON');
  const dados = sheet.getRange(2, 1, numRows, TRATATIVAS_HEADERS.length).getValues();

  for (let i = 0; i < numRows; i++) {
    const pedido = normalizarChavePedido(dados[i][0]);
    if (pedido) {
      lookup[pedido] = {
        ocorrencia: dados[i][idxOcorrencia], status: dados[i][idxStatus],
        dataUltMsg: dados[i][idxDataUltMsg], mensagem: dados[i][idxMensagem],
        historicoJson: dados[i][idxHistorico]
      };
    }
  }
  return lookup;
}

/**
 * DIAGNÓSTICO TEMPORÁRIO: mostra amostras dos dois lados do cruzamento
 * (NF de Pedidos Não Recebidos x Nota da Baixa GFW).
 */
function debugBaixaGFW() {
  const lookup = getBaixaGFWLookupPorNF();
  const chavesEntregues = Object.keys(lookup).filter(k => statusEhEntregue(lookup[k]));
  const entreguesSet = new Set(chavesEntregues);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pedSheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);

  let totalPedidos = 0;
  let amostraNF = [];
  const coincidencias = [];

  if (pedSheet && pedSheet.getLastRow() > 1) {
    const numRows = pedSheet.getLastRow() - 1;
    totalPedidos = numRows;
    const nfCol = pedSheet.getRange(2, 7, numRows, 1).getValues();

    amostraNF = nfCol.slice(0, 10).map(r => ({
      original: r[0], tipo: typeof r[0], normalizado: normalizarChaveNF(r[0])
    }));

    nfCol.forEach(r => {
      const chave = normalizarChaveNF(r[0]);
      if (chave && entreguesSet.has(chave)) coincidencias.push({ nfOriginal: r[0], chave: chave });
    });
  }

  return {
    totalNotasNaBaixaGFW: Object.keys(lookup).length,
    totalComStatusEntregue: chavesEntregues.length,
    amostraChavesEntregues: chavesEntregues.slice(0, 10),
    totalPedidosNaoRecebidos: totalPedidos,
    amostraNFdePedidos: amostraNF,
    totalCoincidencias: coincidencias.length,
    amostraCoincidencias: coincidencias.slice(0, 10)
  };
}

const SEM_TRANSPORTADORA = '(sem transportadora)';

/**
 * Pedidos Não Recebidos já cruzados com TODAS as bases (GFW, RTE, Em Rota,
 * WhatsApp, Tratativas) e com a situação de prazo resolvida. É a MESMA lista
 * usada pelos números do painel e pelas listas que abrem ao clicar neles —
 * antes cada um tinha o seu próprio cálculo e os dois podiam divergir.
 * Fica em cache até a próxima importação/edição ou a virada do dia, então
 * abrir uma lista depois de abrir o painel não relê seis abas de novo.
 */
function getPedidosNaoRecebidosCalculados() {
  const chave = chaveCacheDerivado('pnr');
  const guardado = cacheGetGrande(chave);
  if (guardado) return guardado;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  const lista = [];
  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, PEDIDOS_NAO_RECEBIDOS_HEADERS.length).getValues();
    const lookupGFW = getBaixaGFWLookupPorNF();
    const lookupRTE = getBaixaRTELookupPorNF();
    const lookupEmRota = getEmRotaGFWLookupPorNF();
    const lookupTratativas = getTratativasLookupPorPedido();
    const lookupWhats = getEntregasWhatsLookupPorNF();

    data.forEach(r => {
      // Nome sem espaços nas pontas: antes "GFW " e "GFW" viravam duas linhas
      // no painel, e clicar no número da primeira abria uma lista vazia.
      const transportadora = String(r[0] === null || r[0] === undefined ? '' : r[0]).trim();
      if (EXCLUDED_TRANSPORTADORAS.indexOf(transportadora.toUpperCase()) !== -1) return;
      const nf = normalizarChaveNF(r[6]);
      const infoGFW = lookupGFW[nf];
      const infoRTE = lookupRTE[nf];
      const infoEmRota = lookupEmRota[nf];
      const whats = lookupWhats[nf] || '';
      const infoTrat = lookupTratativas[normalizarChavePedido(r[4])];
      const entregueGFW = statusEhEntregue(infoGFW);
      const entregueRTE = statusEhEntregueRTE(infoRTE);
      const entregueWhats = !!whats;

      // Data da entrega = a mais antiga entre as fontes que dizem "entregue"
      let dataEntrega = null;
      [entregueGFW ? infoGFW.entrega : null, entregueRTE ? infoRTE.entrega : null, entregueWhats ? whats : null]
        .forEach(v => { const d = parseDataQualquer(v); if (d && (!dataEntrega || d < dataEntrega)) dataEntrega = d; });

      lista.push({
        transportadora: transportadora || SEM_TRANSPORTADORA,
        dataColeta: r[1], prevEtg: r[2], atraso: r[3],
        pedido: r[4], cidade: r[5], nf: r[6], loja: r[10], cliente: r[11],
        entregueGFW, dataEntregaGFW: infoGFW ? infoGFW.entrega : '',
        entregueRTE, dataEntregaRTE: infoRTE ? infoRTE.entrega : '',
        entregueWhats, dataEntregaWhats: whats,
        entregue: entregueGFW || entregueRTE || entregueWhats,
        emRota: pedidoEmRotaHoje(infoEmRota, infoRTE),
        dataRomaneio: dataRotaTexto(infoEmRota, infoRTE),
        situacao: situacaoPrazo(r[2], entregueGFW || entregueRTE || entregueWhats, dataEntrega),
        ultimaOcorrencia: infoTrat ? infoTrat.mensagem : '',
        ultimaOcorrenciaHistorico: infoTrat ? infoTrat.historicoJson : ''
      });
    });
  }
  // Passa pelo JSON antes de guardar/devolver: assim a resposta é idêntica
  // venha do cache ou do cálculo (as datas viram texto do mesmo jeito).
  const serializada = JSON.parse(JSON.stringify(lista));
  cachePutGrande(chave, serializada, SEGUNDOS_CACHE_PAINEL);
  return serializada;
}

/**
 * Lista os pedidos não recebidos, opcionalmente filtrados por transportadora
 * ('TODAS' = todas, exceto as excluídas) e/ou situação. Usado quando o
 * usuário clica em um número no painel para ver os pedidos por trás dele.
 */
function getPedidosDetalhe(transportadora, apenasAtraso, apenasIndefinido, apenasEntregue, apenasEmRota) {
  const filtroTransp = String(transportadora || 'TODAS').trim();
  return getPedidosNaoRecebidosCalculados().filter(p => {
    if (filtroTransp !== 'TODAS' && p.transportadora !== filtroTransp) return false;
    if (apenasAtraso && p.situacao !== 'atraso') return false;
    if (apenasIndefinido && p.situacao !== 'indefinido') return false;
    if (apenasEntregue && !p.entregue) return false;
    if (apenasEmRota && !p.emRota) return false;
    return true;
  });
}

/**
 * Lista os pedidos que já constam como recebidos pelo cliente na Tabela
 * Dinâmica (coluna "Receb Cliente" preenchida): Data, Pedido e Transportadora.
 */
function getPedidosRecebidosDetalhe() {
  const sheet = garantirTabDinamicaLookupSheet();
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const numRows = sheet.getLastRow() - 1;
  const dados = sheet.getRange(2, 1, numRows, TAB_DINAMICA_LOOKUP_HEADERS.length).getValues();

  const result = [];
  for (let i = 0; i < numRows; i++) {
    const receb = dados[i][3]; // RecebCliente
    if (receb) {
      result.push({ data: receb, pedido: dados[i][0], transportadora: dados[i][6] });
    }
  }
  return result;
}

/**
 * Monta um índice Pedido -> { previsao, recebCliente, vendedor, loja } a partir
 * da Tabela Dinâmica, usado como "PROCV" para enriquecer outras listas (ex: Tratativas).
 */
function getTabDinamicaLookupPorPedido() {
  const sheet = garantirTabDinamicaLookupSheet();
  const lookup = {};
  if (!sheet || sheet.getLastRow() <= 1) return lookup;

  const numRows = sheet.getLastRow() - 1;
  const dados = sheet.getRange(2, 1, numRows, TAB_DINAMICA_LOOKUP_HEADERS.length).getValues();

  for (let i = 0; i < numRows; i++) {
    const pedido = chavePedidoTab(dados[i][0]);
    if (pedido) {
      lookup[pedido] = {
        previsao: dados[i][2], recebCliente: dados[i][3],
        loja: dados[i][4], vendedor: dados[i][5]
      };
    }
  }

  // Se o pedido teve a previsão ajustada manualmente, essa é a que vale.
  const manuais = carregarPrevisoesManuais();
  Object.keys(manuais).forEach(pedido => {
    if (!lookup[pedido]) lookup[pedido] = {};
    lookup[pedido].previsao = manuais[pedido];
  });

  return lookup;
}

/**
 * Importa as Tratativas de Ocorrências (coladas em texto e processadas no
 * navegador) para que fiquem visíveis a qualquer pessoa que abrir o site —
 * SUBSTITUI a aba inteira, é sempre a última leva processada. O formato da
 * coluna é forçado para texto antes de gravar, porque datas/horários como
 * "22/09/2026 11:12" seriam reinterpretados pelo Sheets e perderiam o horário.
 */
function importTratativasBatch(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRATATIVAS_SHEET);
  if (!sheet) sheet = ss.insertSheet(TRATATIVAS_SHEET);

  if (data.batchIndex === 0) {
    sheet.clear();
    sheet.getRange(1, 1, 1, TRATATIVAS_HEADERS.length).setValues([TRATATIVAS_HEADERS]);
  }

  const rows = (data.rows || []).map(r => r.slice(0, TRATATIVAS_HEADERS.length));
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(startRow, 1, rows.length, TRATATIVAS_HEADERS.length);
    range.setNumberFormat('@'); // força texto puro, sem autoconversão de datas
    range.setValues(rows);
  }

  if (data.isLast) {
    setImportMeta(TRATATIVAS_SHEET, sheet.getLastRow() - 1);
  }

  return { ok: true, sheet: TRATATIVAS_SHEET, batchIndex: data.batchIndex, imported: rows.length, isLast: !!data.isLast };
}

function getTratativasDetalhe() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TRATATIVAS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const numRows = sheet.getLastRow() - 1;
  const linhas = sheet.getRange(2, 1, numRows, TRATATIVAS_HEADERS.length).getValues();

  // "Em Rota" salvo junto com a tabela é só uma foto do dia em que o texto
  // foi processado — recalcula aqui, ao vivo (lookup em cache).
  try {
    const lookup = getEmRotaGFWLookupParaFrontend();
    const idxNF = TRATATIVAS_HEADERS.indexOf('NF');
    const idxEmRota = TRATATIVAS_HEADERS.indexOf('EmRota');
    linhas.forEach(l => {
      const info = lookup[normalizarChaveNF(l[idxNF])];
      l[idxEmRota] = info ? (info.emRota ? 'Em Rota' : (info.dataRomaneio || '')) : '';
    });
  } catch (e) { /* se falhar, segue com o valor que estava salvo */ }

  // Tipos de ocorrência ajustados à mão: vale o da aba OcorrenciasManuais e, no
  // fim de cada linha, vai um item extra com [tipo original, quem alterou, quando].
  try {
    const manuais = carregarOcorrenciasManuais();
    const idxPedido = TRATATIVAS_HEADERS.indexOf('Pedido');
    const idxOcorr = TRATATIVAS_HEADERS.indexOf('Ocorrencia');
    linhas.forEach(l => {
      const m = manuais[normalizarChavePedido(l[idxPedido])];
      if (m) { l[idxOcorr] = m.tipo; l.push(JSON.stringify([m.original, m.por, m.em])); }
      else l.push('');
    });
  } catch (e) {
    linhas.forEach(l => { if (l.length === TRATATIVAS_HEADERS.length) l.push(''); });
  }

  // Pedidos marcados como urgentes: mais um item no fim de cada linha, com
  // [quem marcou, quando] — ou vazio se não for urgente.
  try {
    const urgentes = carregarUrgentes();
    const idxPed = TRATATIVAS_HEADERS.indexOf('Pedido');
    linhas.forEach(l => {
      const u = urgentes[normalizarChavePedido(l[idxPed])];
      l.push(u ? JSON.stringify([u.por, u.em]) : '');
    });
  } catch (e) {
    linhas.forEach(l => l.push(''));
  }
  return linhas;
}

function getStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const meta = ss.getSheetByName(META_SHEET);
  const status = {};
  if (meta) {
    const data = meta.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      status[data[i][0]] = { ultimaImportacao: data[i][1], totalLinhas: data[i][2] };
    }
  }
  return status;
}

const EXCLUDED_TRANSPORTADORAS = ['SO NOTA', 'SEM TRANSPORTADORA', 'RETIRA'];

/**
 * Decide se uma "Prev Etg" está em atraso, indefinida, ou dentro do prazo,
 * SEMPRE comparando a data com hoje — em vez de usar o número de dias de
 * atraso vindo pronto da planilha original. Isso garante que editar a
 * previsão (inclusive marcar como "Indefinido") reflita corretamente aqui.
 */
function statusPrevisao(prevEtg) {
  if (prevEtg === '' || prevEtg === null || prevEtg === undefined) return 'indefinido';
  if (!(prevEtg instanceof Date) && String(prevEtg).trim().toLowerCase() === 'indefinido') return 'indefinido';
  const d = parseDataQualquer(prevEtg); // aceita Date, "dd/mm/aaaa" e ISO (linhas antigas)
  if (!d) return 'indefinido';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return d < hoje ? 'atraso' : 'noprazo';
}

/**
 * Situação de prazo considerando a ENTREGA: 'atraso' | 'indefinido' | 'noprazo'.
 * - Ainda não entregue: compara a previsão com hoje (regra de sempre).
 * - Já entregue (GFW, RTE ou WhatsApp) com data conhecida: compara a data da
 *   entrega com a previsão. Antes um pedido entregue DENTRO do prazo, mas que
 *   ainda constava em Pedidos Não Recebidos (cliente não confirmou o
 *   recebimento), passava a contar como "em atraso" assim que a previsão
 *   ficava pra trás — inflando o atraso e derrubando a performance.
 * - Entregue sem data conhecida: mantém a regra de sempre.
 * É a mesma regra que o site usa pra pintar a Previsão de vermelho.
 */
function situacaoPrazo(prevEtg, entregue, dataEntrega) {
  const status = statusPrevisao(prevEtg);
  if (status === 'indefinido' || !entregue || !dataEntrega) return status;
  return dataEntrega > parseDataQualquer(prevEtg) ? 'atraso' : 'noprazo';
}

/**
 * Indicadores do painel. A parte da Tabela Dinâmica (porStatus,
 * totalRecebidosCliente) não aparece no site — só é calculada quando pedida
 * (ação getIndicadores), o painel pula essa leitura de dezenas de milhares
 * de linhas.
 */
function getIndicadores(incluirTabDinamica) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tratativasSheet = ss.getSheetByName(TRATATIVAS_SHEET);

  const result = {
    tabDinamica: { totalPedidos: 0, porStatus: {}, totalRecebidosCliente: 0 },
    pedidosNaoRecebidos: { total: 0, totalEmAtraso: 0, totalIndefinidos: 0, totalEmRota: 0, totalEntregues: 0, percentualAtrasoGeral: 0, performanceGeral: 100, porTransportadora: {} },
    ocorrencias: { total: 0, porTransportadora: {} }
  };

  if (incluirTabDinamica) {
    const tabSheet = garantirTabDinamicaLookupSheet();
    if (tabSheet && tabSheet.getLastRow() > 1) {
      const numRows = tabSheet.getLastRow() - 1;
      const dados = tabSheet.getRange(2, 1, numRows, TAB_DINAMICA_LOOKUP_HEADERS.length).getValues();
      result.tabDinamica.totalPedidos = numRows;
      dados.forEach(r => {
        const status = r[1] || '(vazio)'; // StatusEntrega
        result.tabDinamica.porStatus[status] = (result.tabDinamica.porStatus[status] || 0) + 1;
        if (r[3]) result.tabDinamica.totalRecebidosCliente++; // RecebCliente
      });
    }
  }

  const pnr = result.pedidosNaoRecebidos;
  const porTransp = pnr.porTransportadora;
  getPedidosNaoRecebidosCalculados().forEach(p => {
    const emAtraso = p.situacao === 'atraso';
    const indefinido = p.situacao === 'indefinido';
    pnr.total += 1;
    if (emAtraso) pnr.totalEmAtraso += 1;
    if (indefinido) pnr.totalIndefinidos += 1;
    if (p.emRota) pnr.totalEmRota += 1;
    if (p.entregue) pnr.totalEntregues += 1;

    if (!porTransp[p.transportadora]) {
      porTransp[p.transportadora] = { qtd: 0, emAtraso: 0, indefinidos: 0, emRota: 0, entregues: 0 };
    }
    const t = porTransp[p.transportadora];
    t.qtd += 1;
    if (emAtraso) t.emAtraso += 1;
    if (indefinido) t.indefinidos += 1;
    if (p.emRota) t.emRota += 1;
    if (p.entregue) t.entregues += 1;
  });

  // Fecha os indicadores derivados (percentuais) por transportadora.
  // Indefinidos entram como "dentro do prazo" no cálculo de performance —
  // só contam separadamente na coluna própria.
  Object.keys(porTransp).forEach(nome => {
    const t = porTransp[nome];
    t.percentualAtraso = t.qtd > 0 ? (t.emAtraso / t.qtd) * 100 : 0;
    t.performance = 100 - t.percentualAtraso; // maior = melhor (menos atraso)
  });
  pnr.percentualAtrasoGeral = pnr.total > 0 ? (pnr.totalEmAtraso / pnr.total) * 100 : 0;
  pnr.performanceGeral = 100 - pnr.percentualAtrasoGeral;

  if (tratativasSheet && tratativasSheet.getLastRow() > 1) {
    const numRows = tratativasSheet.getLastRow() - 1;
    const transpCol = tratativasSheet.getRange(2, 4, numRows, 1).getValues() // Transportadora
      .filter(r => EXCLUDED_TRANSPORTADORAS.indexOf(String(r[0]).trim().toUpperCase()) === -1);

    result.ocorrencias.total = transpCol.length;
    transpCol.forEach(r => {
      const t = String(r[0] || '').trim() || SEM_TRANSPORTADORA;
      result.ocorrencias.porTransportadora[t] = (result.ocorrencias.porTransportadora[t] || 0) + 1;
    });
  }

  return result;
}


// =====================================================================
// DESEMPENHO — caches
// =====================================================================

const SEGUNDOS_CACHE_PAINEL = 600; // 10 min; qualquer importação/edição limpa antes disso
const CHAVE_GERACAO_CACHE = 'geracao_cache_v1';

/**
 * "Geração" dos caches derivados (painel, lista de pedidos, Em Rota). Toda
 * escrita troca a geração — as chaves antigas simplesmente deixam de ser
 * lidas, sem precisar apagar uma a uma. A data de hoje também entra na chave:
 * à meia-noite os atrasos e o "Em Rota de hoje" mudam sozinhos, então nada de
 * ontem pode ser servido do cache.
 */
function geracaoCache() {
  const cache = CacheService.getScriptCache();
  let g = cache.get(CHAVE_GERACAO_CACHE);
  if (!g) {
    g = String(Date.now());
    try { cache.put(CHAVE_GERACAO_CACHE, g, 21600); } catch (e) { /* ignora */ }
  }
  return g;
}

function chaveCacheDerivado(nome) {
  return nome + ':' + geracaoCache() + ':' + hojeFormatadoBR().replace(/\//g, '');
}

function invalidarCachePainel() {
  try { CacheService.getScriptCache().put(CHAVE_GERACAO_CACHE, String(Date.now()), 21600); } catch (e) { /* ignora */ }
}

// O CacheService aceita no máximo 100 KB por chave: valores maiores são
// divididos em pedaços (texto com acento pode ocupar até 3 bytes por letra,
// por isso pedaços de 30 mil caracteres). Acima de ~3 MB nem tenta guardar.
const TAMANHO_PEDACO_CACHE = 30000;
const MAX_PEDACOS_CACHE = 100;

function cachePutGrande(chave, valor, segundos) {
  try {
    const texto = JSON.stringify(valor);
    const n = Math.ceil(texto.length / TAMANHO_PEDACO_CACHE) || 1;
    if (n > MAX_PEDACOS_CACHE) return;
    const pares = {};
    for (let i = 0; i < n; i++) pares[chave + ':' + i] = texto.slice(i * TAMANHO_PEDACO_CACHE, (i + 1) * TAMANHO_PEDACO_CACHE);
    CacheService.getScriptCache().putAll(pares, segundos);
    CacheService.getScriptCache().put(chave + ':n', String(n), segundos); // por último: só "existe" com todos os pedaços gravados
  } catch (e) { /* sem cache, só fica um pouco mais lento */ }
}

function cacheGetGrande(chave) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get(chave + ':n'));
    if (!n) return null;
    const chaves = [];
    for (let i = 0; i < n; i++) chaves.push(chave + ':' + i);
    const pedacos = cache.getAll(chaves);
    let texto = '';
    for (let i = 0; i < n; i++) {
      const p = pedacos[chaves[i]];
      if (p === undefined || p === null) return null; // algum pedaço expirou: recalcula
      texto += p;
    }
    return JSON.parse(texto);
  } catch (e) {
    return null;
  }
}

/**
 * Indicadores + status das importações numa chamada só, guardados em cache.
 * Só é recalculado quando alguém importa/edita algo, na virada do dia ou
 * depois de 10 minutos.
 */
function getPainelComCache() {
  const chave = chaveCacheDerivado('painel');
  const guardado = cacheGetGrande(chave);
  if (guardado) { guardado.doCache = true; return guardado; }
  const painel = JSON.parse(JSON.stringify({ indicadores: getIndicadores(false), status: getStatus() }));
  cachePutGrande(chave, painel, SEGUNDOS_CACHE_PAINEL);
  painel.doCache = false;
  return painel;
}

/**
 * PROCV das Tratativas, só para os pedidos/NFs que estão no texto colado.
 */
function getProcvTratativasFiltrado(pedidos, nfs) {
  const resposta = { tabDinamica: {}, emRota: {}, ocorrenciasManuais: {}, urgentes: {} };
  const avisos = [];
  try {
    // Tipos de ocorrência ajustados à mão — só dos pedidos que estão no texto colado.
    const manuais = carregarOcorrenciasManuais();
    pedidos.forEach(p => {
      const m = manuais[normalizarChavePedido(p)];
      if (m) resposta.ocorrenciasManuais[String(p || '').trim()] = m;
    });
  } catch (e) { avisos.push('tipos de ocorrência ajustados: ' + e.message); }
  try {
    // Pedidos marcados como urgentes — só os que estão no texto colado.
    const urgentes = carregarUrgentes();
    pedidos.forEach(p => {
      const u = urgentes[normalizarChavePedido(p)];
      if (u) resposta.urgentes[String(p || '').trim()] = u;
    });
  } catch (e) { avisos.push('pedidos urgentes: ' + e.message); }
  try {
    const completo = getTabDinamicaLookupPorPedido();
    pedidos.forEach(p => {
      const chave = String(p || '').trim();
      if (chave && completo[chave]) resposta.tabDinamica[chave] = completo[chave];
    });
  } catch (e) { avisos.push('previsão/loja/vendedor: ' + e.message); }
  try {
    resposta.emRota = getEmRotaFiltrado(nfs);
  } catch (e) { avisos.push('Em Rota: ' + e.message); }
  if (avisos.length) resposta.avisos = avisos;
  return resposta;
}

function getEmRotaFiltrado(nfs) {
  const completo = getEmRotaGFWLookupParaFrontend();
  const filtrado = {};
  nfs.forEach(nf => {
    const chave = normalizarChaveNF(nf);
    if (chave && completo[chave]) filtrado[chave] = completo[chave];
  });
  return filtrado;
}


// =====================================================================
// TIPO DE OCORRÊNCIA AJUSTADO À MÃO
// =====================================================================

function normalizarChavePedido(p) {
  return String(p || '').trim().toUpperCase();
}

function getOcorrenciasManuaisSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(OCORRENCIAS_MANUAIS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(OCORRENCIAS_MANUAIS_SHEET);
    sheet.getRange(1, 1, 1, OCORRENCIAS_MANUAIS_HEADERS.length).setValues([OCORRENCIAS_MANUAIS_HEADERS]);
    // texto puro: o Sheets não deve "interpretar" número de pedido nem a data da edição
    sheet.getRange(1, 1, sheet.getMaxRows(), OCORRENCIAS_MANUAIS_HEADERS.length).setNumberFormat('@');
  }
  return sheet;
}

/**
 * Mapa { PEDIDO_EM_MAIUSCULAS: { tipo, original, por, em } } com os ajustes.
 * Fica em cache (10 min) e é limpo na hora quando alguém edita.
 * NÃO cria a aba na leitura.
 */
function carregarOcorrenciasManuais() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(CHAVE_CACHE_OCORRENCIAS);
  if (guardado) { try { return JSON.parse(guardado); } catch (e) { /* recalcula */ } }

  const mapa = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OCORRENCIAS_MANUAIS_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, OCORRENCIAS_MANUAIS_HEADERS.length).getValues().forEach(r => {
      const chave = normalizarChavePedido(r[0]);
      const tipo = String(r[1] || '').trim();
      if (!chave || !tipo) return;
      mapa[chave] = {
        tipo,
        original: String(r[2] || '').trim(),
        por: String(r[3] || '').trim(),
        em: r[4] instanceof Date ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(r[4] || '').trim()
      };
    });
  }
  try {
    const texto = JSON.stringify(mapa);
    if (texto.length < 90000) cache.put(CHAVE_CACHE_OCORRENCIAS, texto, 600);
  } catch (e) { /* sem cache, só fica um pouco mais lento */ }
  return mapa;
}

// Trava só entre edições de tipo (não usa a trava das importações, pra uma
// importação demorada não fazer a edição falhar).
function comTravaDeEdicao(fn) {
  let lock = null;
  try { lock = LockService.getDocumentLock(); } catch (e) { lock = null; }
  if (!lock) return fn();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function pedidoEstaNasTratativas(pedido) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRATATIVAS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return false;
  const chave = normalizarChavePedido(pedido);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().some(r => normalizarChavePedido(r[0]) === chave);
}

/**
 * Registra (ou troca) o tipo de ocorrência de um pedido. Guarda quem alterou,
 * quando, e o tipo ORIGINAL da primeira vez.
 */
function editarOcorrenciaPedido(data) {
  const pedido = String(data.pedido || '').trim();
  const tipo = String(data.tipo || '').trim();
  if (!pedido) return { ok: false, error: 'Informe o número do pedido.' };
  if (!tipo) return { ok: false, error: 'Escolha o tipo de ocorrência.' };
  if (pedido.length > 40 || tipo.length > 80) return { ok: false, error: 'Pedido ou tipo longo demais.' };

  const chave = normalizarChavePedido(pedido);
  const por = nomePorPin(data.pin);
  const tipoOriginalInformado = String(data.tipoOriginal || '').trim();
  const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');

  const resultado = comTravaDeEdicao(function () {
    const sheet = getOcorrenciasManuaisSheet();
    const ultima = sheet.getLastRow();
    let linhaExistente = 0, originalExistente = '';
    if (ultima > 1) {
      const dados = sheet.getRange(2, 1, ultima - 1, OCORRENCIAS_MANUAIS_HEADERS.length).getValues();
      for (let i = 0; i < dados.length; i++) {
        if (normalizarChavePedido(dados[i][0]) === chave) { linhaExistente = i + 2; originalExistente = String(dados[i][2] || '').trim(); break; }
      }
    }
    const original = originalExistente || tipoOriginalInformado;
    const linha = [chave, tipo, original, por || '', agora];
    sheet.getRange(linhaExistente || (ultima + 1), 1, 1, linha.length).setValues([linha]);
    return { original };
  });

  try { CacheService.getScriptCache().remove(CHAVE_CACHE_OCORRENCIAS); } catch (e) { /* ignora */ }
  return { ok: true, pedido: chave, tipo, original: resultado.original, por: por || '', em: agora, naTabelaAtual: pedidoEstaNasTratativas(pedido) };
}


// =====================================================================
// ENTREGAS INFORMADAS NO WHATSAPP
// =====================================================================

// "dd/MM/yyyy HH:mm" -> milissegundos (ou null se não for uma data/hora)
function timestampDataHoraBR(txt) {
  const m = String(txt || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
  return isNaN(d.getTime()) ? null : d.getTime();
}

function textoDataHoraCelula(v) {
  return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : String(v || '').trim();
}

/**
 * Importa as NFs lidas do WhatsApp pelo site: rows = [[nf, "dd/mm/aaaa hh:mm"], ...].
 * ACRESCENTA ao histórico: NF nova entra; NF que já existe fica com a data/hora MAIS ANTIGA.
 * Passou de 90 dias, sai. Devolve também quantas dessas NFs batem com Pedidos Não Recebidos.
 */
function importEntregasWhatsAppBatch(data) {
  return comTravaDeEdicao(function () { return importEntregasWhatsAppInterno(data); });
}

function importEntregasWhatsAppInterno(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ENTREGAS_WHATS_SHEET);
  if (!sheet) sheet = ss.insertSheet(ENTREGAS_WHATS_SHEET);

  const quando = {}; // chave da NF -> "dd/MM/yyyy HH:mm"
  const ordem = [];
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(r => {
      const chave = normalizarChaveNF(r[0]);
      if (chave && !Object.prototype.hasOwnProperty.call(quando, chave)) { quando[chave] = textoDataHoraCelula(r[1]); ordem.push(chave); }
    });
  }

  let novos = 0, jaConhecidas = 0;
  const chavesDoLote = {};
  (data.rows || []).forEach(r => {
    const chave = normalizarChaveNF(r[0]);
    const dh = String(r[1] || '').trim();
    if (!chave || timestampDataHoraBR(dh) === null || chavesDoLote[chave]) return;
    chavesDoLote[chave] = true;
    if (!Object.prototype.hasOwnProperty.call(quando, chave)) {
      quando[chave] = dh; ordem.push(chave); novos++;
    } else {
      jaConhecidas++;
      const atual = timestampDataHoraBR(quando[chave]);
      if (atual === null || timestampDataHoraBR(dh) < atual) quando[chave] = dh; // vale a primeira vez que apareceu
    }
  });

  // Poda: só guarda os últimos N dias (mantém a leitura rápida e a aba pequena).
  const limite = Date.now() - ENTREGAS_WHATS_DIAS_GUARDADOS * 86400000;
  const mantidas = ordem.filter(k => { const t = timestampDataHoraBR(quando[k]); return t === null || t >= limite; });

  // Reescreve tudo em texto puro (a aba é pequena); evita o Sheets "interpretar" NF e datas.
  sheet.clearContents();
  sheet.getRange(1, 1, 1, ENTREGAS_WHATS_HEADERS.length).setValues([ENTREGAS_WHATS_HEADERS]);
  if (mantidas.length > 0) {
    const linhas = mantidas.map(k => [k, quando[k]]);
    sheet.getRange(2, 1, linhas.length, 2).setNumberFormat('@');
    sheet.getRange(2, 1, linhas.length, 2).setValues(linhas);
  }

  // O "PROCV": quantas NFs deste lote estão em Pedidos Não Recebidos.
  let casaramPNR = 0;
  const pedSheet = ss.getSheetByName(PEDIDOS_NAO_RECEBIDOS_SHEET);
  if (pedSheet && pedSheet.getLastRow() > 1) {
    const nfsPNR = {};
    pedSheet.getRange(2, 7, pedSheet.getLastRow() - 1, 1).getValues().forEach(r => { const k = normalizarChaveNF(r[0]); if (k) nfsPNR[k] = true; });
    Object.keys(chavesDoLote).forEach(k => { if (nfsPNR[k]) casaramPNR++; });
  }

  if (data.isLast) setImportMeta(ENTREGAS_WHATS_SHEET, mantidas.length);
  return { ok: true, sheet: ENTREGAS_WHATS_SHEET, batchIndex: data.batchIndex, imported: (data.rows || []).length, novos, atualizados: jaConhecidas, casaramPNR, isLast: !!data.isLast };
}

// Índice NF -> "dd/MM/yyyy HH:mm" (quando o entregador postou a NF no WhatsApp).
function getEntregasWhatsLookupPorNF() {
  const lookup = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTREGAS_WHATS_SHEET);
  if (!sheet || sheet.getLastRow() <= 1) return lookup;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(r => {
    const chave = normalizarChaveNF(r[0]);
    if (chave) lookup[chave] = textoDataHoraCelula(r[1]);
  });
  return lookup;
}


// =====================================================================
// PEDIDOS URGENTES (caixinha na tabela de ocorrências)
// =====================================================================

function getUrgentesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(URGENTES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(URGENTES_SHEET);
    sheet.getRange(1, 1, 1, URGENTES_HEADERS.length).setValues([URGENTES_HEADERS]);
    sheet.getRange(1, 1, sheet.getMaxRows(), URGENTES_HEADERS.length).setNumberFormat('@'); // texto puro
  }
  return sheet;
}

/**
 * Mapa { PEDIDO_EM_MAIUSCULAS: { por, em } } dos pedidos urgentes. Fica em cache (10 min) e é
 * limpo na hora quando alguém marca/desmarca. NÃO cria a aba na leitura.
 */
function carregarUrgentes() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(CHAVE_CACHE_URGENTES);
  if (guardado) { try { return JSON.parse(guardado); } catch (e) { /* recalcula */ } }

  const mapa = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(URGENTES_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, URGENTES_HEADERS.length).getValues().forEach(r => {
      const chave = normalizarChavePedido(r[0]);
      if (chave) mapa[chave] = { por: String(r[1] || '').trim(), em: textoDataHoraCelula(r[2]) };
    });
  }
  try {
    const texto = JSON.stringify(mapa);
    if (texto.length < 90000) cache.put(CHAVE_CACHE_URGENTES, texto, 600);
  } catch (e) { /* sem cache, só fica um pouco mais lento */ }
  return mapa;
}

/**
 * Marca (urgente=true) ou desmarca (urgente=false) um pedido como URGENTE.
 */
function marcarUrgente(data) {
  const pedido = String(data.pedido || '').trim();
  if (!pedido) return { ok: false, error: 'Informe o número do pedido.' };
  if (pedido.length > 40) return { ok: false, error: 'Pedido longo demais.' };
  const marcar = data.urgente === true || data.urgente === 'true' || data.urgente === 1;

  const chave = normalizarChavePedido(pedido);
  const por = nomePorPin(data.pin);
  const agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');

  const resultado = comTravaDeEdicao(function () {
    const sheet = getUrgentesSheet();
    const ultima = sheet.getLastRow();
    const linhas = ultima > 1 ? sheet.getRange(2, 1, ultima - 1, URGENTES_HEADERS.length).getValues() : [];
    const pos = linhas.findIndex(r => normalizarChavePedido(r[0]) === chave);

    if (marcar) {
      if (pos !== -1) return { por: String(linhas[pos][1] || '').trim(), em: textoDataHoraCelula(linhas[pos][2]) }; // já estava marcado
      sheet.getRange(ultima + 1, 1, 1, URGENTES_HEADERS.length).setValues([[chave, por || '', agora]]);
      return { por: por || '', em: agora };
    }
    if (pos !== -1) {
      // Apaga só a linha desse pedido (antes reescrevia a aba inteira)
      sheet.deleteRow(pos + 2);
    }
    return { por: '', em: '' };
  });

  try { CacheService.getScriptCache().remove(CHAVE_CACHE_URGENTES); } catch (e) { /* ignora */ }
  return { ok: true, pedido: chave, urgente: marcar, por: resultado.por, em: resultado.em };
}
