export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  attachments: Array<{
    filename: string;
    data: Buffer;
    contentType: string;
  }>;
  receivedAt: Date;
}

export interface EmailAnalysisResult {
  cliente: {
    email: string;
    nome: string;
    empresa?: string;
  };
  produto: {
    descricao: string;
    categoria: string;
    especificacoes?: string[];
  };
  quantidade: number;
  prazo: string;
  orcamento?: number;
  observacoes?: string;
  anexos: string[];
  prioridade: 'baixa' | 'media' | 'alta';
}

export interface EmailWebhookPayload {
  message: {
    data: string;
    messageId: string;
  };
  subscription: string;
}