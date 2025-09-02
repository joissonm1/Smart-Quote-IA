import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailQueueService } from './email-queue.service';
import { PdfService } from './pdf.service';
import { MailerService } from './mailer.service';
import { EmailJob } from '../interface/email.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  private SUPERVISOR_EMAIL =
    process.env.SUPERVISOR_EMAIL || 'joissonm.miguel@gmail.com';
  private IA_ENDPOINT =
    process.env.IA_ENDPOINT ||
    'https://smartquote-production-fc54.up.railway.app/processar-requisicao';

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
      mensagem: email.descricao || '',
      nome: email.cliente?.nome || 'Cliente',
      email: email.cliente?.email || '',
      anexo_conteudo: Array.isArray(email.anexos)
        ? email.anexos.map((a: any) => a.conteudo || '').join('\n\n')
        : '',
    };

    this.logger.log('=== EMAIL CAPTURADO ===');
    this.logger.log(JSON.stringify(jsonBase, null, 2));

    const cotacao = await this.callIA(jsonBase);

    this.logger.log('=== RESULTADO IA ===');
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
      itens: cotacao.itens,
      total: cotacao.total,
      observacoes: cotacao.observacoes,
    });

    const enviarPara = cotacao.revisao ? this.SUPERVISOR_EMAIL : cotacao.email;

    const corpo = this.messageEmail(cotacao, cotacao.revisao, numero);

    await this.mailer.sendPreInvoice({
      para: enviarPara,
      assunto: `Pré-Fatura RCS #${numero}`,
      corpoTexto: corpo,
      anexoPdfPath: pdfPath,
    });

    this.emailQueue.MarkAsProcessed(job.id);

    this.logger.log(
      `Fluxo concluído. Total: ${cotacao.total.toLocaleString()} Kz | Destino: ${enviarPara}`,
    );
  }

  private async callIA(dados: {
    mensagem: string;
    nome: string;
    email: string;
    anexo_conteudo?: string;
  }) {
    try {
      const response = await axios.post(this.IA_ENDPOINT, dados, {
        headers: { 'Content-Type': 'application/json' },
      });

      const { isvalide, revisao, conteudo } = response.data;

      if (!isvalide) {
        throw new Error('IA retornou isvalide=false');
      }

      const precoExtraido = this.extractPreco(conteudo.resposta_email.corpo);

      const itens = [
        {
          descricao: conteudo.produto,
          quantidade: 1,
          precoUnit: precoExtraido,
        },
      ];

      const total = itens.reduce(
        (acc, it) => acc + it.quantidade * it.precoUnit,
        0,
      );

      // 🔹 Força a regra: só vai para revisão se total > 2M
      let precisaRevisao = revisao;
      if (total <= 2_000_000) {
        precisaRevisao = false;
      }

      return {
        cliente: conteudo.nome,
        email: conteudo.email_cliente,
        itens,
        total,
        revisao: precisaRevisao,
        observacoes: conteudo.resposta_email?.corpo || '',
      };
    } catch (err) {
      this.logger.error(
        `Erro ao chamar IA: ${(err as Error).message}`,
        (err as Error).stack,
      );

      return {
        cliente: dados.nome,
        email: dados.email,
        itens: [
          {
            descricao: 'Produto não identificado',
            quantidade: 1,
            precoUnit: 0,
          },
        ],
        total: 0,
        revisao: true,
        observacoes: 'Erro ao processar IA. Gerado fallback.',
      };
    }
  }

  private extractPreco(texto: string): number {
    if (!texto) return 0;

    const idx = texto.toLowerCase().indexOf('kz');
    if (idx === -1) return 0;

    const parte = texto.substring(Math.max(0, idx - 20), idx).trim();

    let valorStr = parte.replace(/[^\d\.,]/g, '');
    if (valorStr.includes(',') && valorStr.includes('.')) {
      valorStr = valorStr.replace(/\./g, '');
      valorStr = valorStr.replace(',', '.');
    } else if (valorStr.includes(',')) {
      valorStr = valorStr.replace(',', '.');
    }

    const valor = Number(valorStr);
    return isNaN(valor) ? 0 : valor;
  }

  private messageEmail(
    cotacao: { cliente: string; total: number; itens: any[] },
    foiParaSupervisor: boolean,
    numero: string,
  ) {
    if (foiParaSupervisor) {
      return [
        `Prezado(a) Supervisor,`,
        ``,
        `A pré-fatura do cliente **${cotacao.cliente}** foi gerada e requer a sua revisão antes do envio.`,
        ``,
        `Valor total: ${cotacao.total.toLocaleString()} Kzs`,
        `Número da pré-fatura: ${numero}`,
        ``,
        `O documento em anexo contém todos os detalhes.`,
        ``,
        `Atenciosamente,`,
        `Equipe RCS`,
      ].join('\n');
    }

    const listaItens = cotacao.itens
      .map(
        (it) =>
          `- ${it.descricao} — ${it.quantidade} un — ${it.precoUnit.toLocaleString()} Kz`,
      )
      .join('\n');

    return [
      `Prezado(a) ${cotacao.cliente},`,
      ``,
      `Recebemos sua solicitação e geramos a pré-fatura #${numero} com base nas informações fornecidas.`,
      ``,
      `Itens incluídos:`,
      listaItens,
      ``,
      `Valor total: ${cotacao.total.toLocaleString()} Kz`,
      ``,
      `O documento em anexo contém todos os detalhes da sua pré-fatura.`,
      ``,
      `Caso haja necessidade de ajustes, basta responder a este e-mail.`,
      ``,
      `Atenciosamente,`,
      `Equipe RCS`,
    ].join('\n');
  }
}
