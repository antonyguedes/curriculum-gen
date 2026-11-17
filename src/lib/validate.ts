import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { DocModel } from "./render/model";
import type { ParseReport } from "./types";

/** Compara sem espaços: quebras de linha do layout não contam como perda. */
const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export async function pdfToText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function docxToText(buf: Buffer): Promise<string> {
  return (await mammoth.extractRawText({ buffer: buf })).value;
}

/** Cada trecho que um ATS precisa conseguir ler de volta do arquivo. */
export function expectedStrings(doc: DocModel): string[] {
  const out = [doc.name, doc.headline, ...doc.contact.split(" | ")];
  for (const b of doc.blocks) {
    if (b.t === "entry") out.push(b.bold, b.rest);
    else out.push(b.text);
  }
  return out.filter((s) => s.trim());
}

function check(extracted: string, expected: string[]) {
  const hay = squash(extracted);
  const missing: string[] = [];
  let cursor = 0;
  let ordered = true;
  for (const e of expected) {
    const needle = squash(e);
    const at = hay.indexOf(needle);
    if (at === -1) {
      missing.push(e);
      continue;
    }
    // A ordem de leitura também precisa ser preservada.
    const next = hay.indexOf(needle, cursor);
    if (next === -1) ordered = false;
    else cursor = next;
  }
  if (!ordered) missing.push("(ordem de leitura diferente da original)");
  const fidelity = expected.length ? Math.round(((expected.length - missing.length) / expected.length) * 100) : 100;
  return { fidelity: Math.max(0, fidelity), missing };
}

/** Parse-back: lê os arquivos gerados como um ATS faria e confere com a origem. */
export async function validateParse(doc: DocModel, pdf: Buffer, docx: Buffer): Promise<ParseReport> {
  const expected = expectedStrings(doc);
  const [pdfText, docxText] = await Promise.all([pdfToText(pdf), docxToText(docx)]);
  return { pdf: check(pdfText, expected), docx: check(docxText, expected) };
}
