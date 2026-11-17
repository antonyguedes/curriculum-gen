import PDFDocument from "pdfkit";
import type { DocModel, Style } from "./model";

const CM = 28.3465;

/**
 * PDF de coluna única com camada de texto real, emitido na ordem de leitura.
 * Sem tabelas, imagens, colunas ou header/footer; contato fica no corpo.
 */
export function renderPdf(doc: DocModel, style: Style): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const margin = style.marginCm * CM;
    const pdf = new PDFDocument({
      size: "A4",
      margin,
      info: { Title: doc.meta.title, Author: doc.meta.author, Subject: doc.meta.subject },
    });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const left = margin;
    const width = pdf.page.width - margin * 2;
    const accent = `#${style.accent}`;
    const align = style.centerHeader ? "center" : "left";
    const lineGap = 1.5;
    const gap = (n: number) => pdf.moveDown(n * style.gap);
    const ensure = (space: number) => {
      if (pdf.y > pdf.page.height - margin - space) pdf.addPage();
    };

    pdf.font("Helvetica-Bold").fontSize(style.name).fillColor(accent).text(doc.name, left, margin, { width, align });
    if (doc.headline) {
      pdf.font("Helvetica-Bold").fontSize(style.body + 1).fillColor("#000000").text(doc.headline, left, pdf.y + 2, { width, align });
    }
    pdf.font("Helvetica").fontSize(style.body - 0.5).fillColor("#000000").text(doc.contact, left, pdf.y + 2, { width, align });

    for (const b of doc.blocks) {
      pdf.fillColor("#000000");
      if (b.t === "heading") {
        gap(0.9);
        ensure(style.body * 5);
        pdf.font("Helvetica-Bold").fontSize(style.heading).fillColor(accent).text(b.text, left, pdf.y, { width });
        const y = pdf.y + 1;
        pdf.moveTo(left, y).lineTo(left + width, y).lineWidth(0.6).strokeColor(accent).stroke();
        pdf.y = y + 4;
      } else if (b.t === "para") {
        ensure(style.body * 2);
        pdf.font("Helvetica").fontSize(style.body).text(b.text, left, pdf.y, { width, lineGap, align: "left" });
        gap(0.3);
      } else if (b.t === "entry") {
        gap(0.35);
        ensure(style.body * 4);
        pdf.font("Helvetica-Bold").fontSize(style.body).text(b.bold, left, pdf.y, { width, lineGap, continued: !!b.rest });
        if (b.rest) pdf.font("Helvetica").text(` ${b.rest}`, { lineGap });
        gap(0.15);
      } else {
        ensure(style.body * 2);
        const y = pdf.y;
        pdf.font("Helvetica").fontSize(style.body).text("•", left + 2, y, { lineBreak: false });
        pdf.text(b.text, left + 13, y, { width: width - 13, lineGap, align: "left" });
        pdf.x = left;
        gap(0.12);
      }
    }

    pdf.end();
  });
}
