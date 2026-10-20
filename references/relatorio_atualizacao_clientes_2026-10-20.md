# Relatório de Atualização da Base de Clientes

- **Data da execução:** 20/10/2026, 01:53 (America/Sao_Paulo)
- **Arquivo de origem:** `CONTATOSDECLIENTESATIVOSMJPCONTROLLER2025.xlsx`
- **Aba processada:** `Ativos - MJP`
- **Modo:** Aplicação definitiva, validada em transação

## Resumo executivo

A base de clientes do Portal Controller foi atualizada com sucesso a partir da planilha enviada. A conciliação foi realizada exclusivamente por CNPJ válido; a operação não excluiu clientes e não alterou dados de alvarás, CLIs, PDFs, validações, endereço fiscal ou a marcação manual **Sem Registro**.

| Indicador | Quantidade |
|---|---:|
| Clientes antes da atualização | 442 |
| Clientes após a atualização | 541 |
| Linhas preenchidas na planilha | 560 |
| CNPJs únicos e válidos aplicados | 530 |
| Clientes existentes conciliados por CNPJ | 431 |
| Novos clientes válidos criados | 99 |
| Clientes existentes fora da planilha, mantidos sem alteração | 11 |
| Registros comerciais vinculados à planilha | 530 |
| CNPJs inválidos não aplicados | 2 |
| CNPJs duplicados/conflitantes não aplicados | 13 |
| E-mails principais em formato não aceito no cadastro principal | 8 |

## Dados atualizados

### Cadastro principal do portal

Foram preenchidos ou atualizados, quando disponíveis e válidos na planilha:

- razão social;
- nome do contato principal;
- telefone principal identificado na coluna **Telefone/WhatsApp - 1**;
- e-mail principal válido.

Após a atualização, a base ficou com **529 clientes com contato**, **507 com telefone** e **515 com e-mail principal válido**.

Os oito e-mails com múltiplos endereços na mesma célula ou formato inválido não foram gravados no campo principal do cadastro — para evitar um e-mail inválido no portal — mas foram preservados na referência comercial da planilha.

### Dados comerciais complementares

Foi criada a estrutura `cliente_dados_comerciais`, com uma fotografia vigente da fonte para cada cliente conciliado. Ela preserva, sem interferir nos dados fiscais e operacionais do portal:

- grupo;
- classificação;
- situação na base;
- situação no Onvio;
- contatos e e-mails primário e secundário como informados na planilha;
- serviços utilizados;
- nome do arquivo, linha de origem e data de atualização.

Isso torna a futura sincronização recorrente possível sem misturar atributos comerciais com informações da Receita Federal, alvarás ou configurações internas do cliente.

## Indicadores da fonte comercial

| Situação na base | Clientes |
|---|---:|
| Ativo | 422 |
| Inativo | 108 |

| Situação no Onvio | Clientes |
|---|---:|
| Ativo | 392 |
| Inativo | 106 |
| Não utiliza | 32 |

> As situações da planilha foram registradas como informação comercial de origem. Elas **não** alteraram o campo operacional `ativo` do Portal Controller, evitando ocultar ou desativar clientes automaticamente por uma divergência de conceito entre sistemas.

## Critérios de segurança aplicados

1. **Conciliação por CNPJ:** nenhuma associação foi feita somente por razão social ou nome fantasia.
2. **Sem exclusão ou inativação automática:** clientes ausentes da planilha permaneceram na base.
3. **Proteção contra fonte ambígua:** CNPJs inválidos e repetidos foram deliberadamente ignorados.
4. **Preservação de dados críticos:** nenhum dado fiscal, de endereço, alvará, CLI, PDF, validação ou negociação foi removido ou substituído.
5. **Execução idempotente:** uma nova prévia após a aplicação retornou **0 criações**, **0 atualizações** e **530 registros sem alteração**.

## Exceções que exigem revisão da planilha

Foram isoladas **23 ocorrências**: dois CNPJs inválidos, treze grupos de CNPJ repetido (onze conflitantes e dois idênticos) e oito e-mails principais que contêm mais de um endereço ou não possuem formato válido para o campo principal. Nenhuma dessas ocorrências foi aplicada ao cadastro principal por segurança.

O detalhamento por linha, CNPJ, empresa e motivo está disponível no arquivo complementar de exceções.

## Validações técnicas

- Migração não destrutiva aplicada para `cliente_dados_comerciais`.
- `pnpm check` concluído sem erros.
- Suite de testes concluída: **16 arquivos e 96 testes aprovados**.
- Servidor de desenvolvimento permanece em execução.
