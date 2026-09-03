# Instalação da extensão CND Federal

O Portal Controller disponibiliza o pacote `mjp-controller-cnd-federal-extension-v0.3.0.zip` no próprio painel da CND Federal. A instalação é feita uma única vez em cada computador autorizado.

| Etapa | Ação |
| --- | --- |
| 1 | No Gestor de Certidões, clique em **Baixar extensão do Chrome**. |
| 2 | Extraia o conteúdo do ZIP para uma pasta permanente do computador. |
| 3 | Abra `chrome://extensions` no Chrome. |
| 4 | Ative **Modo do desenvolvedor**. |
| 5 | Clique em **Carregar sem compactação** e escolha a pasta extraída. |
| 6 | Abra o Gestor de Certidões, clique no ícone da extensão e escolha **Vincular ao Portal Controller aberto**. |
| 7 | A página será recarregada e o indicador deverá mudar de **Modo assistido** para **Conectada**. |

Depois da instalação, o operador seleciona a empresa e clica em **Consultar automaticamente**. A extensão aceita comandos somente da origem exata vinculada pelo próprio operador e atua apenas no portal oficial de certidões da Receita Federal. Ela não armazena senhas, não recebe credenciais do banco e não contorna hCaptcha.

Quando o hCaptcha invisível for aceito, o fluxo prossegue sem intervenção. Caso a Receita apresente um desafio visual, o operador deverá resolvê-lo na aba oficial; a automação continua em seguida. Se não houver segunda via válida, o sistema abre a etapa de nova emissão assistida.

O Chrome para dispositivos móveis não aceita essa instalação. Em celular, o Portal Controller permanece disponível para consulta do histórico e operação assistida; a execução automática deve ser iniciada em um Chrome para computador.
