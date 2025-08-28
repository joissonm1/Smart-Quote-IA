import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailQueueService } from './email-queue.service';
import { PdfService } from './pdf.service';
import { MailerService } from './mailer.service';
import { EmailJob } from '../interface/email.interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  private LIMIAR_ENV = Number(process.env.VALUE_QUOTE || 2000000);
  private SUPERVISOR_EMAIL =
    process.env.SUPERVISOR_EMAIL || 'joissonm.miguel@gmail.com';

  constructor(
    private readonly emailQueue: EmailQueueService,
    private readonly pdfService: PdfService,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/10 * * * * *')
  async processQueue() {
    if (!this.emailQueue.haveEmails()) return;

    const job: EmailJob | null = this.emailQueue.catchNext();
    if (!job) return;

    if (job.processado) {
      this.logger.warn(`E-mail ${job.id} já processado, ignorando...`);
      return;
    }

    const email = job.email;

    const jsonBase = {
      assunto: email.assunto || '',
      descricao: email.descricao || '',
      nome: email.cliente?.nome || 'Cliente',
      email: email.cliente?.email || '',
      data: email.data || new Date().toISOString(),
      anexo_conteudo: Array.isArray(email.anexos)
        ? email.anexos.map((a: any) => a.conteudo || '').join('\n\n')
        : '',
    };

    this.logger.log('=== EMAIL CAPTURADO ===');
    this.logger.log(JSON.stringify(jsonBase, null, 2));

    const cotacao = await this.simularIA(jsonBase);

    this.logger.log('=== RESULTADO IA (simulado) ===');
    this.logger.log(JSON.stringify(cotacao, null, 2));

    const saved = await this.prisma.quotationGenerated.create({
      data: {
        requestId: job.email.uid.toString(),
        jsonData: cotacao,
      },
    });

    this.logger.log(`Cotação salva no banco com id=${saved.id}`);

    const numero = `${Date.now()}`;

    const pdfPath = await this.pdfService.generatePreInvoice({
      numero,
      cliente: { nome: cotacao.cliente, email: cotacao.email },
      itens: cotacao.itens.map((i) => ({
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnit: i.precoUnit,
      })),
      total: cotacao.total,
      observacoes: cotacao.observacoes,
    });

    const LIMIAR = this.LIMIAR_ENV;
    const foiParaSupervisor = cotacao.total >= LIMIAR;
    const enviarPara = foiParaSupervisor
      ? this.SUPERVISOR_EMAIL
      : cotacao.email;

    const corpo = this.mensagemEmail(cotacao, foiParaSupervisor);

    await this.mailer.sendPreInvoice({
      para: enviarPara,
      assunto: `Pré-Fatura RCS #${numero}`,
      corpoTexto: corpo,
      anexoPdfPath: pdfPath,
    });

    this.emailQueue.MarkAsProcessed(job.id);

    this.logger.log(
      `Fluxo concluído. Total: ${cotacao.total} Kz | Limiar: ${LIMIAR} Kz | Destino: ${enviarPara}`,
    );
  }

  private async simularIA(dados: {
    nome: string;
    email: string;
    descricao: string;
    anexo_conteudo: string;
  }) {
    const temPalavraPC =
      /computador|notebook|laptop|pc/i.test(dados.descricao) ||
      /computador|notebook|laptop|pc/i.test(dados.anexo_conteudo);

    const itens = temPalavraPC
      ? [
          {
            descricao: 'Laptop 15" 8GB/256GB',
            quantidade: 1,
            precoUnit: 350000,
          },
          { descricao: 'Mouse óptico', quantidade: 1, precoUnit: 5000 },
        ]
      : [{ descricao: 'Gerador 5kVA', quantidade: 2, precoUnit: 1200000 }];

    const total = itens.reduce(
      (acc, it) => acc + it.quantidade * it.precoUnit,
      0,
    );

    return {
      cliente: dados.nome,
      email: dados.email,
      itens,
      total,
      observacoes: 'Cotação simulada; valores estimados com IVA incluso.',
    };
  }

  private mensagemEmail(
    cotacao: { cliente: string; total: number },
    foiParaSupervisor: boolean,
  ) {
    if (foiParaSupervisor) {
      return [
        `Supervisor,`,
        ``,
        `Pré-fatura acima do limiar configurado.`,
        `Cliente: ${cotacao.cliente}`,
        `Total: ${cotacao.total.toLocaleString()} Kz`,
        ``,
        `Favor revisar e enviar ao cliente.`,
      ].join('\n');
    }
    return [
      `Prezado(a) ${cotacao.cliente},`,
      ``,
      `Recebemos sua solicitação e geramos uma pré-fatura com base nas informações enviadas.`,
      `Por favor, verifique os detalhes no anexo.`,
      `Caso haja algum ajuste, basta responder este e-mail.`,
      ``,
      `Atenciosamente,`,
      `Equipe RCS`,
    ].join('\n');
  }
}
