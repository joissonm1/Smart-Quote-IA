import { Injectable, Logger } from '@nestjs/common';

interface EmailJob {
  email: any;
}

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);
  private fila: EmailJob[] = [];

  adicionarEmail(email: any) {
    this.fila.push({ email });

    this.fila.sort((a, b) => {
      const dataA = new Date(a.email.data).getTime();
      const dataB = new Date(b.email.data).getTime();
      return dataA - dataB;
    });

    this.logger.log(`Email enfileirado: ${email.assunto} (${email.data})`);
  }

  pegarProximo(): EmailJob | null {
    return this.fila.shift() || null;
  }

  temEmails(): boolean {
    return this.fila.length > 0;
  }
}
