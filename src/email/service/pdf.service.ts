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
    const filePath = path.join(
      this.invoicesDir,
      `prefatura-${dados.numero}.pdf`,
    );
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text('RCS - Pré-Fatura', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Nº: ${dados.numero}`);
    doc.text(`Data: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Dados do Cliente', { underline: true });
    doc.moveDown(0.2);
    doc.fontSize(10).text(`Nome: ${dados.cliente.nome}`);
    doc.text(`Email: ${dados.cliente.email}`);
    doc.moveDown();

    doc.fontSize(12).text('Itens', { underline: true });
    doc.moveDown(0.5);

    const col1 = 50;
    const col2 = 350;
    const col3 = 450;

    doc.fontSize(10).text('Descrição', col1, doc.y);
    doc.text('Qtd', col2, doc.y);
    doc.text('Preço Unit.', col3, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    dados.itens.forEach((it) => {
      doc.text(it.descricao, col1, doc.y);
      doc.text(String(it.quantidade), col2, doc.y);
      doc.text(`${it.precoUnit.toLocaleString()} Kz`, col3, doc.y);
      doc.moveDown(0.3);
    });

    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(`Total: ${dados.total.toLocaleString()} Kz`, { align: 'right' });

    if (dados.observacoes) {
      doc.moveDown();
      doc.fontSize(10).text(`Obs: ${dados.observacoes}`);
    }

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    this.logger.log(`PDF gerado: ${filePath}`);
    return filePath;
  }

  cleanOldPdfs() {
    if (!fs.existsSync(this.invoicesDir)) return;

    fs.readdirSync(this.invoicesDir).forEach((file) => {
      const filePath = path.join(this.invoicesDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
          this.logger.log(`Arquivo removido: ${file}`);
        } else {
          this.logger.debug(`Ignorado (não é arquivo): ${file}`);
        }
      } catch (err) {
        this.logger.error(`Erro ao remover ${file}: ${(err as Error).message}`);
      }
    });
  }
}
