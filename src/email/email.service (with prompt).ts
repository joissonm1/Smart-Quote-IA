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
    console.log(
      '--------------------------------------------------Email--------------------------------------------------',
    );
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
               Conteúdo: ${email.text}`,
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
    const model = this.genAI.getGenerativeModel({
      model: 'models/gemini-2.5-pro',
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

// import { Injectable, Logger } from '@nestjs/common';
// import { Cron } from '@nestjs/schedule';
// import Imap from 'imap';
// import { simpleParser } from 'mailparser';
// import * as fs from 'fs';
// import * as path from 'path';
// import pdf from 'pdf-parse';
// import Tesseract from 'tesseract.js';

// @Injectable()
// export class EmailService {
//   private readonly logger = new Logger(EmailService.name);

//   private imapConfig = {
//     user: process.env.EMAIL_USER,
//     password: process.env.EMAIL_PASSWORD,
//     host: 'imap.gmail.com',
//     port: 993,
//     tls: true,
//     tlsOptions: { rejectUnauthorized: false },
//   };

//   constructor() {
//     this.logger.log('EmailService inicializado');
//   }

//   async fetchUnreadEmails() {
//     return new Promise<any[]>((resolve, reject) => {
//       const imap = new Imap(this.imapConfig);

//       imap.once('ready', () => {
//         this.logger.log('Conectado ao email');
//         imap.openBox('INBOX', false, (err) => {
//           if (err) return reject(err);

//           imap.search(['UNSEEN'], (err, results) => {
//             if (err) return reject(err);

//             if (!results || results.length === 0) {
//               this.logger.log('Nenhum email novo');
//               imap.end();
//               return resolve([]);
//             }

//             this.logger.log(`${results.length} emails encontrados`);

//             const emails: any[] = [];
//             const parsePromises: Promise<void>[] = [];
//             const fetcher = imap.fetch(results, { bodies: '' });

//             fetcher.on('message', (msg) => {
//               msg.on('body', (stream) => {
//                 const p = simpleParser(stream)
//                   .then(async (parsed) => {
//                     const from = parsed.from?.value?.[0];
//                     const cliente = {
//                       nome: from?.name || 'Desconhecido',
//                       email: from?.address || '',
//                     };

//                     const anexos = await Promise.all(
//                       (parsed.attachments || []).map(async (a) =>
//                         this.processAttachment(a),
//                       ),
//                     );

//                     const emailJson = {
//                       cliente,
//                       assunto: parsed.subject || '',
//                       descricao: parsed.text || '',
//                       data: parsed.date ? parsed.date.toISOString() : '',
//                       anexos,
//                       // tipo: this.detectTipo(parsed.subject, parsed.text),
//                       valido: this.isValidEmail(parsed.subject, parsed.text),
//                       // palavras_chave: this.extractKeywords(parsed.subject, parsed.text),
//                       // prioridade: this.definePriority(parsed.subject, parsed.text),
//                     };

//                     emails.push(emailJson);
//                     this.logger.log(`Email estruturado: ${emailJson.assunto}`);
//                   })
//                   .catch((err) => {
//                     this.logger.error('Erro ao processar email:', err.message);
//                   });

//                 parsePromises.push(p);
//               });
//             });

//             fetcher.once('end', () => {
//               Promise.all(parsePromises)
//                 .then(() => {
//                   this.logger.log(`${emails.length} emails estruturados`);
//                   imap.end();
//                   resolve(emails);
//                 })
//                 .catch((err) => {
//                   this.logger.error('Erro processando emails:', err.message);
//                   imap.end();
//                   reject(err);
//                 });
//             });
//           });
//         });
//       });

//       imap.once('error', (err) => {
//         this.logger.error('Erro IMAP:', err.message);
//         reject(err);
//       });

//       imap.connect();
//     });
//   }

//   private async processAttachment(attachment: any) {
//     const uploadDir = path.join(__dirname, '..', '..', 'uploads');
//     if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

//     const filePath = path.join(uploadDir, attachment.filename);
//     fs.writeFileSync(filePath, attachment.content);

//     let conteudo = '';

//     if (attachment.contentType === 'application/pdf') {
//       try {
//         const data = await pdf(attachment.content);
//         conteudo = data.text.trim();
//         if (!conteudo) {
//           this.logger.warn(
//             `PDF sem texto (${attachment.filename}), tentando OCR...`,
//           );
//           conteudo = await this.ocrFile(filePath);
//         }
//       } catch {
//         conteudo = await this.ocrFile(filePath);
//       }
//     } else if (attachment.contentType.startsWith('image/')) {
//       conteudo = await this.ocrFile(filePath);
//     }

//     return {
//       nome: attachment.filename,
//       tipo: attachment.contentType,
//       tamanho: attachment.size,
//       url: `uploads/${attachment.filename}`,
//       conteudo,
//     };
//   }

//   private async ocrFile(filePath: string): Promise<string> {
//     try {
//       const result = await Tesseract.recognize(filePath, 'por');
//       return result.data.text.trim();
//     } catch (err) {
//       this.logger.error(`Erro no OCR: ${err.message}`);
//       return '';
//     }
//   }

//   private clearUploadsFolder() {
//     const uploadDir = path.join(__dirname, '..', '..', 'uploads');
//     if (fs.existsSync(uploadDir)) {
//       fs.readdirSync(uploadDir).forEach((file) => {
//         const filePath = path.join(uploadDir, file);
//         try {
//           fs.unlinkSync(filePath);
//           this.logger.log(`Arquivo removido: ${file}`);
//         } catch (err) {
//           this.logger.error(`Erro ao remover arquivo ${file}: ${err.message}`);
//         }
//       });
//     }
//   }

//   // @Cron('*/10 * * * * *')
//   // async handleCron() {
//   //    console.log('\n--------------------------------------------------Email--------------------------------------------------');
//   //   this.logger.log('Verificando emails...');
//   //   try {
//   //     const emails = await this.fetchUnreadEmails();
//   //     if (emails.length > 0) {
//   //       this.logger.log(`${emails.length} emails recebidos`);

//   //       for (const email of emails) {
//   //         this.logger.log('=== EMAIL ANALISADO ===');
//   //         this.logger.log(JSON.stringify(email, null, 2));
//   //       }
//   //       this.clearUploadsFolder();
//   //     }
//   //   } catch (error) {
//   //     this.logger.error('Erro ao buscar emails:', error.message);
//   //   }
//   // }

//   @Cron('*/10 * * * * *')
//   async handleCron() {
//     console.log(
//       '\n--------------------------------------------------Email--------------------------------------------------',
//     );
//     this.logger.log('Verificando emails...');
//     try {
//       const emails = await this.fetchUnreadEmails();
//       if (emails.length > 0) {
//         this.logger.log(`${emails.length} emails recebidos`);

//         for (const email of emails) {
//           const jsonFinal = {
//             assunto: email.assunto,
//             descricao: email.descricao,
//             nome: email.cliente.nome,
//             email: email.cliente.email,
//             data: email.data || '',
//             anexo_conteudo: email.anexos.map((a) => a.conteudo).join('\n\n'),
//           };

//           this.logger.log('=== EMAIL FINAL ===');
//           this.logger.log(JSON.stringify(jsonFinal, null, 2));
//         }
//         this.clearUploadsFolder();
//       }
//     } catch (error) {
//       this.logger.error('Erro ao buscar emails:', error.message);
//     }
//   }

//   // private detectTipo(subject?: string, text?: string): string {
//   //   const content = `${subject} ${text}`.toLowerCase();
//   //   if (
//   //     content.includes('pc') ||
//   //     content.includes('computador') ||
//   //     content.includes('orçamento') ||
//   //     content.includes('preço')
//   //   ) {
//   //     return 'orcamento';
//   //   }
//   //   return 'outro';
//   // }

//   private isValidEmail(subject?: string, text?: string): boolean {
//     if (!subject && !text) return false;
//     if ((subject?.length || 0) < 3 && (text?.length || 0) < 5) return false;
//     return true;
//   }

//   // private extractKeywords(subject?: string, text?: string): string[] {
//   //   const content = `${subject} ${text}`.toLowerCase();
//   //   const keywords = ['pc', 'computador', 'disco', 'memória', 'formatação', 'assistência', 'orçamento'];
//   //   return keywords.filter((word) => content.includes(word));
//   // }

//   // private definePriority(subject?: string, text?: string): 'alta' | 'media' | 'baixa' {
//   //   const content = `${subject} ${text}`.toLowerCase();
//   //   if (content.includes('urgente') || content.includes('imediato')) return 'alta';
//   //   if (content.includes('orçamento') || content.includes('preço')) return 'media';
//   //   return 'baixa';
//   // }
// }
