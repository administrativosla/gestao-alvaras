# Modelo de histórico de certidões

O Gestor de Certidões utiliza o mesmo `clienteId` do Gestor de Alvarás. Não existe sincronização por cópia: ambos acessam o cadastro empresarial mestre.

| Registro | Finalidade | Regra de auditoria |
| --- | --- | --- |
| `certidao_consultas` | Registra cada tentativa em uma fonte oficial. | Uma nova tentativa sempre cria uma nova linha; resultado anterior nunca é sobrescrito. |
| `certidao_versoes` | Preserva PDF, imagem ou texto captado em uma consulta. | A versão é sequencial dentro da consulta e possui operador, horário, hash e validade. |

Cada consulta guarda **empresa**, **fonte**, **origem**, **status**, **resultado**, **operador de início**, **operador de conclusão**, **data e hora**, **mensagem capturada** e **URL oficial**. A origem diferencia a recuperação de certidão já emitida da nova emissão assistida.

Os arquivos permanecem no armazenamento S3 do projeto. O banco guarda somente `fileKey`, `fileUrl`, nome, tipo MIME, tamanho e hash SHA-256. Esse desenho permite verificar se duas versões possuem o mesmo conteúdo sem eliminar o histórico.

O fluxo da Receita começa com `consulta_anterior`. Se não houver certidão válida recuperável, o registro passa para `aguardando_emissao`, e o operador inicia `nova_emissao_assistida`. hCaptcha ou autenticação nunca serão contornados automaticamente.
