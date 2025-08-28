import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../email/service/pdf.service';
import { MailerService } from '../email/service/mailer.service';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

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

    const pdfPath = await this.pdfService.generatePreInvoice({
      numero: String(newRequest.id),
      cliente: { nome: newRequest.requester, email: newRequest.email },
      itens: [
        {
          descricao: newRequest.description,
          quantidade: 1,
          precoUnit: 0,
        },
      ],
      total: 0,
      observacoes: 'Cotação gerada automaticamente',
    });

    await this.mailerService.sendPreInvoice({
      para: newRequest.email,
      assunto: 'Sua Cotação',
      corpoTexto: `Olá ${newRequest.requester}, segue em anexo a sua pré-fatura.`,
      anexoPdfPath: pdfPath,
    });

    return newRequest;
  }

  async getAllFormSubmissions() {
    return this.prisma.quotationRequest.findMany({
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
