import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailQueueService } from './email-queue.service';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(private readonly emailQueue: EmailQueueService) {}

  @Cron('*/10 * * * * *')
  async processarFila() {
    if (!this.emailQueue.temEmails()) return;

    const job = this.emailQueue.pegarProximo();
    if (!job) return;

    const email = job.email;

    const jsonFinal = {
      assunto: email.assunto,
      descricao: email.descricao,
      nome: email.cliente.nome,
      email: email.cliente.email,
      data: email.data || '',
      anexo_conteudo: email.anexos.map((a) => a.conteudo).join('\n\n'),
    };

    this.logger.log('=== EMAIL FINAL (antes da IA) ===');
    this.logger.log(JSON.stringify(jsonFinal, null, 2));
  }
}
