import { Module } from '@nestjs/common';
import { EmailService } from '../service/email.service';
import { ConfigModule } from '@nestjs/config';
import { EmailQueueService } from '../service/email-queue.service';
import { EmailProcessorService } from '../service/email-processor.service';
import { PdfService } from '../service/pdf.service';
import { MailerService } from '../service/mailer.service';
import { EmailController } from '../controller/email.controller';
import { QuotationService } from '../service/quotation.service';
import { HttpModule } from '@nestjs/axios';
import { LogsService } from 'src/logs/logs.service';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailQueueService,
    EmailProcessorService,
    PdfService,
    MailerService,
    QuotationService,
    LogsService,
  ],
  exports: [
    EmailService,
    EmailQueueService,
    EmailProcessorService,
    PdfService,
    MailerService,
    QuotationService,
    LogsService,
  ],
})
export class EmailModule {}
