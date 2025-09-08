import { Controller, Get, Param, Patch, Body, Post } from '@nestjs/common';
import { QuotationService } from '../service/quotation.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { $Enums } from '@prisma/client';

@Controller('emails')
export class EmailController {
  constructor(private readonly quotationService: QuotationService) {}

  @ApiOperation({ summary: 'Obter todas as cotações por email' })
  @ApiResponse({ status: 200 })
  @Get('quotations')
  async listQuotations() {
    return this.quotationService.findAll();
  }

  @ApiOperation({ summary: 'Obter somente cotações pendentes' })
  @ApiResponse({ status: 200 })
  @Get('quotations/pending')
  async listPendingQuotations() {
    return this.quotationService.findPending();
  }

  @ApiOperation({ summary: 'Obter cotação por ID' })
  @ApiResponse({ status: 200 })
  @Get('quotations/:id')
  async getQuotation(@Param('id') id: string) {
    return this.quotationService.findOne(id);
  }

  @ApiOperation({ summary: 'Atualizar status de uma cotação (manager)' })
  @ApiResponse({ status: 200 })
  @Patch('quotations/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'COMPLETED' | 'REJECTED' | 'PENDING',
  ) {
    const prismaStatus =
      status === 'COMPLETED'
        ? $Enums.RequestStatus.COMPLETED
        : status === 'REJECTED'
          ? $Enums.RequestStatus.REJECTED
          : $Enums.RequestStatus.PENDING;

    return this.quotationService.updateStatus(id, prismaStatus);
  }

  @ApiOperation({ summary: 'Editar uma cotação antes da aprovação' })
  @ApiResponse({ status: 200, description: 'Cotação editada com sucesso' })
  @Patch('quotations/:id/edit')
  async editQuotation(
    @Param('id') id: string,
    @Body()
    body: {
      cliente?: { nome: string; email: string; nif?: string };
      itens?: { descricao: string; quantidade: number; precoUnit: number }[];
      observacoes?: string;
      total?: number;
    },
  ) {
    return this.quotationService.editQuotation(id, body);
  }

  @ApiOperation({
    summary: 'Resumo de status (quantas aprovadas, rejeitadas, pendentes)',
  })
  @ApiResponse({ status: 200 })
  @Get('quotations/status/summary')
  async getSummary() {
    return this.quotationService.getStatusSummary();
  }

  @ApiOperation({ summary: 'Aprovar cotação e enviar ao cliente' })
  @ApiResponse({ status: 200 })
  @Post('quotations/:id/approve')
  async approveQuotation(@Param('id') id: string) {
    return this.quotationService.approveAndSend(id);
  }

  @ApiOperation({ summary: 'Rejeitar cotação e notificar cliente' })
  @ApiResponse({ status: 200 })
  @Post('quotations/:id/reject')
  async rejectQuotation(@Param('id') id: string) {
    return this.quotationService.rejectAndNotify(id);
  }
}
