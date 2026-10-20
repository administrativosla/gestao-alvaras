# Relatório de implantação — Gestor de Pendências de Contrato

## Visão geral

Foi implantado o **Gestor de Pendências** como uma terceira área independente no Portal Controller, ao lado do Gestor de Alvarás e do Quantificador DEC. O novo gestor possui painel, menu, rotas e permissões próprios, mas utiliza a mesma base central de clientes. Nenhum cliente foi criado automaticamente durante a carga.

## Carga inicial da planilha

Fonte: **Controle de Pendências CPS**, aba **Página1**.

| Indicador | Resultado |
|---|---:|
| Linhas processadas | 85 |
| Pendências vinculadas a clientes existentes | 81 |
| Contratos de prestação de serviço | 74 |
| Contratos de coworking | 7 |
| Exceções mantidas para decisão manual | 4 |
| Eventos de importação registrados no histórico | 81 |
| Registros de origem “ASSINADO” importados como “Assinado parcial” | 3 |

As quatro exceções não criaram cadastro de cliente. Elas permanecem disponíveis na fila de exceções para vínculo manual a um cliente existente ou exclusão com justificativa:

1. AGENCIA WORKFLOW LTDA — 36.143.913/0001-04;
2. GM CONSULTORIA E ASSESSORIA EM LOGISTICA E SUPPLY CHAIN LTDA SCP — 52.400.393/0001-24;
3. NATHALIA BLAGEVITCH PSICOLOGIA LTDA — 34.866.468/0001-85;
4. RA DE OLIVEIRA APERFEICOAMENTO PROFISSIONAL DIGITAL LTDA — 37.814.153/0001-82.

## Fases operacionais de abordagem

| Fase | Como deve ser usada | Registro obrigatório |
|---|---|---|
| **Sem contato** | Pendência nova, sem tentativa de comunicação registrada. | Não exige justificativa inicial de importação. |
| **Cliente contatado** | Primeiro contato realizado e aguarda retorno. | Justificativa manual obrigatória; inicia prazo automático de 48 horas. |
| **Contato sem retorno** | Cliente não respondeu dentro de 48 horas. | O sistema altera automaticamente quando o prazo vence e registra o evento de sistema; também pode ser alterado manualmente com justificativa. |
| **Fase de ajustes** | Há condições comerciais, documentais ou contratuais a resolver. | Justificativa obrigatória descrevendo o ajuste. |
| **Aprovação de minuta** | Minuta enviada ou sob validação do cliente. | Justificativa obrigatória. |
| **Links enviados** | Links de assinatura disponibilizados aos signatários. | Justificativa obrigatória, incluindo informações relevantes de envio. |
| **Assinado parcial** | Há assinatura, mas ainda faltam signatários, etapas ou validação final. | Justificativa obrigatória. É o status inicial dos registros que a planilha trazia como “ASSINADO”. |
| **Assinado total** | Todos os requisitos e assinaturas foram concluídos. | Justificativa obrigatória de encerramento. |

Não há travas de direção entre fases: o operador pode corrigir ou retroceder um status quando necessário, mas toda mudança manual exige justificativa e fica registrada na linha do tempo com usuário, data/hora, status anterior e novo status.

## Regras de importação e reimportação

- A conciliação é obrigatória por **CNPJ** e não utiliza somente razão social.
- Um cliente pode possuir uma pendência de prestação de serviço e outra de coworking ao mesmo tempo.
- A reimportação atualiza apenas a referência da planilha (descrição, arquivo e linha de origem) e preserva o andamento atual e o histórico das abordagens já feitas no portal.
- Linhas sem cliente correspondente seguem na fila de exceções, sem criar clientes automaticamente.
- Na tela de prévia, gestor e master podem ajustar tipo, status inicial e inclusão antes da confirmação.

## Permissões

O módulo **Pendências de contrato** foi incluído na matriz de permissões existente:

| Ação | Operador | Gestor | Master |
|---|---|---|---|
| Visualizar painel, lista e histórico | Permitido | Permitido | Fixo e permitido |
| Atualizar status com justificativa | Permitido | Permitido | Fixo e permitido |
| Importar planilha | Não permitido por padrão | Permitido | Fixo e permitido |
| Vincular ou excluir exceções | Não permitido por padrão | Permitido | Fixo e permitido |

As permissões de Operador e Gestor seguem editáveis pela matriz já existente; novos usuários herdam automaticamente a configuração do seu perfil.

## Automação de 48 horas

O endpoint seguro e idempotente de transição automática já foi implementado. Ele move somente registros que ainda estejam em **Cliente contatado** depois do prazo de 48 horas, registrando o histórico como evento automático sem exigir justificativa manual.

Por segurança da infraestrutura, o agendamento de produção deve ser criado **após a publicação da nova versão**. A recomendação é uma execução horária do endpoint de pendências, suficiente para aplicar a regra de 48 horas sem depender de interação manual.

## Validação técnica

- Migração não destrutiva aplicada para pendências, histórico e exceções.
- Painel, lista, importação e exceções verificados visualmente.
- A separação do terceiro gestor no Portal Controller foi verificada visualmente.
- `pnpm check` e a suíte de testes foram executados após a implantação.
