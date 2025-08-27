import { Injectable, Logger } from '@nestjs/common';
import { EmailJob } from '../interface/email.interface';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);
  private queue: EmailJob[] = [];

  addEmail(email: any) {
    const job: EmailJob = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      email,
      processado: false,
    };

    this.queue.push(job);
    this.queue.sort((a, b) => {
      const dataA = new Date(a.email.data || Date.now()).getTime();
      const dataB = new Date(b.email.data || Date.now()).getTime();
      return dataA - dataB;
    });

    this.logger.log(
      `Email enfileirado: ${email.assunto || '(sem assunto)'} (${email.data || 's/data'})`,
    );
  }

  catchNext(): EmailJob | null {
    return this.queue[0] || null;
  }

  MarkAsProcessed(id: string) {
    const job = this.queue.find((j) => j.id === id);
    if (job) job.processado = true;
    this.queue = this.queue.filter((j) => !j.processado);
  }

  haveEmails(): boolean {
    return this.queue.length > 0;
  }

  size(): number {
    return this.queue.length;
  }
}
