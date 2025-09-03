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

  private readonly SUPERVISOR_EMAIL: string;
  private readonly IA_ENDPOINT: string;
  private readonly REVISION_THRESHOLD: number;
  private readonly MAX_RETRIES = 3;
  private readonly PROCESSING_TIMEOUT = 30000;

  constructor(
    private readonly emailQueue: EmailQueueService,
    private readonly pdfService: PdfService,
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {
    this.SUPERVISOR_EMAIL = process.env.SUPERVISOR_EMAIL!;
    this.IA_ENDPOINT = process.env.IA_ENDPOINT!;
    this.REVISION_THRESHOLD = parseInt(process.env.REVISION_THRESHOLD!);

    if (!this.SUPERVISOR_EMAIL) {
      throw new Error(
        'SUPERVISOR_EMAIL é obrigatório para funcionamento em produção',
      );
    }

    if (!this.IA_ENDPOINT) {
      throw new Error(
        'IA_ENDPOINT é obrigatório para funcionamento em produção',
      );
    }

    this.logger.log(
      `EmailProcessorService iniciado. Limite de revisão: ${this.REVISION_THRESHOLD.toLocaleString()} Kz`,
    );
  }

  @Cron('0 */1 * * * *')
  async processQueue() {
    try {
      if (!this.emailQueue.haveEmails()) return;

      const job: EmailJob | null = this.emailQueue.catchNext();
      if (!job) return;

      if (job.processado) {
        this.logger.warn(`E-mail ${job.id} já processado, ignorando...`);
        return;
      }

      await this.processEmailJob(job);
    } catch (error) {
      this.logger.error('Erro no processamento da fila de emails:', error);
    }
  }

  private async processEmailJob(job: EmailJob) {
    const startTime = Date.now();
    this.logger.log(`Iniciando processamento do job ${job.id}`);

    try {
      const email = job.email;

      const jsonBase = this.prepareDataForIA(email);

      this.logger.log('=== EMAIL CAPTURADO ===');
      this.logger.debug(JSON.stringify(jsonBase, null, 2));

      const cotacao = await this.callIAWithRetry(jsonBase);

      this.logger.log('=== RESULTADO IA ===');
      this.logger.debug(JSON.stringify(cotacao, null, 2));

      const saved = await this.prisma.quotationGenerated.create({
        data: {
          requestId: job.email.uid.toString(),
          jsonData: cotacao,
        },
      });

      this.logger.log(`Cotação salva no banco com id=${saved.id}`);

      await this.generateAndSendResponse(cotacao, saved.id.toString());

      this.emailQueue.MarkAsProcessed(job.id);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Fluxo concluído em ${processingTime}ms. ` +
          `Total: ${cotacao.total.toLocaleString()} Kz | ` +
          `Destino: ${cotacao.revisao ? this.SUPERVISOR_EMAIL : cotacao.email}`,
      );
    } catch (error) {
      this.logger.error(`Erro no processamento do job ${job.id}:`, error);

      await this.notifyErrorToSupervisor(job, error as Error);
    }
  }

  private prepareDataForIA(email: any) {
    let mensagem = email.descricao || '';

    if (!mensagem.trim()) {
      mensagem = `O cliente "${email.cliente?.nome || 'Cliente'}" entrou em contato, 
mas não descreveu nenhum produto ou quantidade. 
Responda educadamente informando que precisa de mais detalhes sobre os produtos desejados.`;
    }

    return {
      mensagem,
      nome: email.cliente?.nome || 'Cliente',
      email: email.cliente?.email || '',
      anexo_conteudo: Array.isArray(email.anexos)
        ? email.anexos.map((a: any) => a.conteudo || '').join('\n\n')
        : '',
    };
  }

  private async callIAWithRetry(dados: any, retryCount = 0): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.PROCESSING_TIMEOUT,
      );

      const response = await axios.post(this.IA_ENDPOINT, dados, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        timeout: this.PROCESSING_TIMEOUT,
      });

      clearTimeout(timeoutId);

      return this.processIAResponse(response.data, dados);
    } catch (error) {
      this.logger.error(
        `Tentativa ${retryCount + 1} falhou ao chamar IA:`,
        error,
      );

      if (retryCount < this.MAX_RETRIES) {
        this.logger.log(
          `Tentando novamente em 2 segundos... (${retryCount + 1}/${this.MAX_RETRIES})`,
        );
        await this.sleep(2000);
        return this.callIAWithRetry(dados, retryCount + 1);
      }
      this.logger.error(`Falha definitiva após ${this.MAX_RETRIES} tentativas`);
      return this.createFailureResponse(dados, error as Error);
    }
  }

  private processIAResponse(data: any, originalData: any) {
    this.logger.debug('Resposta da IA (bruta):', JSON.stringify(data, null, 2));

    if (!data.isvalide) {
      return {
        isvalide: false,
        cliente: originalData.nome,
        email: originalData.email,
        itens: [
          {
            descricao: 'Informações insuficientes',
            quantidade: 0,
            precoUnit: 0,
          },
        ],
        total: 0,
        revisao: false,
        observacoes:
          data.observacoes ||
          'Não conseguimos identificar os produtos desejados. Por favor, envie mais detalhes específicos sobre os itens que deseja cotar.',
      };
    }

    const conteudo = data.conteudo || data;
    const itens = this.extractItems(conteudo);
    const total = conteudo.total || this.calculateTotal(itens);
    const precisaRevisao = this.shouldRequireRevision(data.revisao, total);

    return {
      isvalide: true,
      cliente: conteudo.nome || originalData.nome,
      email: conteudo.email_cliente || originalData.email,
      itens,
      total,
      revisao: precisaRevisao,
      observacoes: conteudo.resposta_email?.corpo || conteudo.observacoes || '',
    };
  }

  private extractItems(conteudo: any): any[] {
    if (conteudo.itens && Array.isArray(conteudo.itens)) {
      return conteudo.itens;
    }

    if (conteudo.produto) {
      return [
        {
          descricao: conteudo.produto,
          quantidade: conteudo.quantidade || 1,
          precoUnit:
            conteudo.precoUnit ||
            this.extractPreco(conteudo.resposta_email?.corpo || ''),
        },
      ];
    }

    return [
      {
        descricao: 'Item não especificado',
        quantidade: 1,
        precoUnit: 0,
      },
    ];
  }

  private calculateTotal(itens: any[]): number {
    return itens.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnit,
      0,
    );
  }

  private shouldRequireRevision(iaRevision: boolean, total: number): boolean {
    if (iaRevision === true) return true;
    if (total > this.REVISION_THRESHOLD) return true;
    return false;
  }

  private createFailureResponse(dados: any, error: Error) {
    const isTimeoutError =
      error.message.includes('timeout') || error.message.includes('aborted');

    return {
      isvalide: false,
      cliente: dados.nome,
      email: dados.email,
      itens: [
        {
          descricao: 'Erro no processamento',
          quantidade: 0,
          precoUnit: 0,
        },
      ],
      total: 0,
      revisao: true,
      observacoes: isTimeoutError
        ? 'Prezado cliente, estamos processando sua solicitação. Entraremos em contato em breve com mais informações.'
        : 'Prezado cliente, encontramos uma dificuldade técnica no processamento da sua solicitação. Nossa equipe entrará em contato em breve.',
    };
  }

  private async generateAndSendResponse(cotacao: any, numero: string) {
    let pdfPath: string | null = null;
    let assunto = '';

    if (!cotacao.isvalide) {
      assunto = `Solicitação Recebida - RCS`;
    } else {
      try {
        pdfPath = await this.pdfService.generatePreInvoice({
          numero,
          cliente: {
            nome: cotacao.cliente,
            email: cotacao.email,
            nif: cotacao.nif || undefined,
          },
          itens: cotacao.itens,
          total: cotacao.total,
          observacoes: cotacao.observacoes,
        });

        assunto = `Pré-Fatura RCS #${numero}`;
      } catch (pdfError) {
        this.logger.error('Erro ao gerar PDF:', pdfError);
        assunto = `Cotação RCS #${numero} (PDF em processamento)`;
      }
    }

    const destinatario = cotacao.revisao
      ? this.SUPERVISOR_EMAIL
      : cotacao.email;
    const corpoEmail = this.messageEmail(cotacao, cotacao.revisao, numero);

    await this.mailer.sendPreInvoice({
      para: destinatario,
      assunto,
      corpoTexto: corpoEmail,
      anexoPdfPath: pdfPath || undefined,
    });
  }

  private async notifyErrorToSupervisor(job: EmailJob, error: Error) {
    try {
      const assunto = `Erro no Processamento de Email - Sistema RCS`;
      const corpo = [
        `Prezado Supervisor,`,
        ``,
        `Ocorreu um erro no processamento do email ID: ${job.id}`,
        `Cliente: ${job.email.cliente?.nome || 'N/A'}`,
        `Email: ${job.email.cliente?.email || 'N/A'}`,
        ``,
        `Erro: ${error.message}`,
        ``,
        `Por favor, verifique o sistema.`,
        ``,
        `Sistema RCS`,
      ].join('\n');

      await this.mailer.sendPreInvoice({
        para: this.SUPERVISOR_EMAIL,
        assunto,
        corpoTexto: corpo,
      });
    } catch (notificationError) {
      this.logger.error('Erro ao notificar supervisor:', notificationError);
    }
  }

  private extractPreco(texto: string): number {
    if (!texto) return 0;

    const padroes = [
      /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*kz/gi,
      /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*kz/gi,
      /kz\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi,
      /kz\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    ];

    for (const padrao of padroes) {
      const match = texto.match(padrao);
      if (match) {
        let valorStr = match[1] || match[0];
        valorStr = valorStr.replace(/[^\d\.,]/g, '');

        if (valorStr.includes(',') && valorStr.includes('.')) {
          valorStr = valorStr.replace(/\./g, '');
          valorStr = valorStr.replace(',', '.');
        } else if (valorStr.includes(',')) {
          valorStr = valorStr.replace(',', '.');
        }

        const valor = Number(valorStr);
        if (!isNaN(valor) && valor > 0) {
          return valor;
        }
      }
    }

    return 0;
  }

  private messageEmail(
    cotacao: any,
    foiParaSupervisor: boolean,
    numero: string,
  ): string {
    if (foiParaSupervisor) {
      return [
        `Prezado(a) Supervisor,`,
        ``,
        `A solicitação do cliente **${cotacao.cliente}** foi processada e requer sua revisão.`,
        ``,
        `${cotacao.total > 0 ? `Valor total: ${cotacao.total.toLocaleString()} Kz` : 'Solicitação sem valor definido'}`,
        `Referência: ${numero}`,
        `Email do cliente: ${cotacao.email}`,
        ``,
        `${
          cotacao.total > this.REVISION_THRESHOLD
            ? `⚠️ Valor acima do limite de ${this.REVISION_THRESHOLD.toLocaleString()} Kz`
            : '⚠️ Revisão solicitada pela IA ou erro técnico'
        }`,
        ``,
        `Por favor, revise e tome as ações necessárias.`,
        ``,
        `Atenciosamente,`,
        `Sistema Automatizado RCS`,
      ].join('\n');
    }

    if (!cotacao.isvalide) {
      return [
        `Prezado(a) ${cotacao.cliente},`,
        ``,
        `Recebemos sua solicitação, mas precisamos de mais informações para preparar sua cotação.`,
        ``,
        cotacao.observacoes,
        ``,
        `Por favor, nos forneça mais detalhes sobre os produtos desejados, quantidades e especificações.`,
        ``,
        `Atenciosamente,`,
        `Equipe RCS - Soluções Tecnológicas`,
      ].join('\n');
    }

    const listaItens = cotacao.itens
      .map(
        (item) =>
          `• ${item.descricao} — ${item.quantidade} un — ${item.precoUnit.toLocaleString()} Kz`,
      )
      .join('\n');

    return [
      `Prezado(a) ${cotacao.cliente},`,
      ``,
      `Agradecemos sua solicitação. Preparamos a pré-fatura #${numero} com base nas informações fornecidas.`,
      ``,
      `**Itens cotados:**`,
      listaItens,
      ``,
      `O documento em anexo contém todos os detalhes da cotação.`,
      ``,
      `Para prosseguir com o pedido ou esclarecer dúvidas, entre em contato conosco.`,
      ``,
      `Atenciosamente,`,
      `Equipe RCS - Soluções Tecnológicas`,
    ].join('\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
