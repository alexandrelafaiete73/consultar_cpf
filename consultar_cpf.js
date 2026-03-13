const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// ================= CONFIGURAÇÕES =================
const TOKEN = '201078895KLPBJYhcyg363041848'; // TOKEN GERADO PELO HUBDODESENVOLVEDOR
const NOME_ARQUIVO_ENTRADA = 'candidaturas.xlsx'; // ARQUIVO EXCEL CONTENDO CPF PARA LEITURA EM LOTE
const NOME_ARQUIVO_SAIDA = 'resultado_candidaturas.xlsx';
const NOME_ARQUIVO_LOG = 'log_erros_validacao.txt';

const DIRETORIO_ATUAL = process.cwd();
const CAMINHO_ENTRADA = path.join(DIRETORIO_ATUAL, NOME_ARQUIVO_ENTRADA);
const CAMINHO_SAIDA = path.join(DIRETORIO_ATUAL, NOME_ARQUIVO_SAIDA);
const CAMINHO_LOG = path.join(DIRETORIO_ATUAL, NOME_ARQUIVO_LOG);
// =================================================

let resultadosFinais = [];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizarNome(nome) {
    if (!nome) return '';
    return String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

// Função para anotar os erros em um arquivo de texto
function registrarErroLog(cpf, nome, mensagem) {
    const dataHora = new Date().toLocaleString('pt-BR');
    const linhaLog = `[${dataHora}] CPF: ${cpf || 'Vazio'} | NOME: ${nome || 'Vazio'} | ERRO: ${mensagem}\n`;
    fs.appendFileSync(CAMINHO_LOG, linhaLog, 'utf8');
}

function salvarArquivo(dados) {
    try {
        const novaAba = xlsx.utils.aoa_to_sheet(dados);
        const novoWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(novoWorkbook, novaAba, 'Resultado');
        xlsx.writeFile(novoWorkbook, CAMINHO_SAIDA);
        return true;
    } catch (err) {
        console.error('\nErro ao salvar arquivo Excel:', err.message);
        return false;
    }
}

// Captura o ^C (Control+C) para salvar o progresso antes de sair
process.on('SIGINT', () => {
    console.log('\n\nAbortando... Salvando progresso no Excel antes de fechar...');
    salvarArquivo(resultadosFinais);
    process.exit();
});

async function consultarCpfHub(cpf) {
    const url = `http://ws.hubdodesenvolvedor.com.br/v2/cpf/?cpf=${cpf}&token=${TOKEN}`;
    const response = await axios.get(url);
    if (response.data.return !== "OK") throw new Error(response.data.message || response.data.return || "Erro API");
    return response.data.result; 
}

async function processarExcel() {
    if (!fs.existsSync(CAMINHO_ENTRADA)) {
        console.error(`Erro: Arquivo ${NOME_ARQUIVO_ENTRADA} não encontrado.`);
        return;
    }

    // --- PASSO 1: CARREGAR CACHE DE CONSULTAS ANTERIORES ---
    let cacheConsultas = new Map();
    if (fs.existsSync(CAMINHO_SAIDA)) {
        console.log('--- LENDO DADOS JÁ PROCESSADOS PARA POUPAR SALDO ---');
        try {
            const outWb = xlsx.readFile(CAMINHO_SAIDA);
            const outWs = outWb.Sheets[outWb.SheetNames[0]];
            const linhasAnteriores = xlsx.utils.sheet_to_json(outWs, { header: 1 });
            const cabecalhoOut = linhasAnteriores[0] || [];
            
            const idxStatus = cabecalhoOut.indexOf('STATUS_VALIDACAO');
            const idxNome = cabecalhoOut.indexOf('NOME_RECEITA');
            const idxSit = cabecalhoOut.indexOf('SITUACAO');
            const idxNasc = cabecalhoOut.indexOf('NASCIMENTO');

            if (idxStatus > -1) {
                for (let i = 1; i < linhasAnteriores.length; i++) {
                    const row = linhasAnteriores[i];
                    const cpfAnterior = String(row[1] || '').replace(/[^\d]/g, ''); // Coluna B
                    const status = row[idxStatus];
                    
                    // Guarda na memória se já foi aprovado ou se já provamos que é divergente
                    if (cpfAnterior && status && (status.includes('APROVADO') || status.includes('DIVERGENTE'))) {
                        cacheConsultas.set(cpfAnterior, { 
                            status: status, 
                            nome: row[idxNome] || '', 
                            situacao: row[idxSit] || '', 
                            nasc: row[idxNasc] || '' 
                        });
                    }
                }
            }
            console.log(`Encontrados ${cacheConsultas.size} CPFs já validados. Eles serão ignorados na API.\n`);
        } catch (e) {
            console.log('Arquivo de resultado anterior não pôde ser lido. Iniciando do zero.\n');
        }
    }

    // --- PASSO 2: LER ARQUIVO PRINCIPAL ---
    console.log('--- INICIANDO PROCESSAMENTO DA LISTA ---');
    const workbook = xlsx.readFile(CAMINHO_ENTRADA);
    const linhas = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    
    const cabecalhoOriginal = linhas[0] || [];
    const dadosParaProcessar = linhas.slice(1);
    
    resultadosFinais = [[...cabecalhoOriginal, 'STATUS_VALIDACAO', 'NOME_RECEITA', 'SITUACAO', 'NASCIMENTO']];

    let consultasRealizadas = 0;
    let aproveitadosDoCache = 0;

    for (let i = 0; i < dadosParaProcessar.length; i++) {
        let linhaAtual = dadosParaProcessar[i];
        if (!linhaAtual[0] && !linhaAtual[1]) continue; // Pula linha totalmente vazia

        const nomeInformado = linhaAtual[0]; 
        const cpfLimpo = String(linhaAtual[1] || '').replace(/[^\d]/g, '');

        if (!cpfLimpo || cpfLimpo.length < 11 || !nomeInformado) {
            linhaAtual.push('DADOS FALTANTES', '', '', '');
            registrarErroLog(cpfLimpo, nomeInformado, "Dados incompletos ou CPF fora do padrão");
            resultadosFinais.push(linhaAtual);
            continue;
        }

        // Verifica se o CPF já está no nosso Cache (Arquivo anterior)
        if (cacheConsultas.has(cpfLimpo)) {
            const dadosSalvos = cacheConsultas.get(cpfLimpo);
            linhaAtual.push(dadosSalvos.status, dadosSalvos.nome, dadosSalvos.situacao, dadosSalvos.nasc);
            console.log(`[${i+1}/${dadosParaProcessar.length}] CPF ${cpfLimpo}: Puxado do cache (${dadosSalvos.status})`);
            aproveitadosDoCache++;
            resultadosFinais.push(linhaAtual);
            continue; // PULA a chamada da API
        }

        // Se não está no cache, faz a consulta real
        try {
            const result = await consultarCpfHub(cpfLimpo);
            const isValido = normalizarNome(result.nome_da_pf) === normalizarNome(nomeInformado);
            
            linhaAtual.push(isValido ? 'APROVADO' : 'DIVERGENTE', result.nome_da_pf, result.situacao_cadastral, result.data_nascimento);
            console.log(`[${i+1}/${dadosParaProcessar.length}] CPF ${cpfLimpo}: ${isValido ? 'Validado' : 'Divergente'}`);
            
            if (!isValido) {
                registrarErroLog(cpfLimpo, nomeInformado, `Nome divergente. Esperado: ${result.nome_da_pf}`);
            }
            consultasRealizadas++;
        } catch (error) {
            linhaAtual.push('ERRO API', '', error.message, '');
            console.log(`[${i+1}] Erro no CPF ${cpfLimpo}: ${error.message}`);
            registrarErroLog(cpfLimpo, nomeInformado, `Erro API: ${error.message}`);
        }

        resultadosFinais.push(linhaAtual);

        // AUTO-SAVE a cada 10 consultas feitas (não conta os do cache)
        if (consultasRealizadas > 0 && consultasRealizadas % 10 === 0) {
            salvarArquivo(resultadosFinais);
            console.log('Progresso salvo no Excel...');
        }

        await delay(1050); 
    }

    if(salvarArquivo(resultadosFinais)) {
        console.log(`\nPROCESSO FINALIZADO!`);
        console.log(`Novas Consultas Realizadas: ${consultasRealizadas}`);
        console.log(`Ignorados (Puxados do Cache): ${aproveitadosDoCache}`);
        console.log(`Excel salvo em: ${CAMINHO_SAIDA}`);
        console.log(`Log de erros salvo em: ${CAMINHO_LOG}`);
    }
}

processarExcel();