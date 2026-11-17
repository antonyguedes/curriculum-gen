import { handle, json } from "@/lib/http";
import { getJob, saveJob } from "@/lib/store";

/** Marca a versão como revisada (aberta no editor): etapa "Verificar" do fluxo. */
export const POST = (_req: Request, { params }: { params: Promise<{ id: string; vid: string }> }) =>
  handle(async () => {
    const { id, vid } = await params;
    const job = await getJob(id);
    const version = job?.versions.find((v) => v.id === vid);
    if (!job || !version) return json({ error: "Versão não encontrada." }, 404);
    if (!version.reviewedAt) {
      version.reviewedAt = new Date().toISOString();
      await saveJob(job);
    }
    return json({ ok: true });
  });
