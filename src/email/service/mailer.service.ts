import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendPreInvoice(opts: {
    para: string;
    assunto: string;
    corpoTexto: string;
    anexoPdfPath?: string;
  }) {
    const { para, assunto, corpoTexto, anexoPdfPath } = opts;

    const attachments: nodemailer.Attachment[] = [];
    if (anexoPdfPath && fs.existsSync(anexoPdfPath)) {
      attachments.push({
        filename: anexoPdfPath.split('/').pop() || 'prefatura.pdf',
        path: anexoPdfPath,
        contentType: 'application/pdf',
      });
    }

    const info = await this.transporter.sendMail({
      from: process.env.SMTP_USER || process.env.EMAIL_USER,
      to: para,
      subject: assunto,
      text: corpoTexto,
      attachments,
    });

    this.logger.log(`E-mail enviado para ${para} (id: ${info.messageId})`);
    return info;
  }
}
