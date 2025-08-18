// import { Controller, Post, Body, Logger, HttpCode, Get } from '@nestjs/common';
// import { EmailService, EmailAnalysisResult } from './email.service';

// @Controller('email')
// export class EmailController {
//   private readonly logger = new Logger(EmailController.name);

//   constructor(private emailService: EmailService) {}

//   @Post('webhook')
//   @HttpCode(200)
//   async handleGmailWebhook(@Body() payload: any): Promise<{ success: boolean; data?: EmailAnalysisResult; error?: string }> {
//     try {
//       this.logger.log('Webhook recebido do Gmail');
      
//       const result = await this.emailService.processIncomingEmail(payload);
      
//       this.logger.log('Email processado:', result);
      
//       return { success: true, data: result };
      
//     } catch (error) {
//       this.logger.error('Erro no webhook:', error);
//       return { success: false, error: error.message };
//     }
//   }

//   @Post('test-analysis')
//   @HttpCode(200)
//   async testEmailAnalysis(@Body() testEmailData: any) {
//     try {
//       this.logger.log('🧪 Testando análise de email...');
      
//       const result = await this.emailService.processIncomingEmail(testEmailData);
      
//       return {
//         success: true,
//         message: 'Email analisado com sucesso!',
//         data: result
//       };
      
//     } catch (error) {
//       this.logger.error('Erro no teste:', error);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }


//   @Post('test-simple')
//   @HttpCode(200)
//   async testSimple(@Body() testEmailData: any) {
//     try {
//       this.logger.log('🔧 Teste simples - dados recebidos:', testEmailData);
      
//       const mockResult: EmailAnalysisResult = {
//         cliente: {
//           email: testEmailData.from || 'teste@email.com',
//           nome: 'Cliente Teste',
//           empresa: 'Empresa Teste'
//         },
//         produto: {
//           descricao: 'Produto extraído do email',
//           categoria: 'Categoria Teste',
//           especificacoes: ['Especificação 1']
//         },
//         quantidade: 100,
//         prazo: '15 dias',
//         orcamento: 1000,
//         observacoes: 'Teste de estrutura de dados',
//         anexos: [],
//         prioridade: 'media'
//       };
      
//       return {
//         success: true,
//         message: 'Teste simples executado com sucesso!',
//         data: mockResult
//       };
      
//     } catch (error) {
//       this.logger.error('Erro no teste simples:', error);
//       return {
//         success: false,
//         error: error.message
//       };
//     }
//   }

//   @Get('health')
//   healthCheck() {
//     return {
//       status: 'OK',
//       message: 'Email service is running',
//       timestamp: new Date().toISOString()
//     };
//   }
// }