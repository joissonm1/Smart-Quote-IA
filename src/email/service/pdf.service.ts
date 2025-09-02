import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

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
    const doc = new PDFDocument({ margin: 50 });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Cabeçalho
    doc.fontSize(18).text('RCS - Pré-Fatura', { align: 'center' }).moveDown();

    doc
      .fontSize(12)
      .text(`Número: ${data.numero}`, { align: 'right' })
      .text(`Data: ${new Date().toLocaleDateString('pt-AO')}`, {
        align: 'right',
      })
      .moveDown();

    // Dados do cliente
    doc
      .fontSize(12)
      .text(`Cliente: ${data.cliente.nome}`)
      .text(`E-mail: ${data.cliente.email}`)
      .moveDown();

    // Tabela de itens
    doc.fontSize(12).text('Itens da Pré-Fatura:', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const itemSpacing = 20;

    doc.text('Descrição', 50, tableTop);
    doc.text('Qtd', 250, tableTop);
    doc.text('Preço Unit.', 300, tableTop);
    doc.text('Subtotal', 420, tableTop);

    let y = tableTop + 20;
    data.itens.forEach((item) => {
      const subtotal = item.quantidade * item.precoUnit;

      doc.text(item.descricao, 50, y, { width: 180 });
      doc.text(item.quantidade.toString(), 250, y);
      doc.text(`${item.precoUnit.toLocaleString()} Kz`, 300, y);
      doc.text(`${subtotal.toLocaleString()} Kz`, 420, y);

      y += itemSpacing;
    });

    // Total
    doc.moveDown(2);
    doc.fontSize(14).text(`Total: ${data.total.toLocaleString()} Kz`, {
      align: 'right',
    });

    // Observações
    if (data.observacoes) {
      doc.moveDown(2);
      doc.fontSize(12).text('Observações:', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(data.observacoes, { align: 'left' });
    }

    // Rodapé
    doc.moveDown(3);
    doc.fontSize(10).text('Obrigado pela preferência!', { align: 'center' });
    doc.text(`Página 1 de 1`, 0, doc.page.height - 50, { align: 'center' });

    doc.end();

    return new Promise((resolve) => {
      stream.on('finish', () => {
        this.logger.log(`Pré-fatura gerada: ${filePath}`);
        resolve(filePath);
      });
    });
  }
}
