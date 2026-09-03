# Protocolo da extensão CND Federal

O protocolo usa mensagens versionadas pelo canal `mjp-cnd-v1`. O conteúdo da página não acessa diretamente as APIs privilegiadas do Chrome; um script isolado valida a origem antes de encaminhar o comando ao serviço da extensão.

| Direção | Mensagem | Conteúdo |
| --- | --- | --- |
| Portal → extensão | `CND_START` | `requestId` aleatório, `consultaId`, `clienteId`, CNPJ e origem. |
| Extensão → portal | `CND_PROGRESS` | Etapa atual, sem dados de autenticação. |
| Extensão → portal | `CND_NEEDS_HUMAN` | Orientação para hCaptcha visível. |
| Extensão → portal | `CND_NEEDS_ISSUANCE` | Ausência de segunda via válida; oferece nova emissão assistida. |
| Extensão → portal | `CND_COMPLETE` | PDF base64, nome, validade, resultado e mensagem. |
| Extensão → portal | `CND_UNAVAILABLE` / `CND_ERROR` | Falha classificada e mensagem capturada. |

O comando só é aceito quando parte de uma aba HTTPS do Portal Controller e da rota `/certidoes`. A automação da Receita só é executada no host oficial e no caminho `/servico/certidoes/`. O `requestId` funciona como nonce da operação e impede misturar respostas de consultas simultâneas. Cookies do Portal Controller e da Receita não são enviados nas mensagens.

O PDF retorna à página autenticada, que utiliza o backend existente para validar assinatura, limitar tamanho, armazenar no S3 e registrar o operador. A extensão não possui credenciais do banco nem permissão ampla para outros sites.
