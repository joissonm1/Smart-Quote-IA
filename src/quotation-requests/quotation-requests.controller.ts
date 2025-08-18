import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { QuotationRequestsService } from './quotation-requests.service';
import { CreateQuotationRequestDto } from './dto/create-quotation-request.dto';
import { UpdateQuotationRequestDto } from './dto/update-quotation-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Quotation Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quotation-requests')
export class QuotationRequestsController {
  constructor(private readonly quotationRequestsService: QuotationRequestsService) {}

  @Post()
  create(@Body() createQuotationRequestDto: CreateQuotationRequestDto) {
    return this.quotationRequestsService.create(createQuotationRequestDto);
  }

  @Get()
  findAll() {
    return this.quotationRequestsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotationRequestsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuotationRequestDto: UpdateQuotationRequestDto) {
    return this.quotationRequestsService.update(id, updateQuotationRequestDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quotationRequestsService.remove(id);
  }
}
