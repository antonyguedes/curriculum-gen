import { z } from "zod";
import { handle, json } from "@/lib/http";
import { generateCoverLetter } from "@/lib/pipeline";
import { getJob, saveJob } from "@/lib/store";

const Body = z.object({ notes: z.string().default("") });

/** Gera (ou regenera) a carta de apresentação a partir do currículo atual desta versão. */
export const POST = (req: Request, { params }: { params: Promise<{ id: string; vid: string }> }) =>
  handle(async () => {
    const { id, vid } = await params;
    const { notes } = Body.parse(await req.json().catch(() => ({})));
    const job = await getJob(id);
    const version = job?.versions.find((v) => v.id === vid);
    if (!job || !version) return json({ error: "Versão não encontrada." }, 404);

    const letter = await generateCoverLetter(job.analysis, version.resume, version.temperature, notes, version.model);
    const fresh = (await getJob(id)) ?? job;
    const target = fresh.versions.find((v) => v.id === vid);
    if (target) target.coverLetter = letter;
    await saveJob(fresh);
    return json(letter);
  });
