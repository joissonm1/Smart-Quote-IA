import { Module } from '@nestjs/common';
import { EmailService } from '../service/email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailQueueService } from '../service/email-queue.service';
import { EmailProcessorService } from '../service/email-processor.service';
import { PdfService } from '../service/pdf.service';
import { MailerService } from '../service/mailer.service';

@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    EmailQueueService,
    EmailProcessorService,
    PdfService,
    MailerService,
  ],
  exports: [
    EmailService,
    EmailQueueService,
    EmailProcessorService,
    PdfService,
    MailerService,
  ],
})
export class EmailModule {}
