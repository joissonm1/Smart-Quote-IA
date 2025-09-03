import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

import {
  ProcessingMetric,
  QuotationRequestCounts,
  QuotationTrendData,
} from './dashboard.interface';

interface ApproveRejectDto {
  comments?: string;
}

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('recent-quotations')
  async getRecentQuotations() {
    return this.dashboardService.getRecentQuotations();
  }

  @Get('quotations')
  async getQuotations() {
    return this.dashboardService.getQuotations();
  }

  @Get('pending-approvals')
  async getPendingApprovals() {
    return this.dashboardService.getPendingApprovals();
  }

  // @Post('approvals/:id/approve')
  // async approveApproval(@Param('id') id: string) {
  //   return this.dashboardService.approveApproval(id);
  // }
  // @Post('approvals/:id/reject')
  // async rejectApproval(@Param('id') id: string) {
  //   return this.dashboardService.rejectApproval(id);
  // }
  @Post('approvals/:id/approve')
  async approveApproval(
    @Param('id') id: string,
    @Body() body: ApproveRejectDto,
  ) {
    return this.dashboardService.approveApproval(id, body.comments);
  }

  @Post('approvals/:id/reject')
  async rejectApproval(
    @Param('id') id: string,
    @Body() body: ApproveRejectDto,
  ) {
    return this.dashboardService.rejectApproval(id, body.comments);
  }

  @Get('customers')
  async getCustomers() {
    return this.dashboardService.getCustomers();
  }

  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return this.dashboardService.getCustomer(id);
  }

  @Post('quotations')
  async createQuotation(
    @Body()
    data: {
      customerId: string;
      requestId: string;
      totalValue: number;
      items: {
        supplierId: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }[];
    },
  ) {
    return this.dashboardService.createQuotation(data);
  }

  @Get('quotations/:id')
  async getQuotation(@Param('id') id: string) {
    return this.dashboardService.getQuotation(id);
  }

  // @Get('quotation-requests')
  // async getQuotationRequests() {
  //   return this.dashboardService.getQuotationRequests();
  // }
  @Get('quotation-requests')
  async getQuotationRequests(
    @Query('status') status?: 'PENDING' | 'PROCESSING' | 'REJECTED' | 'ALL',
    @Query('sortBy') sortBy?: 'recent' | 'oldest' | 'priority',
    @Query('search') search?: string,
  ): Promise<QuotationRequestCounts> {
    return this.dashboardService.getQuotationRequests(status, sortBy, search);
  }

  @Get('suppliers')
  async getSuppliers() {
    return this.dashboardService.getSuppliers();
  }

  @Get('analytics')
  async getAnalytics() {
    return this.dashboardService.getAnalytics();
  }

  @Get('revenue-trends')
  async getRevenueTrends(@Query('year') year?: string) {
    return this.dashboardService.getRevenueTrends(
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('quotation-trends')
  async getQuotationTrends(
    @Query('year') year?: string,
  ): Promise<QuotationTrendData[]> {
    return this.dashboardService.getQuotationTrends(
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Get('processing-metrics')
  async getProcessingMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ProcessingMetric[]> {
    return this.dashboardService.getProcessingMetrics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Post('sync-emails')
  async syncEmails() {
    return this.dashboardService.syncEmails();
  }
}
