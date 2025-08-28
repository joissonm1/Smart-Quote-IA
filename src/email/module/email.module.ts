import { Module } from '@nestjs/common';
import { EmailService } from '../service/email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailQueueService } from '../service/email-queue.service';
import { EmailProcessorService } from '../service/email-processor.service';
import { PdfService } from '../service/pdf.service';
import { MailerService } from '../service/mailer.service';
import { EmailController } from '../controller/email.controller';
import { QuotationService } from '../service/quotation.service';

@Module({
  imports: [ConfigModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailQueueService,
    EmailProcessorService,
    PdfService,
    MailerService,
    QuotationService,
  ],
  exports: [
    EmailService,
    EmailQueueService,
    EmailProcessorService,
    PdfService,
    MailerService,
    QuotationService,
  ],
})
export class EmailModule {}
