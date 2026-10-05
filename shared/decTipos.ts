export const TIPOS_DESTINACAO_DEC = {
  redirecionada_ativo: "Direcionada/enviada a cliente ativo",
  encaminhada_time_interno: "Encaminhada ao time interno",
  arquivada_sem_acao: "Arquivada sem encaminhamento",
  arquivada_inativo: "Arquivada — cliente inativo",
} as const;

export type TipoDestinacaoDec = keyof typeof TIPOS_DESTINACAO_DEC;
