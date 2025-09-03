import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { EmailQueueService } from './email-queue.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  };

  constructor(private readonly emailQueue: EmailQueueService) {
    this.logger.log('EmailService inicializado');
  }

  async fetchUnreadEmails() {
    return new Promise<any[]>((resolve, reject) => {
      const imap = new Imap(this.imapConfig);

      imap.once('ready', () => {
        this.logger.log('Conectado ao email');
        imap.openBox('INBOX', false, (err, box) => {
          if (err) return reject(err);

          imap.search(['UNSEEN'], (err, results) => {
            if (err) return reject(err);
            if (!results || results.length === 0) {
              this.logger.log('Nenhum email novo');
              imap.end();
              return resolve([]);
            }

            this.logger.log(`${results.length} emails encontrados`);

            const emails: any[] = [];
            const parsePromises: Promise<void>[] = [];
            const fetcher = imap.fetch(results, { bodies: '', markSeen: true });

            fetcher.on('message', (msg, seqno) => {
              msg.on('body', (stream) => {
                const p = simpleParser(stream)
                  .then(async (parsed) => {
                    const from = parsed.from?.value?.[0];
                    const cliente = {
                      nome: from?.name || 'Desconhecido',
                      email: from?.address || '',
                    };

                    const anexos = await Promise.all(
                      (parsed.attachments || []).map((a) =>
                        this.processAttachment(a),
                      ),
                    );

                    const emailJson = {
                      uid: seqno,
                      cliente,
                      assunto: parsed.subject || '',
                      descricao: parsed.text || '',
                      data: parsed.date ? parsed.date.toISOString() : '',
                      anexos,
                    };

                    emails.push(emailJson);
                    this.logger.log(`Email estruturado: ${emailJson.assunto}`);
                  })
                  .catch((err) => {
                    this.logger.error('Erro ao processar email:', err.message);
                  });

                parsePromises.push(p);
              });
            });

            fetcher.once('end', () => {
              Promise.all(parsePromises)
                .then(() => {
                  this.logger.log(`${emails.length} emails estruturados`);
                  imap.addFlags(results, '\\Seen', (err2) => {
                    if (err2)
                      this.logger.error(
                        'Erro ao marcar como lido:',
                        err2.message,
                      );
                    else
                      this.logger.log(
                        `Marcados ${results.length} emails como lidos`,
                      );
                    imap.end();
                    resolve(emails);
                  });
                })
                .catch((err) => {
                  this.logger.error('Erro processando emails:', err.message);
                  imap.end();
                  reject(err);
                });
            });
          });
        });
      });

      imap.once('error', (err) => {
        this.logger.error('Erro IMAP:', err.message);
        reject(err);
      });

      imap.connect();
    });
  }

  private async processAttachment(attachment: any) {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    const filePath = path.join(uploadDir, attachment.filename);
    fs.writeFileSync(filePath, attachment.content);

    let conteudo = '';

    if (attachment.contentType === 'application/pdf') {
      try {
        const data = await pdf(attachment.content);
        conteudo = data.text.trim();
        if (!conteudo) {
          this.logger.warn(
            `PDF sem texto (${attachment.filename}), tentando OCR...`,
          );
          conteudo = await this.ocrFile(filePath);
        }
      } catch {
        conteudo = await this.ocrFile(filePath);
      }
    } else if (attachment.contentType.startsWith('image/')) {
      conteudo = await this.ocrFile(filePath);
    } else if (attachment.contentType === 'text/plain') {
      conteudo = attachment.content.toString('utf-8').trim();
    }

    return {
      nome: attachment.filename,
      tipo: attachment.contentType,
      size: attachment.size,
      url: `uploads/${attachment.filename}`,
      conteudo,
    };
  }

  private async ocrFile(filePath: string): Promise<string> {
    try {
      const result = await Tesseract.recognize(filePath, 'por');
      return result.data.text.trim();
    } catch (err) {
      this.logger.error(`Erro no OCR: ${err.message}`);
      return '';
    }
  }

  private clearUploadsFolder() {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (fs.existsSync(uploadDir)) {
      fs.readdirSync(uploadDir).forEach((file) => {
        const filePath = path.join(uploadDir, file);
        try {
          const stat = fs.statSync(filePath);

          if (stat.isFile()) {
            fs.unlinkSync(filePath);
            this.logger.log(`Arquivo removido: ${file}`);
          } else {
            this.logger.log(`Ignorado (é uma pasta): ${file}`);
          }
        } catch (err) {
          this.logger.error(`Erro ao remover ${file}: ${err.message}`);
        }
      });
    }
  }

  @Cron('*/30 * * * * *')
  async handleCron() {
    this.logger.log('Verificando emails...');
    try {
      const emails = await this.fetchUnreadEmails();
      if (emails.length > 0) {
        this.logger.log(`${emails.length} emails recebidos`);

        for (const email of emails) {
          this.emailQueue.addEmail(email);
        }

        this.clearUploadsFolder();
      }
    } catch (error) {
      this.logger.error('Erro ao buscar emails:', error.message);
    }
  }
}
