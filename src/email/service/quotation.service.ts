import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums } from '@prisma/client';
import { PdfService } from 'src/email/service/pdf.service';
import { MailerService } from 'src/email/service/mailer.service';

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly mailer: MailerService,
  ) {}

  async findAll() {
    return this.prisma.quotationGenerated.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.quotationGenerated.findUnique({
      where: { id },
    });
  }

  async findByRequestId(requestId: string) {
    return this.prisma.quotationGenerated.findFirst({
      where: { requestId },
    });
  }

  async findByStatus(status: $Enums.RequestStatus) {
    return this.prisma.quotationGenerated.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuotation(requestId: string, jsonData: any, total: number) {
    let status: $Enums.RequestStatus = $Enums.RequestStatus.PENDING;

    if (total <= 2000000) {
      status = $Enums.RequestStatus.COMPLETED;
    }

    return this.prisma.quotationGenerated.create({
      data: {
        requestId,
        jsonData,
        status,
      },
    });
  }

  async updateStatus(id: string, status: $Enums.RequestStatus) {
    return this.prisma.quotationGenerated.update({
      where: { id },
      data: { status },
    });
  }

  async getStatusSummary() {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.quotationGenerated.count({
        where: { status: $Enums.RequestStatus.PENDING },
      }),
      this.prisma.quotationGenerated.count({
        where: { status: $Enums.RequestStatus.COMPLETED },
      }),
      this.prisma.quotationGenerated.count({
        where: { status: $Enums.RequestStatus.REJECTED },
      }),
    ]);

    return { pending, approved, rejected };
  }

  async approveAndSend(id: string) {
    const quotation = await this.prisma.quotationGenerated.findUnique({
      where: { id },
    });
    if (!quotation) throw new NotFoundException('Cotação não encontrada');

    const cotacao = quotation.jsonData as any;

    const pdfPath = await this.pdfService.generatePreInvoice({
      numero: id,
      cliente: {
        nome: cotacao.cliente,
        email: cotacao.email,
        nif: cotacao.nif || undefined,
      },
      itens: cotacao.itens,
      total: cotacao.total,
      observacoes: cotacao.observacoes,
    });

    await this.mailer.sendPreInvoice({
      para: cotacao.email,
      assunto: `Pré-Fatura RCS #${id}`,
      corpoTexto: `Prezado(a) ${cotacao.cliente},\n\nSegue em anexo sua pré-fatura.\n\nAtenciosamente,\nEquipe RCS`,
      anexoPdfPath: pdfPath,
    });

    return this.updateStatus(id, $Enums.RequestStatus.COMPLETED);
  }

  async rejectAndNotify(id: string) {
    const quotation = await this.prisma.quotationGenerated.findUnique({
      where: { id },
    });
    if (!quotation) throw new NotFoundException('Cotação não encontrada');

    const cotacao = quotation.jsonData as any;

    await this.mailer.sendPreInvoice({
      para: cotacao.email,
      assunto: `Solicitação RCS #${id} - Rejeitada`,
      corpoTexto: `Prezado(a) ${cotacao.cliente},\n\nSua solicitação foi analisada, mas não pôde ser aprovada.\nEntre em contato para mais detalhes.\n\nAtenciosamente,\nEquipe RCS`,
    });

    return this.updateStatus(id, $Enums.RequestStatus.REJECTED);
  }

  async findPending() {
    return this.prisma.quotationGenerated.findMany({
      where: { status: $Enums.RequestStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async editQuotation(id: string, updates: any) {
    const quotation = await this.prisma.quotationGenerated.findUnique({
      where: { id },
    });

    if (!quotation) throw new Error('Cotação não encontrada');
    const currentData = (quotation.jsonData as any) || {};

    const newJsonData = {
      ...currentData,
      ...updates,
    };

    return this.prisma.quotationGenerated.update({
      where: { id },
      data: {
        jsonData: newJsonData,
        status: $Enums.RequestStatus.PENDING,
      },
    });
  }
}
