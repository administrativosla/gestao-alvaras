# Auditoria do fluxo da CND Federal

**Data da verificação:** 3 de setembro de 2026  
**Fonte:** Receita Federal do Brasil

## Fluxos apresentados pelo portal

Na página de pessoa jurídica, o portal oficial informa que permite **emitir novas certidões** ou **consultar certidões emitidas a partir de 01/09/2005 e emitir segunda via**. A tela solicita o CNPJ e oferece dois comandos separados: `Consultar Certidão` e `Emitir Certidão`.[1]

Esta separação confirma que o conector-piloto deve tentar primeiro a consulta do histórico. A presença ou ausência de CAPTCHA nesse caminho será registrada após submissão controlada de um CNPJ autorizado. A emissão nova permanecerá como fluxo assistido quando o hCaptcha for apresentado.

## Teste controlado da consulta

Após informar um CNPJ já cadastrado e acionar **Consultar Certidão**, a página processou a solicitação sem exigir uma interação humana visível no desafio. O retorno foi uma mensagem técnica temporária — código `105`, solicitando nova tentativa em alguns minutos — e não uma lista de documentos. Portanto, foi possível confirmar que o botão de consulta envia a solicitação sem um CAPTCHA visual obrigatório naquele momento, mas ainda não foi possível validar a recuperação bem-sucedida de uma segunda via.

A aplicação carrega dois componentes de hCaptcha, incluindo uma configuração invisível. Isso significa que a consulta pode depender de validação automática de risco mesmo quando o operador não recebe um desafio visual. O piloto deverá tratar três estados distintos: **consulta automática concluída**, **consulta bloqueada por desafio** e **indisponibilidade temporária da Receita**.

As métricas padrão do navegador não expuseram a chamada específica da consulta após o retorno de erro. Foi preparada uma observação temporária da próxima tentativa para registrar somente método, URL e nomes dos campos enviados, sem armazenar o CNPJ ou qualquer token.

A repetição controlada não produziu chamada `XMLHttpRequest` observável, indicando que o fluxo pode usar `fetch`, serviço intermediário ou execução encapsulada pelo componente antirobô. Isso não altera a conclusão funcional: a consulta foi iniciada sem resolução manual, mas o sucesso da recuperação automática dependerá da avaliação de risco feita pelo hCaptcha invisível e da disponibilidade momentânea do serviço.

## Confirmação técnica do fluxo de segunda via

A análise dos módulos JavaScript públicos da aplicação confirmou que o botão **Consultar Certidão** também executa o hCaptcha, embora normalmente de forma invisível. O componente chama `executeCaptcha()` e envia o token no cabeçalho `X-Captcha-Token` para `POST /api/consulta/validar-contribuinte`. Portanto, a ausência de um desafio visual não significa ausência de validação antirobô.

Após a validação, o serviço devolve um `idConsulta`. A aplicação envia CNPJ, tipo `PJ`, intervalo, tipo de pesquisa e esse identificador para `POST /api/consulta`. Quando existe segunda via, o PDF em base64 é obtido por `GET /api/consulta/seg-via/{idCertidao}`. Esse mapeamento confirma que a recuperação pode ser automatizada dentro de um navegador legítimo, mas não por uma chamada direta do servidor sem o token do hCaptcha e os cookies da sessão.

| Abordagem | Experiência | Limitações | Custo relativo | Complexidade |
| --- | --- | --- | --- | --- |
| Extensão controlada no Chrome do operador | Um clique no Portal Controller; o navegador preenche, consulta e devolve o PDF. Se surgir desafio visual, o operador resolve somente o hCaptcha. | Requer instalação inicial em cada computador autorizado e navegador aberto durante a consulta. | Baixo | Média |
| Navegador dedicado em infraestrutura de automação | O Portal Controller envia a tarefa para um executor remoto, sem instalação local. | IP de datacenter e automação aumentam a chance de desafio; a intervenção humana exige sessão remota segura. Também demanda mais memória que o processo web atual. | Médio/alto e recorrente | Alta |
| Fluxo assistido atual | O sistema registra operador, copia o CNPJ e abre a Receita; o operador conclui a página e anexa o retorno. | Ainda exige copiar/colar e registrar o resultado manualmente. | Baixo | Baixa |

Para produção, o executor não poderá depender de conectores pessoais do Manus. A escolha entre extensão local e navegador dedicado altera infraestrutura, distribuição e suporte; por isso deve ser confirmada antes da implementação definitiva de um clique.

## Referências

[1]: https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj "Receita Federal — Certidão de Pessoa Jurídica"
