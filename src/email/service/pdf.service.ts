import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePreInvoice(data: {
    numero: string;
    cliente: { nome: string; email: string; nif?: string };
    itens: {
      descricao: string;
      detalhes?: string;
      quantidade: number;
      precoUnit: number;
    }[];
    total: number;
    observacoes?: string;
  }): Promise<string> {
    const uploadsDir = path.join(__dirname, '../../uploads/invoices');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      this.logger.log(`Pasta removida: ${uploadsDir}`);
    }
    fs.mkdirSync(uploadsDir, { recursive: true });
    this.logger.log(`Pasta recriada: ${uploadsDir}`);

    const filePath = path.join(uploadsDir, `pre-fatura-${data.numero}.pdf`);

    const logoPath = path.join(__dirname, '../../assets/logo.png');
    let logoBase64 = '';
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }

    const subtotal = data.itens.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnit,
      0,
    );
    const iva = 0;

    const html = `
      <!DOCTYPE html>
      <html lang="pt">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pré-Fatura RCS</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              color: #2c3e50;
              background: #f8f9fa;
              line-height: 1.4;
            }
            
            .document {
              max-width: 210mm;
              margin: 20px auto;
              background: white;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              min-height: 297mm;
            }
            
            .content {
              padding: 40px;
            }
            
            header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #2c5aa0;
            }
            
            .company-info {
              flex: 1;
            }
            
            .company-name {
              font-size: 28px;
              font-weight: 700;
              color: #2c5aa0;
              margin: 0 0 5px 0;
              letter-spacing: -0.5px;
            }
            
            .company-details {
              font-size: 11px;
              color: #6c757d;
              line-height: 1.3;
            }
            
            .logo-section {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #2c5aa0, #1a73e8);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 24px;
              margin-left: 20px;
            }
            
            .logo-section img {
              width: 70px;
              height: 70px;
              object-fit: contain;
              border-radius: 4px;
            }
            
            .document-title {
              background: linear-gradient(135deg, #2c5aa0, #1a73e8);
              color: white;
              padding: 15px 0;
              text-align: center;
              margin: 0 -40px 30px -40px;
              font-size: 18px;
              font-weight: 600;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            
            .invoice-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            
            .detail-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #2c5aa0;
            }
            
            .detail-section h3 {
              margin: 0 0 15px 0;
              color: #2c5aa0;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .detail-item {
              margin-bottom: 8px;
              font-size: 13px;
            }
            
            .detail-label {
              color: #6c757d;
              font-weight: 500;
              display: inline-block;
              min-width: 80px;
            }
            
            .detail-value {
              color: #2c3e50;
              font-weight: 600;
            }
            
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 30px 0;
              font-size: 12px;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            
            .items-table th {
              background: linear-gradient(135deg, #34495e, #2c3e50);
              color: white;
              padding: 15px 12px;
              text-align: left;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-size: 11px;
            }
            
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e9ecef;
              background: white;
            }
            
            .items-table tr:nth-child(even) td {
              background: #f8f9fa;
            }
            
            .text-right {
              text-align: right;
            }
            
            .text-center {
              text-align: center;
            }
            
            .currency {
              font-family: 'Courier New', monospace;
              font-weight: 600;
            }
            
            .total-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-top: 20px;
              border: 2px solid #e9ecef;
            }
            
            .total-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              font-size: 14px;
            }
            
            .total-final {
              background: linear-gradient(135deg, #2c5aa0, #1a73e8);
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              margin-top: 15px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 18px;
              font-weight: 700;
            }
            
            .observacoes {
              margin-top: 40px;
              padding: 20px;
              background: linear-gradient(135deg, #fff3cd, #ffeaa7);
              border-left: 5px solid #f39c12;
              border-radius: 0 8px 8px 0;
              font-size: 12px;
              line-height: 1.5;
            }
            
            .observacoes h4 {
              margin: 0 0 10px 0;
              color: #d68910;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 2px solid #e9ecef;
              text-align: center;
              color: #6c757d;
              font-size: 11px;
            }
            
            .footer-company {
              font-weight: 600;
              color: #2c5aa0;
              margin-bottom: 5px;
            }
            
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              color: rgba(44, 90, 160, 0.03);
              font-weight: 900;
              z-index: 0;
              pointer-events: none;
            }
            
            .content-wrapper {
              position: relative;
              z-index: 1;
            }
          </style>
        </head>
        <body>
          <div class="document">
            <div class="watermark">PRÉ-FATURA</div>
            <div class="content-wrapper">
              <div class="content">
                <header>
                  <div class="company-info">
                    <div class="company-name">RCS</div>
                    <div class="company-details">
                      Luanda, Angola<br/>
                      Tel: +244 923 456 789<br/>
                      Email: geral@rcs.ao
                    </div>
                  </div>
                  <div class="logo-section">
                    ${logoBase64 ? `<img src="${logoBase64}" alt="Logo RCS" />` : 'RCS'}
                  </div>
                </header>

                <div class="document-title">Pré-Fatura</div>

                <div class="invoice-details">
                  <div class="detail-section">
                    <h3>Detalhes da Fatura</h3>
                    <div class="detail-item">
                      <span class="detail-label">Número:</span>
                      <span class="detail-value">${data.numero}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Data:</span>
                      <span class="detail-value">${new Date().toLocaleDateString('pt-AO')}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Validade:</span>
                      <span class="detail-value">30 dias</span>
                    </div>
                  </div>
                  
                  <div class="detail-section">
                    <h3>Informações do Cliente</h3>
                    <div class="detail-item">
                      <span class="detail-label">Nome:</span>
                      <span class="detail-value">${data.cliente.nome}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">E-mail:</span>
                      <span class="detail-value">${data.cliente.email}</span>
                    </div>
                    ${
                      data.cliente.nif
                        ? `
                    <div class="detail-item">
                      <span class="detail-label">NIF:</span>
                      <span class="detail-value">${data.cliente.nif}</span>
                    </div>
                    `
                        : ''
                    }
                  </div>
                </div>

                <table class="items-table">
                  <thead>
                    <tr>
                      <th style="width: 50%">Descrição</th>
                      <th style="width: 10%" class="text-center">Qtd</th>
                      <th style="width: 20%" class="text-right">Preço Unit.</th>
                      <th style="width: 20%" class="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.itens
                      .map(
                        (item) => `
                      <tr>
                        <td>
                          <strong>${item.descricao}</strong>
                          ${item.detalhes ? `<br/><small style="color: #6c757d;">${item.detalhes}</small>` : ''}
                        </td>
                        <td class="text-center">${item.quantidade}</td>
                        <td class="text-right currency">${item.precoUnit.toLocaleString('pt-AO')} Kz</td>
                        <td class="text-right currency">${(item.quantidade * item.precoUnit).toLocaleString('pt-AO')} Kz</td>
                      </tr>
                    `,
                      )
                      .join('')}
                  </tbody>
                </table>

                <div class="total-section">
                  <div class="total-row">
                    <span>Subtotal:</span>
                    <span class="currency">${subtotal.toLocaleString('pt-AO')} Kz</span>
                  </div>
                  <div class="total-row">
                    <span>IVA (0%):</span>
                    <span class="currency">${iva.toLocaleString('pt-AO')} Kz</span>
                  </div>
                  <div class="total-final">
                    <span>TOTAL GERAL:</span>
                    <span class="currency">${data.total.toLocaleString('pt-AO')} Kz</span>
                  </div>
                </div>

                ${
                  data.observacoes
                    ? `<div class="observacoes">
                        <h4>Termos e Condições</h4>
                        ${data.observacoes}
                      </div>`
                    : `<div class="observacoes">
                        <h4>Termos e Condições</h4>
                        • Pagamento em 30 dias após aprovação da pré-fatura<br/>
                        • Projeto inclui suporte técnico conforme acordado<br/>
                        • Valores expressos em Kwanzas(AOA)<br/>
                        • Proposta válida por 30 dias a partir da data de emissão<br/>
                        • Início dos trabalhos mediante confirmação e acordo comercial
                      </div>`
                }

                <footer>
                  <div class="footer-company">RCS - Soluções Tecnológicas</div>
                  <div>Obrigado pela confiança em nossos serviços</div>
                  <div style="margin-top: 10px; font-size: 10px;">
                    Este documento é uma pré-fatura e não possui valor fiscal
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    let browser;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="font-size:10px; width:100%; text-align:center; color:#6c757d; margin-top: 10px;">
            Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </div>
        `,
        margin: {
          top: '60px',
          bottom: '80px',
          left: '40px',
          right: '40px',
        },
      });

      this.logger.log(`Pré-fatura gerada com sucesso: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error('Erro ao gerar PDF:', error);
      throw new Error(`Falha na geração do PDF: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
