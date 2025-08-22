import { Body, Controller, Post, Get, UsePipes } from '@nestjs/common';
import { FormsService } from './forms.service';
import { ApiBody, ApiResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ValidateForm } from '../forms/validate-form';

@ApiTags('forms')
@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post()
  @UsePipes(new ValidateForm())
  @ApiOperation({ summary: 'Submeter um pedido de cotação' })
  @ApiResponse({ status: 201, description: 'Pedido criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 500, description: 'Erro no servidor' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        requester: {
          type: 'string',
          example: 'Nuno Mendes',
          description: 'Nome de quem está a pedir a cotação',
        },
        email: {
          type: 'string',
          example: 'nuno.mendes@exemplo.com',
          description: 'Email do solicitante',
        },
        description: {
          type: 'string',
          example: 'Preciso de orçamento para 10 computadores',
          description: 'Descrição do pedido de cotação',
        },
        attachments: {
          type: 'array',
          description: 'Lista de anexos relacionados ao pedido',
          items: {
            type: 'object',
            properties: {
              fileName: {
                type: 'string',
                example: 'orcamento.pdf',
                description: 'Nome do ficheiro',
              },
              fileUrl: {
                type: 'string',
                example: 'https://teste.com/orcamento.pdf',
                description: 'URL do ficheiro',
              },
              fileType: {
                type: 'string',
                example: 'application/pdf',
                description: 'Tipo MIME do ficheiro',
              },
            },
          },
        },
      },
      required: ['requester', 'email', 'description'],
    },
  })
  async submitForm(
    @Body()
    body: {
      requester: string;
      email: string;
      description: string;
      attachments?: { fileName: string; fileUrl: string; fileType: string }[];
    },
  ) {
    return this.formsService.createFormSubmission(body);
  }

  @Get()
  @ApiOperation({ summary: 'Obter todos os pedidos de cotação' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos retornada com sucesso',
  })
  async getAllForms() {
    return this.formsService.getAllFormSubmissions();
  }
}
