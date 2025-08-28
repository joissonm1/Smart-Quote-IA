import { Module } from '@nestjs/common';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from 'src/email/service/pdf.service';
import { MailerService } from 'src/email/service/mailer.service';
import { QuotationService } from 'src/email/service/quotation.service';

@Module({
  controllers: [FormsController],
  providers: [
    FormsService,
    PrismaService,
    PdfService,
    MailerService,
    QuotationService,
  ],
})
export class FormsModule {}
