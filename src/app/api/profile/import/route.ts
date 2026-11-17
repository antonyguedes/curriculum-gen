import { extractFileText } from "@/lib/extract";
import { handle, json } from "@/lib/http";
import { importProfile } from "@/lib/pipeline";

const MAX_BYTES = 10 * 1024 * 1024;

/** Lê um currículo (PDF, DOCX ou texto) e devolve um perfil para revisão. Não salva nada. */
export const POST = (req: Request) =>
  handle(async () => {
    const form = await req.formData();
    const file = form.get("file");
    let text = String(form.get("text") ?? "");

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) return json({ error: "Arquivo maior que 10 MB." }, 400);
      try {
        text = await extractFileText(file);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
    }

    if (text.trim().length < 80)
      return json({ error: "Não foi possível extrair texto suficiente. O PDF pode ser uma imagem escaneada." }, 400);
    return json(await importProfile(text));
  });
