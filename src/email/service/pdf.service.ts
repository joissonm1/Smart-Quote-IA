import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generatePreInvoice(data: {
    numero: string;
    cliente: { nome: string; email: string };
    itens: { descricao: string; quantidade: number; precoUnit: number }[];
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

    const html = `
      <html lang="pt">
        <head>
          <meta charset="UTF-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              color: #333;
            }
            header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #1a73e8;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            header img {
              height: 50px;
            }
            h1 {
              margin: 0;
              color: #1a73e8;
              font-size: 20px;
            }
            .header-info {
              text-align: right;
              font-size: 12px;
              color: #555;
            }
            .cliente {
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f4f4f4;
            }
            .total {
              text-align: right;
              font-size: 1.2em;
              font-weight: bold;
              margin-top: 20px;
            }
            .observacoes {
              margin-top: 30px;
              padding: 10px;
              background: #f9f9f9;
              border-left: 4px solid #1a73e8;
              font-size: 12px;
            }
            footer {
              position: fixed;
              bottom: 20px;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 0.8em;
              color: #777;
            }
          </style>
        </head>
        <body>
          <header>
            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : ''}
            <div>
              <h1>RCS - Pré-Fatura</h1>
              <div class="header-info">
                Número: ${data.numero}<br/>
                Data: ${new Date().toLocaleDateString('pt-AO')}
              </div>
            </div>
          </header>

          <div class="cliente">
            <strong>Cliente:</strong> ${data.cliente.nome}<br/>
            <strong>E-mail:</strong> ${data.cliente.email}
          </div>

          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Qtd</th>
                <th>Preço Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${data.itens
                .map(
                  (item) => `
                <tr>
                  <td>${item.descricao}</td>
                  <td>${item.quantidade}</td>
                  <td>${item.precoUnit.toLocaleString()} Kz</td>
                  <td>${(item.quantidade * item.precoUnit).toLocaleString()} Kz</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>

          <div class="total">Total: ${data.total.toLocaleString()} Kz</div>

          ${
            data.observacoes
              ? `<div class="observacoes"><strong>Observações:</strong><br/>${data.observacoes}</div>`
              : ''
          }

          <footer>
            Obrigado pela preferência! - RCS <br/>
            Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </footer>
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
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
        <div style="font-size:10px; width:100%; text-align:center; color:#555;">
          Página <span class="pageNumber"></span> de <span class="totalPages"></span>
        </div>
      `,
      margin: { top: '100px', bottom: '80px' },
    });
    await browser.close();

    this.logger.log(`Pré-fatura gerada em HTML/PDF: ${filePath}`);
    return filePath;
  }
}
