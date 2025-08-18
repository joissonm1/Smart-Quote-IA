import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(private prisma: PrismaService) {}

  async createFormSubmission(data: {
    requester: string;
    email: string;
    description: string;
    attachments?: { fileName: string; fileUrl: string; fileType: string }[];
  }) {
    console.log('\n--------------------------------------------------Forms--------------------------------------------------');
    this.logger.log(`Recebendo solicitação de ${data.requester}`);
    console.log('\n---------------------------------------------------------------------------------------------------------');

    const newRequest = await this.prisma.quotationRequest.create({
      data: {
        requester: data.requester,
        email: data.email,
        description: data.description,
        attachments: {
          create: data.attachments || [],
        },
      },
      include: { attachments: true },
    });
   console.log('\n--------------------------------------------------Forms--------------------------------------------------');
    this.logger.log(`Solicitação criada com ID: ${newRequest.id}`);
    console.log(newRequest);
    console.log('\n--------------------------------------------------------------------------------------------------------');
    return newRequest;
  }

  async getAllFormSubmissions() {
    return this.prisma.quotationRequest.findMany({
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
