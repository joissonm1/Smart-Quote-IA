import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RevenueData,
  QuotationRequestCounts,
  ProcessingMetric,
  QuotationTrendData,
} from './dashboard.interface';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const totalQuotations = await this.prisma.quotation.count();
    const pendingApprovals = await this.prisma.approval.count({
      where: { status: 'pending' },
    });
    const approvedQuotations = await this.prisma.quotation.count({
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
      totalQuotations,
      pendingApprovals,
      approvedQuotations,
      totalRevenue,
    };
  }

  async syncEmails() {
    try {
      // Placeholder for email syncing logic (e.g., fetch from email server)
      this.logger.log('Syncing emails...');
      // Simulate adding a new PENDING request
      const newRequest = await this.prisma.quotationRequest.create({
        data: {
          requester: 'System Sync',
          email: `sync-${Date.now()}@example.com`,
          description: 'Synced email request',
          status: 'PENDING',
          createdAt: new Date(),
        },
      });
      return {
        message: 'Emails synced successfully',
        newRequestId: newRequest.id,
      };
    } catch (error) {
      this.logger.error('Error syncing emails:', error);
      throw error;
    }
  }

  async getPendingApprovals() {
    try {
      const approvals = await this.prisma.approval.findMany({
        where: {
          status: 'pending',
          Quotation: {
            request: {
              status: 'PENDING',
            },
          },
        },
        select: {
          id: true,
          status: true,
          reason: true,
          createdAt: true,
          Quotation: {
            select: {
              id: true,
              totalValue: true,
              approved: true,
              createdAt: true,
              request: {
                select: {
                  id: true,
                  requester: true,
                  email: true,
                  description: true,
                  status: true,
                  createdAt: true,
                },
              },
              Customer: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return approvals.map((approval) => ({
        ...approval,
        Quotation: approval.Quotation
          ? {
              ...approval.Quotation,
              customer: approval.Quotation.Customer || null,
            }
          : null,
      }));
    } catch (error) {
      this.logger.error('Erro ao buscar aprovações pendentes:', error);
      throw error;
    }
  }

  async getQuotationRequests(
    status?: 'PENDING' | 'PROCESSING' | 'REJECTED' | 'COMPLETED' | 'ALL',
    sortBy: 'recent' | 'oldest' | 'priority' = 'recent',
    search?: string,
  ): Promise<QuotationRequestCounts> {
    try {
      const where: any = {};
      if (status && status !== 'ALL') {
        where.status = status;
      }
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const orderBy: any = {};
      if (sortBy === 'recent') {
        orderBy.createdAt = 'desc';
      } else if (sortBy === 'oldest') {
        orderBy.createdAt = 'asc';
      } else if (sortBy === 'priority') {
        // Placeholder: Implement priority logic if a priority field is added
        orderBy.createdAt = 'desc'; // Fallback to recent
      }

      const [requests, totalCount, pendingCount, processedCount, failedCount] =
        await Promise.all([
          this.prisma.quotationRequest.findMany({
            where,
            orderBy,
            select: {
              id: true,
              requester: true,
              email: true,
              description: true,
              status: true,
              createdAt: true,
              processedAt: true,
              quotations: {
                select: {
                  id: true,
                  totalValue: true,
                  items: true,
                },
                take: 1,
              },
            },
          }),
          this.prisma.quotationRequest.count({ where }),
          this.prisma.quotationRequest.count({ where: { status: 'PENDING' } }),
          this.prisma.quotationRequest.count({
            where: { status: 'COMPLETED' },
          }),
          this.prisma.quotationRequest.count({ where: { status: 'REJECTED' } }),
        ]);

      return {
        totalCount,
        pendingCount,
        processedCount,
        failedCount,
        requests: requests.map((req) => ({
          ...req,
          createdAt: req.createdAt.toISOString(),
          processedAt: req.processedAt?.toISOString(),
          status: req.status.toLowerCase(),
          quotationId: req.quotations[0]?.id,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching quotation requests:', error);
      throw error;
    }
  }

  async processEmail(requestId: string) {
    try {
      this.logger.log(`Processing email request: ${requestId}`);
      const request = await this.prisma.quotationRequest.findUnique({
        where: { id: requestId },
        include: { quotations: { select: { id: true } } },
      });

      if (!request) {
        throw new Error('Request not found');
      }
      if (request.status !== 'PENDING') {
        throw new Error('Request is not pending');
      }
      // Find a supplier (or use a default/placeholder supplierId)
      const supplier = await this.prisma.supplier.findFirst({
        select: { id: true },
      });
      if (!supplier) {
        throw new Error('No supplier found');
      }
      // Placeholder AI processing logic
      const quotation = await this.prisma.quotation.create({
        data: {
          requestId,
          totalValue: 1000,
          autoGenerated: true,
          createdAt: new Date(),
          items: {
            create: [
              {
                supplierId: supplier.id,
                quantity: 1,
                unitPrice: 1000,
                description: 'Sample Item',
                total: 1000,
              },
            ],
          },
        },
      });

      const updatedRequest = await this.prisma.quotationRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      return {
        message: 'Email processed successfully',
        requestId,
        quotationId: quotation.id,
      };
    } catch (error) {
      this.logger.error('Error processing email:', error);
      throw error;
    }
  }

  async approveApproval(approvalId: string, reason?: string) {
    try {
      const approval = await this.prisma.approval.findUnique({
        where: { id: approvalId },
        include: { Quotation: true },
      });
      if (!approval) {
        throw new NotFoundException(`Approval with ID ${approvalId} not found`);
      }

      const updatedApproval = await this.prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: 'approved',
          reason,
          createdAt: new Date(),
          //approvedBy: 'current_user', // Replace with actual user ID from auth context
        },
      });

      // Update the associated quotation
      await this.prisma.quotation.update({
        where: { id: approval.quotationId },
        data: { approved: true },
      });

      return updatedApproval;
    } catch (error) {
      this.logger.error(`Error approving approval ${approvalId}:`, error);
      throw error;
    }
  }

  async rejectApproval(approvalId: string, reason?: string) {
    try {
      const approval = await this.prisma.approval.findUnique({
        where: { id: approvalId },
      });
      if (!approval) {
        throw new NotFoundException(`Approval with ID ${approvalId} not found`);
      }

      const updatedApproval = await this.prisma.approval.update({
        where: { id: approvalId },
        data: {
          status: 'REJECTED',
          reason,
          createdAt: new Date(),
          //approvedBy: 'current_user', // Replace with actual user ID from auth context
        },
      });

      return updatedApproval;
    } catch (error) {
      this.logger.error(`Error rejecting approval ${approvalId}:`, error);
      throw error;
    }
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

    // Compute totalQuotations, totalValue, and lastContact
    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      location: customer.location,
      status: customer.status,
      totalQuotations: customer.Quotation.length,
      totalValue: customer.Quotation.reduce(
        (sum: any, q: { totalValue: any }) => sum + q.totalValue,
        0,
      ),
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
      totalQuotations: customer.Quotation.length,
      totalValue: customer.Quotation.reduce((sum, q) => sum + q.totalValue, 0),
      lastContact:
        customer.Quotation.length > 0
          ? customer.Quotation.reduce((latest, q) =>
              new Date(q.createdAt) > new Date(latest.createdAt) ? q : latest,
            ).createdAt
          : null,
    };
  }

  async getSuppliers() {
    return this.prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getRecentQuotations() {
    return this.prisma.quotation.findMany({
      take: 3,
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

  // async getQuotations() {
  //   return this.prisma.quotation.findMany({
  //     orderBy: { createdAt: 'desc' },
  //     select: {
  //       id: true,
  //       totalValue: true,
  //       approved: true,
  //       createdAt: true,
  //       emailRequest: true,
  //       notes: true,
  //       request: {
  //         select: {
  //           requester: true,
  //           email: true,
  //           description: true,
  //           status: true,
  //         },
  //       },
  //       Customer: {
  //         select: {
  //           name: true,
  //           email: true,
  //         },
  //       },
  //       Approval: {
  //         select: {
  //           id: true,
  //           status: true,
  //         },
  //       },
  //       items: {
  //         select: {
  //           id: true,
  //           description: true,
  //         },
  //       },
  //     },
  //   });
  // }

  async getQuotations() {
    return this.prisma.quotation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalValue: true,
        approved: true,
        createdAt: true,
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
            reason: true,
            createdAt: true,
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

  async getAnalytics() {
    try {
      // Define date ranges for current and previous month
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const previousMonthStart = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const previousMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      // Total Revenue (approved quotations)
      const [currentRevenue, previousRevenue] = await Promise.all([
        this.prisma.quotation.aggregate({
          _sum: { totalValue: true },
          where: {
            approved: true,
            createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          },
        }),
        this.prisma.quotation.aggregate({
          _sum: { totalValue: true },
          where: {
            approved: true,
            createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
          },
        }),
      ]);
      const currentRevenueValue = currentRevenue._sum.totalValue || 0;
      const previousRevenueValue = previousRevenue._sum.totalValue || 0;
      const revenueChange =
        previousRevenueValue > 0
          ? ((currentRevenueValue - previousRevenueValue) /
              previousRevenueValue) *
            100
          : currentRevenueValue > 0
            ? 100
            : 0;

      // Quotations Generated
      const [currentQuotations, previousQuotations] = await Promise.all([
        this.prisma.quotation.count({
          where: {
            createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          },
        }),
        this.prisma.quotation.count({
          where: {
            createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
          },
        }),
      ]);
      const quotationsChange =
        previousQuotations > 0
          ? ((currentQuotations - previousQuotations) / previousQuotations) *
            100
          : currentQuotations > 0
            ? 100
            : 0;

      // Avg Processing Time (time from QuotationRequest.createdAt to first Approval.createdAt with status 'approved')
      const approvals = await this.prisma.approval.findMany({
        where: {
          status: 'approved',
          Quotation: {
            createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          },
        },
        select: {
          createdAt: true,
          Quotation: {
            select: {
              request: { select: { createdAt: true } },
            },
          },
        },
      });
      const processingTimes = approvals
        .filter((a) => a.Quotation?.request?.createdAt)
        .map(
          (a) =>
            (new Date(a.createdAt).getTime() -
              new Date(a.Quotation.request.createdAt).getTime()) /
            1000 /
            60,
        ); // Minutes
      const avgProcessingTime =
        processingTimes.length > 0
          ? processingTimes.reduce((sum, time) => sum + time, 0) /
            processingTimes.length
          : 0;

      const previousApprovals = await this.prisma.approval.findMany({
        where: {
          status: 'approved',
          Quotation: {
            createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
          },
        },
        select: {
          createdAt: true,
          Quotation: {
            select: { request: { select: { createdAt: true } } },
          },
        },
      });
      const previousProcessingTimes = previousApprovals
        .filter((a) => a.Quotation?.request?.createdAt)
        .map(
          (a) =>
            (new Date(a.createdAt).getTime() -
              new Date(a.Quotation.request.createdAt).getTime()) /
            1000 /
            60,
        );
      const previousAvgProcessingTime =
        previousProcessingTimes.length > 0
          ? previousProcessingTimes.reduce((sum, time) => sum + time, 0) /
            previousProcessingTimes.length
          : 0;
      const processingTimeChange =
        previousAvgProcessingTime > 0
          ? ((avgProcessingTime - previousAvgProcessingTime) /
              previousAvgProcessingTime) *
            100
          : avgProcessingTime > 0
            ? 100
            : 0;

      // Approval Rate
      const [
        currentApproved,
        currentTotalApprovals,
        previousApproved,
        previousTotalApprovals,
      ] = await Promise.all([
        this.prisma.approval.count({
          where: {
            status: 'approved',
            createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          },
        }),
        this.prisma.approval.count({
          where: {
            createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          },
        }),
        this.prisma.approval.count({
          where: {
            status: 'approved',
            createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
          },
        }),
        this.prisma.approval.count({
          where: {
            createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
          },
        }),
      ]);
      const currentApprovalRate =
        currentTotalApprovals > 0
          ? (currentApproved / currentTotalApprovals) * 100
          : 0;
      const previousApprovalRate =
        previousTotalApprovals > 0
          ? (previousApproved / previousTotalApprovals) * 100
          : 0;
      const approvalRateChange =
        previousApprovalRate > 0
          ? ((currentApprovalRate - previousApprovalRate) /
              previousApprovalRate) *
            100
          : currentApprovalRate > 0
            ? 100
            : 0;

      return [
        {
          title: 'Total Revenue',
          value: `$${currentRevenueValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
          trend: revenueChange >= 0 ? 'up' : 'down',
          icon: 'DollarSign',
          color: 'text-green-600',
        },
        {
          title: 'Quotations Generated',
          value: currentQuotations.toLocaleString('en-US'),
          change: `${quotationsChange >= 0 ? '+' : ''}${quotationsChange.toFixed(1)}%`,
          trend: quotationsChange >= 0 ? 'up' : 'down',
          icon: 'FileText',
          color: 'text-blue-600',
        },
        {
          title: 'Avg Processing Time',
          value: `${avgProcessingTime.toFixed(1)} min`,
          change: `${processingTimeChange >= 0 ? '+' : ''}${processingTimeChange.toFixed(1)}%`,
          trend: processingTimeChange <= 0 ? 'down' : 'up', // Lower processing time is better
          icon: 'Clock',
          color: 'text-orange-600',
        },
        {
          title: 'Approval Rate',
          value: `${currentApprovalRate.toFixed(1)}%`,
          change: `${approvalRateChange >= 0 ? '+' : ''}${approvalRateChange.toFixed(1)}%`,
          trend: approvalRateChange >= 0 ? 'up' : 'down',
          icon: 'CheckCircle',
          color: 'text-purple-600',
        },
      ];
    } catch (error) {
      this.logger.error('Error fetching analytics:', error);
      throw error;
    }
  }

  async getRevenueTrends(
    year: number = new Date().getFullYear(),
  ): Promise<RevenueData[]> {
    try {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const result: RevenueData[] = []; // Add type annotation

      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

        const revenueData = await this.prisma.quotation.aggregate({
          _sum: { totalValue: true },
          where: {
            approved: true,
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        const revenue = revenueData._sum.totalValue || 0;

        const staticTargets = [
          200000, 210000, 220000, 240000, 260000, 280000, 300000, 320000,
          340000, 360000, 380000, 400000,
        ];
        const target = staticTargets[month];

        result.push({
          month: months[month],
          revenue,
          target,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Error fetching revenue trends:', error);
      throw error;
    }
  }

  async getQuotationTrends(
    year: number = new Date().getFullYear(),
  ): Promise<QuotationTrendData[]> {
    try {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const result: QuotationTrendData[] = [];

      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

        // Count created quotations
        const createdCount = await this.prisma.quotation.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        // Count approved quotations
        const approvedCount = await this.prisma.quotation.count({
          where: {
            approved: true,
            createdAt: { gte: startDate, lte: endDate },
          },
        });

        // Count rejected quotations (has at least one Approval with status 'rejected')
        const rejectedQuotations = await this.prisma.quotation.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
            Approval: {
              some: { status: 'rejected' },
            },
          },
        });

        result.push({
          month: months[month],
          created: createdCount,
          approved: approvedCount,
          rejected: rejectedQuotations,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Error fetching quotation trends:', error);
      throw error;
    }
  }

  async getProcessingMetrics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProcessingMetric[]> {
    try {
      // Default to current month if no date range provided
      const now = new Date();
      const currentMonthStart =
        startDate || new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd =
        endDate ||
        new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Email Processing
      const totalRequests = await this.prisma.quotationRequest.count({
        where: { createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
      });
      const processedRequests = await this.prisma.quotationRequest.count({
        where: {
          createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          quotations: { some: {} },
        },
      });
      const emailProcessingPercentage =
        totalRequests > 0 ? (processedRequests / totalRequests) * 100 : 0;

      // AI Analysis
      const totalAiAnalysis = processedRequests; // Requests with quotations
      const processedAiAnalysis = await this.prisma.quotation.count({
        where: { createdAt: { gte: currentMonthStart, lte: currentMonthEnd } },
      });
      const aiAnalysisPercentage =
        totalAiAnalysis > 0 ? (processedAiAnalysis / totalAiAnalysis) * 100 : 0;

      // Quote Generation
      const totalQuotes = processedAiAnalysis; // All quotations
      const processedQuotes = await this.prisma.quotation.count({
        where: {
          createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          Approval: { some: {} },
        },
      });
      const quoteGenerationPercentage =
        totalQuotes > 0 ? (processedQuotes / totalQuotes) * 100 : 0;

      // Approval Workflow
      const totalApprovals = processedQuotes; // Quotations with approvals
      const processedApprovals = await this.prisma.quotation.count({
        where: {
          createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
          approved: true,
        },
      });
      const approvalWorkflowPercentage =
        totalApprovals > 0 ? (processedApprovals / totalApprovals) * 100 : 0;

      return [
        {
          category: 'Email Processing',
          processed: processedRequests,
          total: totalRequests,
          percentage: parseFloat(emailProcessingPercentage.toFixed(1)),
          color: 'bg-blue-500',
        },
        {
          category: 'AI Analysis',
          processed: processedAiAnalysis,
          total: totalAiAnalysis,
          percentage: parseFloat(aiAnalysisPercentage.toFixed(1)),
          color: 'bg-green-500',
        },
        {
          category: 'Quote Generation',
          processed: processedQuotes,
          total: totalQuotes,
          percentage: parseFloat(quoteGenerationPercentage.toFixed(1)),
          color: 'bg-purple-500',
        },
        {
          category: 'Approval Workflow',
          processed: processedApprovals,
          total: totalApprovals,
          percentage: parseFloat(approvalWorkflowPercentage.toFixed(1)),
          color: 'bg-orange-500',
        },
      ];
    } catch (error) {
      this.logger.error('Error fetching processing metrics:', error);
      throw error;
    }
  }
}
