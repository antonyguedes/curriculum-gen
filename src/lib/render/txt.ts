import type { DocModel } from "./model";

/** Versão em texto puro, para colar nos campos de formulário (Gupy, Workday). */
export function renderTxt(doc: DocModel): string {
  const out: string[] = [doc.name];
  if (doc.headline) out.push(doc.headline);
  out.push(doc.contact);
  for (const b of doc.blocks) {
    if (b.t === "heading") out.push("", b.text.toUpperCase());
    else if (b.t === "para") out.push(b.text);
    else if (b.t === "entry") out.push("", [b.bold, b.rest].filter(Boolean).join(" "));
    else out.push(`- ${b.text}`);
  }
  return out.join("\n") + "\n";
}
