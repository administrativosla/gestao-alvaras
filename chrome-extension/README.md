# Extensão MJP Controller — CND Federal

Esta extensão Manifest V3 executa a consulta da CND Federal no Chrome do operador. Ela só atua no Portal Controller hospedado em `manus.space`/`manus.computer` e no domínio oficial `servicos.receitafederal.gov.br`.

O Portal Controller envia um comando com identificador aleatório da tentativa, ID da consulta, CNPJ e origem. A extensão preenche o CNPJ, aciona a consulta anterior e acompanha as respostas da própria aplicação da Receita. Quando encontra uma certidão válida com segunda via, recupera o PDF e o devolve à página autenticada do Portal Controller, que faz o upload e grava o operador.

Se o hCaptcha exibir um desafio, a extensão pausa e orienta o operador. Ela não resolve, terceiriza nem contorna CAPTCHA.

## Instalação local

Extraia o ZIP para uma pasta permanente. No Chrome, abra `chrome://extensions`, ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta extraída. Abra o Gestor de Certidões, clique no ícone da extensão e selecione **Vincular ao Portal Controller aberto**. A página será recarregada e exibirá o indicador **Conectada**.
