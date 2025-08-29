import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const totalQuotation = await this.prisma.quotation.count();
    const pendingApprovals = await this.prisma.approval.count({
      where: { status: 'pending' },
    });
    const approvedQuotation = await this.prisma.quotation.count({
      where: { approved: true },
    });
    const totalRevenue = await this.prisma.quotation
      .aggregate({
        where: { approved: true },
        _sum: { totalValue: true },
      })
      .then(
        (result: { _sum: { totalValue: any } }) => result._sum.totalValue || 0,
      );

    return {
      totalQuotation,
      pendingApprovals,
      approvedQuotation,
      totalRevenue,
    };
  }

  // async getRecentQuotation() {
  //   return this.prisma.quotation.findMany({
  //     take: 5,
  //     orderBy: { createdAt: 'desc' },
  //     select: {
  //       id: true,
  //       totalValue: true,
  //       approved: true,
  //       createdAt: true,
  //       request: {
  //         select: {
  //           requester: true,
  //           email: true,
  //           description: true,
  //           status: true,
  //         },
  //       },
  //     },
  //   });
  // }

  async getPendingApprovals() {
    return this.prisma.approval.findMany({
      where: { status: 'pending' },
      select: {
        id: true,
        quotationId: true,
        status: true,
        reason: true,
        createdAt: true,
        Quotation: {
          select: {
            id: true,
            totalValue: true,
            approved: true,
            request: {
              select: {
                requester: true,
                email: true,
                description: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async approveApproval(id: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }
    await this.prisma.approval.update({
      where: { id },
      data: { status: 'approved' },
    });
    await this.prisma.quotation.update({
      where: { id: approval.quotationId },
      data: { approved: true },
    });
    return { message: 'Approval approved successfully' };
  }

  async rejectApproval(id: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }
    await this.prisma.approval.update({
      where: { id },
      data: { status: 'rejected' },
    });
    return { message: 'Approval rejected successfully' };
  }

  async getCustomers() {
    const customers = await this.prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        status: true,
        createdAt: true,
        Quotation: {
          select: {
            totalValue: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute totalQuotation, totalValue, and lastContact
    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      location: customer.location,
      status: customer.status,
      totalQuotation: customer.Quotation.length,
      totalValue: customer.Quotation.reduce((sum, q) => sum + q.totalValue, 0),
      lastContact:
        customer.Quotation.length > 0
          ? customer.Quotation.reduce((latest, q) =>
              new Date(q.createdAt) > new Date(latest.createdAt) ? q : latest,
            ).createdAt
          : null,
    }));
  }

  async getCustomer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        location: true,
        status: true,
        createdAt: true,
        Quotation: {
          select: {
            id: true,
            totalValue: true,
            approved: true,
            createdAt: true,
            request: {
              select: {
                requester: true,
                description: true,
                status: true,
              },
            },
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                total: true,
                supplier: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      ...customer,
      totalQuotation: customer.Quotation.length,
      totalValue: customer.Quotation.reduce((sum, q) => sum + q.totalValue, 0),
      lastContact:
        customer.Quotation.length > 0
          ? customer.Quotation.reduce((latest, q) =>
              new Date(q.createdAt) > new Date(latest.createdAt) ? q : latest,
            ).createdAt
          : null,
    };
  }

  // async createQuotation(data: {
  //   customerId: string;
  //   requestId: string;
  //   totalValue: number;
  //   items: { supplierId: string; description: string; quantity: number; unitPrice: number; total: number }[];
  // }) {
  //   const quotation = await this.prisma.quotation.create({
  //     data: {
  //       id: `quote-${Math.random().toString(36).substr(2, 9)}`,
  //       requestId: data.requestId,
  //       customerId: data.customerId,
  //       totalValue: data.totalValue,
  //       approved: false,
  //       createdAt: new Date(),
  //       items: {
  //         create: data.items.map((item) => ({
  //           id: `item-${Math.random().toString(36).substr(2, 9)}`,
  //           supplierId: item.supplierId,
  //           description: item.description,
  //           quantity: item.quantity,
  //           unitPrice: item.unitPrice,
  //           total: item.total,
  //         })),
  //       },
  //     },
  //   });

  //   return quotation;
  // }

  async getQuotationRequests() {
    return this.prisma.quotationRequest.findMany({
      select: {
        id: true,
        description: true,
      },
    });
  }

  async getSuppliers() {
    return this.prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getRecentQuotation() {
    return this.prisma.quotation.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalValue: true,
        approved: true,
        createdAt: true,
        emailRequest: true,
        notes: true,
        request: {
          select: {
            requester: true,
            email: true,
            description: true,
            status: true,
          },
        },
        Customer: {
          select: {
            name: true,
            email: true,
          },
        },
        Approval: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  }

  async getQuotations() {
    return this.prisma.quotation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalValue: true,
        approved: true,
        createdAt: true,
        emailRequest: true,
        notes: true,
        request: {
          select: {
            requester: true,
            email: true,
            description: true,
            status: true,
          },
        },
        Customer: {
          select: {
            name: true,
            email: true,
          },
        },
        Approval: {
          select: {
            id: true,
            status: true,
          },
        },
        items: {
          select: {
            id: true,
            description: true,
          },
        },
      },
    });
  }

  async getQuotation(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      select: {
        id: true,
        totalValue: true,
        approved: true,
        createdAt: true,
        emailRequest: true,
        notes: true,
        Customer: {
          select: {
            name: true,
            email: true,
          },
        },
        request: {
          select: {
            requester: true,
            email: true,
            description: true,
            status: true,
          },
        },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            total: true,
            supplier: {
              select: {
                name: true,
              },
            },
          },
        },
        Approval: {
          select: {
            id: true,
            status: true,
            reason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Cotação não encontrada');
    }

    return quotation;
  }

  async createQuotation(data: {
    customerId: string;
    requestId: string;
    totalValue: number;
    emailRequest?: string;
    notes?: string;
    items: {
      supplierId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
  }) {
    const quotation = await this.prisma.quotation.create({
      data: {
        id: `quote-${Math.random().toString(36).substr(2, 9)}`,
        requestId: data.requestId,
        customerId: data.customerId,
        totalValue: data.totalValue,
        approved: false,
        createdAt: new Date(),
        emailRequest: data.emailRequest,
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            id: `item-${Math.random().toString(36).substr(2, 9)}`,
            supplierId: item.supplierId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
    });

    return quotation;
  }

  async sendQuotation(id: string) {
    const quotation = await this.prisma.quotation.findUnique({ where: { id } });
    if (!quotation) {
      throw new NotFoundException('Cotação não encontrada');
    }
    if (!quotation.approved) {
      throw new NotFoundException('Cotação não está aprovada');
    }
    // Lógica de envio (e.g., disparar e-mail)
    return { message: 'Cotação enviada com sucesso' };
  }
}
