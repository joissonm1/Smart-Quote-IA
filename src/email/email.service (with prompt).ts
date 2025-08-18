import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private genAI: GoogleGenerativeAI;

  private imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  };

  constructor() {
    this.logger.log('EmailService inicializado');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não definido no .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async fetchUnreadEmails() {
    return new Promise<any[]>((resolve, reject) => {
      const imap = new Imap(this.imapConfig);

      imap.once('ready', () => {
        this.logger.log('Conectado ao email');
        imap.openBox('INBOX', false, (err) => {
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
            const fetcher = imap.fetch(results, { bodies: '' });

            fetcher.on('message', (msg) => {
              msg.on('body', (stream) => {
                const p = simpleParser(stream)
                  .then((parsed) => {
                    const emailJson = {
                      from: parsed.from?.text,
                      subject: parsed.subject,
                      date: parsed.date,
                      text: parsed.text,
                      html: parsed.html,
                      attachments: (parsed.attachments || []).map((a) => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        size: a.size,
                      })),
                    };
                    emails.push(emailJson);
                    this.logger.log(`Email processado: ${emailJson.subject}`);
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
                  this.logger.log(`${emails.length} emails processados`);
                  imap.end();
                  resolve(emails);
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

  @Cron('*/10 * * * * *')
  async handleCron() {
    console.log('---------------------------------------------------------------------------------');
    this.logger.log('Verificando emails...');
    try {
      const emails = await this.fetchUnreadEmails();
      if (emails.length > 0) {
        this.logger.log(`${emails.length} emails recebidos`);

        for (const email of emails) {
          this.logger.log(`De: ${email.from} | Assunto: ${email.subject}`);

          try {
            const response = await this.callGemini(
              `Você é um atendente de uma loja de informática.
               Analise este email (em Kz) e responda de forma clara:
               Assunto: ${email.subject}
               Conteúdo: ${email.text}`
            );
            this.logger.log(`Resposta da IA (Gemini): ${response}`);
          } catch (err) {
            this.logger.error('Erro ao chamar a IA:', err.message);
          }
        }
      }
    } catch (error) {
      this.logger.error('Erro ao buscar emails:', error.message);
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'models/gemini-2.5-pro' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
