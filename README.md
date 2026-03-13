# consultar_cpf
Este projeto é um script em Node.js projetado para processar e validar grandes volumes de CPFs a partir de planilhas Excel (XLSX). Ele consome a API do Hub do Desenvolvedor para consultar a situação cadastral do CPF na Receita Federal e verifica se o nome informado na planilha bate com o nome registrado no governo.

🚀 Funcionalidades
Processamento em Lote: Lê listas de CPFs e Nomes de um arquivo Excel de entrada e automatiza a consulta.

Validação de Divergência: Normaliza e cruza o nome fornecido na planilha com o nome retornado pela API da Receita Federal, acusando divergências.

Sistema de Cache Inteligente: Lê o arquivo de saída gerado em execuções anteriores. Se um CPF já foi consultado e validado, ele não gasta o saldo da sua API novamente.

Salvamento Automático (Auto-Save): Salva o progresso no Excel a cada 10 consultas realizadas.

Resiliência (Graceful Shutdown): Caso você precise cancelar o script no meio do processo (Ctrl + C), ele intercepta o comando e salva o progresso feito até aquele milissegundo antes de fechar.

Log de Erros: Gera um arquivo .txt detalhado contendo CPFs vazios, erros de API e divergências de nomes, com registro de data e hora.

Controle de Rate Limit: Inclui um delay de ~1 segundo entre cada requisição para evitar bloqueios da API por excesso de chamadas.

📋 Pré-requisitos
Para rodar este script, você precisará ter instalado em sua máquina:

Node.js (Versão 14+ recomendada)

Uma conta ativa e com saldo no Hub do Desenvolvedor para gerar o Token da API.

⚙️ Instalação e Configuração
1. Clone o repositório ou baixe o script:

Bash
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO
2. Instale as dependências necessárias:
O projeto utiliza o axios para requisições HTTP e o xlsx para manipulação de planilhas.

Bash
npm install axios xlsx
3. Configure o Token da API:
Abra o arquivo consultar_cpf.js e insira o seu Token gerado no Hub do Desenvolvedor na constante TOKEN:

JavaScript
const TOKEN = 'SEU_TOKEN_AQUI'; 
📊 Estrutura do Arquivo de Entrada
Crie um arquivo Excel na raiz do projeto chamado candidaturas.xlsx (ou altere o nome na variável NOME_ARQUIVO_ENTRADA dentro do código).

A planilha deve conter cabeçalhos na primeira linha e seguir esta ordem de colunas:

Coluna A (Índice 0): Nome do indivíduo.

Coluna B (Índice 1): CPF (pode conter pontuação ou não, o script limpa automaticamente).

Exemplo:

NOME COMPLETO	CPF
João da Silva	123.456.789-00
Maria Oliveira	98765432100
▶️ Como Usar
Com a planilha de entrada pronta e as dependências instaladas, basta executar o script no terminal:

Bash
node consultar_cpf.js
O script irá gerar dois arquivos como resultado:

resultado_candidaturas.xlsx: Uma cópia da sua planilha original com 4 novas colunas:

STATUS_VALIDACAO: APROVADO, DIVERGENTE, DADOS FALTANTES ou ERRO API.

NOME_RECEITA: O nome oficial que retornou da consulta.

SITUACAO: Situação cadastral (Ex: REGULAR).

NASCIMENTO: Data de nascimento retornada pela Receita.

log_erros_validacao.txt: Um relatório de texto informando os motivos de falha de cada CPF que não passou na validação.

⚠️ Avisos Importantes
A API do Hub do Desenvolvedor é paga. Certifique-se de ter saldo suficiente para rodar a sua lista de entrada. O sistema de cache do script ajuda a economizar em reexecuções.

O script faz uma pausa de 1050ms entre cada requisição para obedecer aos limites de taxa (rate limits) do servidor. Listas muito grandes podem levar algum tempo para concluir.
