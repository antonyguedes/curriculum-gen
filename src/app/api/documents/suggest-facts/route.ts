import { z } from "zod";
import { handle, json } from "@/lib/http";
import { suggestProjectFacts } from "@/lib/pipeline";
import { getDocText } from "@/lib/store";

const Body = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  facts: z.array(z.string()).default([]),
  documents: z.array(z.object({ id: z.string().regex(/^doc_[a-z0-9]+$/), name: z.string() })).min(1, "Anexe ao menos um documento."),
});

/** Lê os documentos de um projeto e propõe fatos para o usuário revisar. Não salva nada. */
export const POST = (req: Request) =>
  handle(async () => {
    const body = Body.parse(await req.json());
    const docs = (
      await Promise.all(body.documents.map(async (d) => ({ ...d, projectId: "", text: (await getDocText(d.id)) ?? "" })))
    ).filter((d) => d.text);
    if (!docs.length) return json({ error: "Os documentos não foram encontrados. Envie-os novamente." }, 404);
    return json(await suggestProjectFacts({ name: body.name, description: body.description, facts: body.facts }, docs));
  });
