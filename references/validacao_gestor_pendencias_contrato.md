# Validação prévia — Gestor de Pendências de Contrato

## Fonte analisada

- **Planilha Google:** Controle de Pendências CPS
- **Aba:** Página1
- **Colunas:** Nome, Cliente, CNPJ/CPF, STATUS
- **Linhas com dados:** 85

## Qualidade e conciliação

| Indicador | Resultado |
|---|---:|
| CNPJs válidos | 85 |
| Pendências conciliadas com clientes existentes | 81 |
| Pendências sem cliente correspondente no portal | 4 |
| Clientes com duas pendências deliberadas | 1 |
| Pendências de prestação de serviço | 77 |
| Pendências de coworking | 8 |

Os quatro CNPJs sem correspondente permanecerão em uma lista de exceções de importação e não criarão clientes automaticamente:

1. AGENCIA WORKFLOW LTDA — 36.143.913/0001-04
2. GM CONSULTORIA E ASSESSORIA EM LOGISTICA E SUPPLY CHAIN LTDA SCP — 52.400.393/0001-24
3. NATHALIA BLAGEVITCH PSICOLOGIA LTDA — 34.866.468/0001-85
4. RA DE OLIVEIRA APERFEICOAMENTO PROFISSIONAL DIGITAL LTDA — 37.814.153/0001-82

O único CNPJ duplicado na fonte pertence ao mesmo cliente, mas em duas categorias diferentes — prestação de serviço e coworking. Ele será importado como duas pendências independentes, o comportamento esperado.

## Classificação de contrato

A importação classificará automaticamente a coluna **Nome**:

- Texto com “Coworking” ou “Endereço fiscal” → **Contrato de coworking**.
- Texto com “Regularização”, “Prestação” ou “Contrato” → **Contrato de prestação de serviço**.

A classificação poderá ser corrigida manualmente na tela antes da confirmação da importação.

## Status oficiais do módulo

1. **Sem contato**
2. **Cliente contatado**
3. **Contato sem retorno**
4. **Fase de ajustes**
5. **Aprovação de minuta**
6. **Links enviados**
7. **Assinado parcial**
8. **Assinado total**

## Mapeamento dos status já existentes na planilha

| Status de origem | Registros | Status inicial sugerido | Observação de histórico |
|---|---:|---|---|
| Em branco | 72 | Sem contato | Importação inicial sem andamento informado. |
| CONTATO SEM RETORNO | 6 | Contato sem retorno | Status preservado. |
| LINK ENVIADO - AINDA SEM RETORNO | 1 | Links enviados | Texto original preservado como justificativa. |
| CLIENTE CONDICIONOU ASSINATURA A ENTREGAS | 2 | Fase de ajustes | Texto original preservado como justificativa. |
| AGUARDANDO REVISÃO | 1 | Fase de ajustes | Texto original preservado como justificativa. |
| ASSINADO | 3 | Assinado parcial | Decisão aprovada: manter como parcial até validação manual. |

> Decisão aprovada: os três registros marcados como **ASSINADO** serão importados como **Assinado parcial** até uma validação manual confirmar a conclusão integral.

## Componentes a implantar

### Área independente no Portal Controller

O Gestor de Pendências será uma terceira área independente, ao lado do Gestor de Alvarás e do Quantificador DEC. Terá tela inicial, navegação lateral, painel e permissões próprios, mas utilizará a mesma tabela central de clientes. Assim, qualquer atualização de contato ou cadastro do cliente será comum aos três módulos, enquanto pendências, históricos e exceções permanecerão isolados no novo gestor.

### Dados e histórico

- Tabela de pendências vinculada ao cliente, com tipo de contrato, status, descrição de origem, prazo de retorno de 48 horas e dados de importação.
- Tabela de histórico imutável contendo status anterior, status novo, justificativa, usuário, data/hora e indicação de mudança automática.
- Regra de uma pendência por cliente e por tipo de contrato, permitindo que o mesmo cliente tenha simultaneamente uma pendência de prestação de serviço e outra de coworking.

### Atualização de status

- Toda alteração manual abre uma janela com **justificativa obrigatória**.
- Ao definir **Cliente contatado**, o sistema grava a data/hora e agenda o vencimento de 48 horas.
- Uma rotina interna executada periodicamente muda apenas os registros que ainda estiverem em **Cliente contatado** para **Contato sem retorno** após 48 horas.
- A mudança automática registra um evento de sistema no histórico e dispensa justificativa manual.
- Mudanças manuais continuam possíveis entre os status para permitir correções e retornos de etapa, sempre com justificativa.

### Importação

- Tela de importação com prévia, classificação automática, contagem por tipo e revisão antes de salvar.
- Conciliação obrigatória por CNPJ.
- Registros não encontrados, CNPJ inválido e conflitos permanecem em relatório de exceções; não haverá criação automática de cliente.
- Reimportações atualizam a pendência correspondente sem apagar o histórico de abordagens já realizado no portal.

### Painel operacional

- Indicadores: pendências abertas, sem contato, contatos aguardando 48 horas, sem retorno, links enviados, assinaturas parciais e totais.
- Distribuição por tipo de contrato e por status.
- Lista priorizada por prazo, com filtros por tipo, status, cliente e busca por CNPJ/razão social.
- Linha do tempo de abordagens em cada pendência.

### Permissões

Será criado o módulo de permissão **Pendências de contrato**, com ações separadas para visualizar, importar, atualizar status e gerenciar configurações. A proteção será aplicada tanto no backend quanto na interface, aproveitando a matriz de perfis já existente.

## Integração futura com Google Sheets

A planilha está acessível pelo Google Workspace. Nesta primeira implantação, ela será usada como importação controlada. A sincronização recorrente será uma etapa posterior, reutilizando a mesma conciliação por CNPJ e sem substituir justificativas ou históricos internos.
