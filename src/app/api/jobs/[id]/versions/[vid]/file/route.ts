import { handle, json } from "@/lib/http";
import { renderDocx } from "@/lib/render/docx";
import { buildCoverLetterDoc, buildResumeDoc, fileBaseName, STYLES } from "@/lib/render/model";
import { renderPdf } from "@/lib/render/pdf";
import { renderTxt } from "@/lib/render/txt";
import { getJob, getProfile, saveJob } from "@/lib/store";

const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
} as const;

/** Renderiza sob demanda: o arquivo baixado sempre reflete a última edição salva. */
export const GET = (req: Request, { params }: { params: Promise<{ id: string; vid: string }> }) =>
  handle(async () => {
    const { id, vid } = await params;
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "pdf") as keyof typeof TYPES;
    const isCover = url.searchParams.get("doc") === "cover";
    if (!(format in TYPES)) return json({ error: "Formato inválido." }, 400);

    const [job, profile] = await Promise.all([getJob(id), getProfile()]);
    const version = job?.versions.find((v) => v.id === vid);
    if (!job || !version) return json({ error: "Versão não encontrada." }, 404);
    if (isCover && !version.coverLetter) return json({ error: "Esta versão não tem carta de apresentação." }, 404);

    const { job_title, company } = job.analysis;
    const lang = version.resume.language;
    const doc = isCover
      ? buildCoverLetterDoc(version.coverLetter!, profile.contact, job_title, lang)
      : buildResumeDoc(version.resume, profile.contact, job_title);
    const style = STYLES[version.template];
    const body: Buffer | string =
      format === "pdf" ? await renderPdf(doc, style) : format === "docx" ? await renderDocx(doc, style) : renderTxt(doc);

    const filename = `${fileBaseName(profile.contact.name, job_title, company, isCover, lang)}.${format}`;
    const disposition = url.searchParams.get("inline") ? "inline" : "attachment";
    if (disposition === "attachment" && !version.downloadedAt) {
      version.downloadedAt = new Date().toISOString();
      await saveJob(job);
    }
    return new Response(typeof body === "string" ? body : new Uint8Array(body), {
      headers: {
        "content-type": TYPES[format],
        "content-disposition": `${disposition}; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  });
