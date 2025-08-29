import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  private invoicesDir = path.join(__dirname, '..', '..', 'uploads', 'invoices');

  constructor() {
    if (!fs.existsSync(this.invoicesDir)) {
      fs.mkdirSync(this.invoicesDir, { recursive: true });
      this.logger.log(`Pasta criada: ${this.invoicesDir}`);
    }
  }

  async generatePreInvoice(dados: {
    numero: string;
    cliente: { nome: string; email: string };
    itens: Array<{ descricao: string; quantidade: number; precoUnit: number }>;
    total: number;
    observacoes?: string;
  }): Promise<string> {
    this.cleanOldPdfs();
    const filePath = path.join(
      this.invoicesDir,
      `prefatura-${dados.numero}.pdf`,
    );

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    let pageNumber = 1;
    doc.on('pageAdded', () => {
      pageNumber++;
    });

    try {
      doc.image(
        path.join(__dirname, '..', '..', 'assets', 'logo.png'),
        50,
        40,
        { width: 100 },
      );
    } catch (e) {
      this.logger.warn('Logo não encontrado, pulando...');
    }

    doc.fontSize(20).text('RCS - Pré-Fatura', 200, 50, { align: 'right' });
    doc.fontSize(10).text(`Nº: ${dados.numero}`, 200, 80, { align: 'right' });
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 200, 95, {
      align: 'right',
    });

    doc.moveDown(3);

    doc.fontSize(12).text('Dados do Cliente', { underline: true });
    doc.fontSize(10).text(`Nome: ${dados.cliente.nome}`);
    doc.text(`Email: ${dados.cliente.email}`);
    doc.moveDown();

    doc.fontSize(12).text('Itens', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1 = 50,
      col2 = 300,
      col3 = 380,
      col4 = 470;

    doc
      .rect(col1 - 5, tableTop - 5, 500, 20)
      .fill('#eeeeee')
      .stroke();
    doc.fillColor('black').fontSize(10).text('Descrição', col1, tableTop);
    doc.text('Qtd', col2, tableTop);
    doc.text('Preço Unit.', col3, tableTop);
    doc.text('Subtotal', col4, tableTop);

    doc.moveDown(1);

    dados.itens.forEach((it) => {
      const subtotal = it.quantidade * it.precoUnit;
      doc.fontSize(10).text(it.descricao, col1, doc.y);
      doc.text(String(it.quantidade), col2, doc.y);
      doc.text(`${it.precoUnit.toLocaleString()} Kz`, col3, doc.y);
      doc.text(`${subtotal.toLocaleString()} Kz`, col4, doc.y);
      doc.moveDown(0.5);
    });

    doc.moveDown(1);

    doc.moveTo(col1, doc.y).lineTo(550, doc.y).stroke();

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`Total: ${dados.total.toLocaleString()} Kz`, { align: 'right' });

    doc.font('Helvetica').moveDown();

    if (dados.observacoes) {
      doc.fontSize(10).text(`Obs: ${dados.observacoes}`, { align: 'left' });
    }

    doc.moveDown(3);
    doc.fontSize(8).text('Obrigado pela preferência!', {
      align: 'center',
    });

    doc.text(`Página ${pageNumber}`, 0, doc.page.height - 50, {
      align: 'center',
      width: doc.page.width,
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    return filePath;
  }

  cleanOldPdfs() {
    if (!fs.existsSync(this.invoicesDir)) return;
    try {
      fs.rmSync(this.invoicesDir, { recursive: true, force: true });
      this.logger.log(`Pasta removida: ${this.invoicesDir}`);
      fs.mkdirSync(this.invoicesDir, { recursive: true });
      this.logger.log(`Pasta recriada: ${this.invoicesDir}`);
    } catch (err) {
      this.logger.error(`Erro ao limpar diretório: ${(err as Error).message}`);
    }
  }
}
