import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../email/service/pdf.service';
import { MailerService } from '../email/service/mailer.service';
import axios from 'axios';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  private SUPERVISOR_EMAIL =
    process.env.SUPERVISOR_EMAIL || 'joissonm.miguel@gmail.com';
  private IA_ENDPOINT =
    process.env.IA_ENDPOINT ||
    'https://smartquote-iom8.onrender.com/processar-requisicao';

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private mailerService: MailerService,
  ) {}

  async createFormSubmission(data: {
    requester: string;
    email: string;
    description: string;
    attachments?: { fileName: string; fileUrl: string; fileType: string }[];
  }) {
    console.log(
      '\n--------------------------------------------------Forms--------------------------------------------------',
    );
    this.logger.log(`Recebendo solicitação de ${data.requester}`);
    console.log(
      '\n--------------------------------------------------------------------------------------------------------',
    );

    const newRequest = await this.prisma.quotationRequest.create({
      data: {
        requester: data.requester,
        email: data.email,
        description: data.description,
        attachments: { create: data.attachments || [] },
      },
      include: { attachments: true },
    });

    console.log(
      '\n--------------------------------------------------Forms--------------------------------------------------',
    );
    this.logger.log(`Solicitação criada com ID: ${newRequest.id}`);
    console.log(newRequest);
    console.log(
      '\n--------------------------------------------------------------------------------------------------------',
    );

    const jsonBase = {
      mensagem: data.description || '',
      nome: data.requester,
      email: data.email,
      anexo_conteudo:
        data.attachments
          ?.map((a) => `${a.fileName}: ${a.fileUrl}`)
          .join('\n') || '',
    };

    this.logger.log('=== DADOS ENVIADOS PARA IA ===');
    this.logger.log(JSON.stringify(jsonBase, null, 2));

    const cotacao = await this.callIA(jsonBase);

    this.logger.log('=== RESULTADO IA ===');
    this.logger.log(JSON.stringify(cotacao, null, 2));

    const saved = await this.prisma.quotationGenerated.create({
      data: {
        requestId: newRequest.id,
        jsonData: cotacao,
      },
    });

    this.logger.log(`Cotação salva no banco com id=${saved.id}`);

    const numero = `FORM-${Date.now()}`;
    let pdfPath: string | null = null;
    let assunto = '';

    if (!cotacao.isvalide) {
      assunto = `Solicitação não identificada - RCS`;
    } else {
      pdfPath = await this.pdfService.generatePreInvoice({
        numero,
        cliente: { nome: cotacao.cliente, email: cotacao.email },
        itens: cotacao.itens,
        total: cotacao.total,
        observacoes: cotacao.observacoes,
      });
      assunto = `Pré-Fatura RCS #${numero}`;
    }

    const enviarPara = cotacao.revisao ? this.SUPERVISOR_EMAIL : cotacao.email;
    const corpo = this.messageEmail(cotacao, cotacao.revisao, numero);

    await this.mailerService.sendPreInvoice({
      para: enviarPara,
      assunto,
      corpoTexto: corpo,
      anexoPdfPath: pdfPath || undefined,
    });

    this.logger.log(
      `Fluxo concluído. Total: ${cotacao.total.toLocaleString()} Kz | Destino: ${enviarPara}`,
    );

    return { ...newRequest, cotacao };
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

      this.logger.debug(
        'Resposta da IA (bruta): ' + JSON.stringify(response.data, null, 2),
      );

      const data = response.data;

      if (!data.isvalide) {
        return {
          isvalide: false,
          cliente: dados.nome,
          email: dados.email,
          itens: [
            {
              descricao: 'Nenhum produto identificado',
              quantidade: 0,
              precoUnit: 0,
            },
          ],
          total: 0,
          revisao: false,
          observacoes:
            data.observacoes ||
            'Não conseguimos identificar os produtos desejados. Por favor, envie mais detalhes.',
        };
      }

      const conteudo = data.conteudo || data;

      const itens =
        conteudo.itens ||
        (conteudo.produto
          ? [
              {
                descricao: conteudo.produto,
                quantidade: conteudo.quantidade || 1,
                precoUnit:
                  conteudo.precoUnit ||
                  this.extractPreco(conteudo.resposta_email?.corpo || ''),
              },
            ]
          : []);

      const total =
        conteudo.total ||
        itens.reduce((acc, it) => acc + it.quantidade * it.precoUnit, 0);

      let precisaRevisao = data.revisao ?? false;
      if (total <= 2_000_000) {
        precisaRevisao = false;
      }

      return {
        isvalide: true,
        cliente: conteudo.nome || dados.nome,
        email: conteudo.email_cliente || dados.email,
        itens,
        total,
        revisao: precisaRevisao,
        observacoes:
          conteudo.resposta_email?.corpo || conteudo.observacoes || '',
      };
    } catch (err) {
      this.logger.error(
        `Erro ao chamar IA: ${(err as Error).message}`,
        (err as Error).stack,
      );

      return {
        isvalide: false,
        cliente: dados.nome,
        email: dados.email,
        itens: [
          {
            descricao: 'Nenhum produto identificado',
            quantidade: 0,
            precoUnit: 0,
          },
        ],
        total: 0,
        revisao: false,
        observacoes:
          'Prezado cliente, não conseguimos identificar os produtos desejados. Por favor, envie mais detalhes.',
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
    cotacao: {
      cliente: string;
      total: number;
      itens: any[];
      observacoes: string;
      isvalide?: boolean;
    },
    foiParaSupervisor: boolean,
    numero: string,
  ) {
    if (foiParaSupervisor) {
      return [
        `Prezado(a) Supervisor,`,
        ``,
        `A pré-fatura do cliente **${cotacao.cliente}** foi gerada via formulário e requer a sua revisão antes do envio.`,
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

    if (!cotacao.isvalide) {
      return [
        `Prezado(a) ${cotacao.cliente},`,
        ``,
        cotacao.observacoes,
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
      `Recebemos sua solicitação via formulário e geramos a pré-fatura #${numero} com base nas informações fornecidas.`,
      ``,
      `Itens incluídos:`,
      listaItens,
      ``,
      `Valor total: ${cotacao.total.toLocaleString()} Kz`,
      ``,
      `O documento em anexo contém todos os detalhes da sua pré-fatura.`,
      ``,
      `Caso haja necessidade de ajustes, basta contactar a equipe RCS.`,
      ``,
      `Atenciosamente,`,
      `Equipe RCS`,
    ].join('\n');
  }

  async getAllFormSubmissions() {
    return this.prisma.quotationRequest.findMany({
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
