import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { QuotationService } from '../service/quotation.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';

@Controller('emails')
export class EmailController {
  constructor(private readonly quotationService: QuotationService) {}

  @ApiOperation({ summary: 'Obter todos os pedidos de cotação por email' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos por email retornada com sucesso',
  })
  @Get('quotations')
  async listQuotations() {
    return this.quotationService.findAll();
  }

  @ApiOperation({
    summary: 'Obter todos os pedidos de cotação por email por id',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos por email por id retornada com sucesso',
  })
  @Get('quotations/:id')
  async getQuotation(@Param('id') id: string) {
    return this.quotationService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar status de uma cotação (manager)' })
  @ApiResponse({ status: 200 })
  @Patch('quotations/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'approved' | 'rejected',
  ) {
    const prismaStatus =
      status === 'approved'
        ? $Enums.RequestStatus.COMPLETED
        : $Enums.RequestStatus.REJECTED;

    return this.quotationService.updateStatus(id, prismaStatus);
  }

  @ApiOperation({
    summary: 'Resumo(quantas aprovadas, rejeitadas, pendentes)',
  })
  @ApiResponse({ status: 200 })
  @Get('quotations/status/summary')
  async getSummary() {
    return this.quotationService.getStatusSummary();
  }
}
