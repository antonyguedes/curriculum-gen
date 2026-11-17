import { z } from "zod";
import { ManualRequired } from "@/lib/ai";
import { fail, json } from "@/lib/http";
import { findAdjacency, generateVersion } from "@/lib/pipeline";
import { getJob, getProfile, getProfileDocs, saveJob } from "@/lib/store";
import { TemperatureSchema, TemplateSchema } from "@/lib/types";

const Body = z.object({
  temperature: TemperatureSchema.default("equilibrado"),
  template: TemplateSchema.default("classico"),
  model: z.string().optional(),
  coverLetter: z.boolean().default(false),
  notes: z.string().default(""),
});

/** Gera uma versão transmitindo o progresso em NDJSON (uma linha JSON por evento). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let opts: z.infer<typeof Body>;
  try {
    opts = Body.parse(await req.json());
  } catch (e) {
    return fail(e, 400);
  }
  const { id } = await params;
  const [job, profile] = await Promise.all([getJob(id), getProfile()]);
  if (!job) return json({ error: "Vaga não encontrada." }, 404);
  if (!profile.contact.name.trim() || profile.experiences.length + profile.projects.length === 0)
    return json({ error: "Preencha o perfil (nome e ao menos uma experiência ou projeto) antes de gerar." }, 400);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(enc.encode(JSON.stringify(event) + "\n"));
      try {
        // O perfil pode ter mudado desde a análise (ex.: lacunas preenchidas): atualiza as adjacências.
        send({ type: "progress", step: "Mapeando a cobertura dos requisitos" });
        const docs = await getProfileDocs(profile);
        job.adjacency = await findAdjacency(profile, job.analysis, docs);
        const version = await generateVersion(profile, job, opts, (step, detail) => send({ type: "progress", step, detail }), docs);
        // Relê a vaga: outra aba pode ter salvo algo enquanto a geração rodava.
        const fresh = (await getJob(id)) ?? job;
        fresh.adjacency = job.adjacency;
        fresh.versions.unshift(version);
        await saveJob(fresh);
        send({ type: "done", versionId: version.id });
      } catch (e) {
        if (e instanceof ManualRequired) send({ type: "manual", request: e.request });
        else send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
