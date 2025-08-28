import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums } from '@prisma/client';

@Injectable()
export class QuotationService {
  constructor(private readonly prisma: PrismaService) {}

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
}
