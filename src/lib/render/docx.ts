import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TextRun } from "docx";
import type { DocModel, Style } from "./model";

const TWIPS_PER_CM = 567;
const FONT = "Calibri";

/** DOCX só com parágrafos e estilos nativos (Heading 1, lista com marcadores). */
export async function renderDocx(doc: DocModel, style: Style): Promise<Buffer> {
  const half = (pt: number) => Math.round(pt * 2);
  const align = style.centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT;
  const margin = Math.round(style.marginCm * TWIPS_PER_CM);

  const children: Paragraph[] = [
    new Paragraph({
      alignment: align,
      spacing: { after: 40 },
      children: [new TextRun({ text: doc.name, bold: true, size: half(style.name), color: style.accent, font: FONT })],
    }),
  ];
  if (doc.headline)
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 40 },
        children: [new TextRun({ text: doc.headline, bold: true, size: half(style.body + 1), font: FONT })],
      }),
    );
  children.push(
    new Paragraph({
      alignment: align,
      spacing: { after: 80 },
      children: [new TextRun({ text: doc.contact, size: half(style.body - 0.5), font: FONT })],
    }),
  );

  for (const b of doc.blocks) {
    if (b.t === "heading") {
      children.push(new Paragraph({ style: "Heading1", children: [new TextRun({ text: b.text })] }));
    } else if (b.t === "para") {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.text })] }));
    } else if (b.t === "entry") {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          keepNext: true,
          children: [new TextRun({ text: b.bold, bold: true }), ...(b.rest ? [new TextRun({ text: ` ${b.rest}` })] : [])],
        }),
      );
    } else {
      children.push(
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 30 }, children: [new TextRun({ text: b.text })] }),
      );
    }
  }

  const document = new Document({
    creator: doc.meta.author,
    title: doc.meta.title,
    subject: doc.meta.subject,
    styles: {
      default: { document: { run: { font: FONT, size: half(style.body) } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: half(style.heading), color: style.accent, font: FONT },
          paragraph: {
            spacing: { before: 220, after: 80 },
            keepNext: true,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: style.accent, space: 1 } },
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 220 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: margin, bottom: margin, left: margin, right: margin } } },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
