import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationRequestDto } from './dto/create-quotation-request.dto';
import { UpdateQuotationRequestDto } from './dto/update-quotation-request.dto';

@Injectable()
export class QuotationRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateQuotationRequestDto) {
    return this.prisma.quotationRequest.create({
      data: {
        requester: data.requester,
        email: data.email,
        description: data.description || "No description provided",
        status: data.status ?? 'PENDING',
      },
      include: { quotations: true, attachments: true },
    });
  }

  async findAll() {
    return this.prisma.quotationRequest.findMany({
      include: { quotations: true, attachments: true },
    });
  }

  async findOne(id: string) {
    const quotationRequest = await this.prisma.quotationRequest.findUnique({
      where: { id },
      include: { quotations: true, attachments: true },
    });

    if (!quotationRequest) {
      throw new NotFoundException('Quotation Request not found');
    }
    return quotationRequest;
  }

  async update(id: string, data: UpdateQuotationRequestDto) {
    return this.prisma.quotationRequest.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.quotationRequest.delete({
      where: { id },
    });
  }
}
