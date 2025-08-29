import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../login/auth/jwt/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  //   @UseGuards(JwtAuthGuard)
  @Get('overview')
  async getOverview() {
    return this.dashboardService.getOverview();
  }

  //   @UseGuards(JwtAuthGuard)
  @Get('recent-quotations')
  async getRecentQuotations() {
    return this.dashboardService.getRecentQuotation();
  }

  //   @UseGuards(JwtAuthGuard)
  @Get('pending-approvals')
  async getPendingApprovals() {
    return this.dashboardService.getPendingApprovals();
  }

  //   @UseGuards(JwtAuthGuard)
  @Post('approvals/:id/approve')
  async approveApproval(@Param('id') id: string) {
    return this.dashboardService.approveApproval(id);
  }

  //   @UseGuards(JwtAuthGuard)
  @Post('approvals/:id/reject')
  async rejectApproval(@Param('id') id: string) {
    return this.dashboardService.rejectApproval(id);
  }

  //   @UseGuards(JwtAuthGuard)
  @Get('customers')
  async getCustomers() {
    return this.dashboardService.getCustomers();
  }

  //   @UseGuards(JwtAuthGuard)
  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return this.dashboardService.getCustomer(id);
  }

  //   @UseGuards(JwtAuthGuard)
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

  //   @UseGuards(JwtAuthGuard)
  @Get('quotation-requests')
  async getQuotationRequests() {
    return this.dashboardService.getQuotationRequests();
  }

  //   @UseGuards(JwtAuthGuard)
  @Get('suppliers')
  async getSuppliers() {
    return this.dashboardService.getSuppliers();
  }
}
