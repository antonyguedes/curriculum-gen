import { DOC_EXTENSIONS, DOC_MAX_BYTES } from "@/lib/documents";
import { extractFileText } from "@/lib/extract";
import { handle, json } from "@/lib/http";
import { saveDocText } from "@/lib/store";
import { uid, type DocumentRef } from "@/lib/types";

/**
 * Recebe um ou mais documentos, extrai o texto e o guarda em disco.
 * Devolve as referências para a interface incluir no projeto; elas só ficam
 * permanentes quando o perfil é salvo.
 */
export const POST = (req: Request) =>
  handle(async () => {
    const files = (await req.formData()).getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return json({ error: "Nenhum arquivo enviado." }, 400);

    const documents: DocumentRef[] = [];
    const errors: string[] = [];
    for (const file of files) {
      if (!DOC_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        errors.push(`"${file.name}": formato não suportado. Envie PDF, DOCX, TXT ou Markdown.`);
        continue;
      }
      if (file.size > DOC_MAX_BYTES) {
        errors.push(`"${file.name}": maior que 10 MB.`);
        continue;
      }
      try {
        const text = await extractFileText(file);
        if (text.length < 20) {
          errors.push(`"${file.name}": quase nenhum texto extraído (PDF escaneado como imagem?).`);
          continue;
        }
        const id = uid("doc");
        await saveDocText(id, text);
        documents.push({ id, name: file.name, size: file.size, chars: text.length, addedAt: new Date().toISOString() });
      } catch (e) {
        errors.push(`"${file.name}": ${(e as Error).message}`);
      }
    }
    return json({ documents, errors });
  });
