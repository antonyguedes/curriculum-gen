import { docxToText, pdfToText } from "./validate";

/** Extrai texto de PDF, DOCX ou texto puro. Lança erro com mensagem legível para formatos não suportados. */
export async function extractFileText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let text: string;
  if (name.endsWith(".pdf")) text = await pdfToText(buf);
  else if (name.endsWith(".docx")) text = await docxToText(buf);
  else if ([".txt", ".md", ".markdown"].some((ext) => name.endsWith(ext))) text = buf.toString("utf8");
  else throw new Error(`"${file.name}": formato não suportado. Envie PDF, DOCX, TXT ou Markdown.`);
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
