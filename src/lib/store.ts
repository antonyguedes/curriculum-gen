import { promises as fs } from "node:fs";
import path from "node:path";
import type { DocText } from "./documents";
import { emptyProfile, ProfileSchema, TailoredResumeSchema, type JobPosting, type Profile } from "./types";

/** Persistência local em JSON: app pessoal, um único usuário, sem banco. */
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");
const DOCS_DIR = path.join(DATA_DIR, "docs");
/** Documento enviado e ainda não salvo no perfil sobrevive à limpeza por este tempo. */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function getProfile(): Promise<Profile> {
  const raw = await readJson<unknown>(PROFILE_FILE);
  return raw ? ProfileSchema.parse(raw) : emptyProfile();
}

export async function saveProfile(profile: Profile) {
  const parsed = ProfileSchema.parse(profile);
  await writeJson(PROFILE_FILE, parsed);
  await removeOrphanDocs(parsed).catch(() => undefined);
}

/* ───────────── Documentos de projetos ───────────── */

const docFile = (id: string) => {
  if (!/^doc_[a-z0-9]+$/.test(id)) throw new Error("id de documento inválido");
  return path.join(DOCS_DIR, `${id}.txt`);
};

export async function saveDocText(id: string, text: string) {
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(docFile(id), text, "utf8");
}

export async function getDocText(id: string): Promise<string | null> {
  try {
    return await fs.readFile(docFile(id), "utf8");
  } catch {
    return null;
  }
}

/** Textos de todos os documentos referenciados no perfil (os ausentes no disco são ignorados). */
export async function getProfileDocs(profile: Profile): Promise<DocText[]> {
  const refs = profile.projects.flatMap((p) => p.documents.map((d) => ({ ...d, projectId: p.id })));
  const texts = await Promise.all(refs.map((r) => getDocText(r.id)));
  return refs.flatMap((r, i) => (texts[i] ? [{ id: r.id, projectId: r.projectId, name: r.name, text: texts[i]! }] : []));
}

async function removeOrphanDocs(profile: Profile) {
  const used = new Set(profile.projects.flatMap((p) => p.documents.map((d) => d.id)));
  const names = await fs.readdir(DOCS_DIR).catch(() => [] as string[]);
  const now = Date.now();
  for (const name of names) {
    const id = name.replace(/\.txt$/, "");
    if (used.has(id)) continue;
    const file = path.join(DOCS_DIR, name);
    const { mtimeMs } = await fs.stat(file);
    if (now - mtimeMs > ORPHAN_GRACE_MS) await fs.rm(file, { force: true });
  }
}

const jobFile = (id: string) => {
  if (!/^[a-z0-9_]+$/i.test(id)) throw new Error("id de vaga inválido");
  return path.join(JOBS_DIR, `${id}.json`);
};

export async function listJobs(): Promise<JobPosting[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(JOBS_DIR);
  } catch {
    return [];
  }
  const jobs = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => readJson<JobPosting>(path.join(JOBS_DIR, n))),
  );
  return jobs
    .filter((j): j is JobPosting => !!j)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Completa campos que versões antigas não tinham (ex.: bullets da formação). */
function normalizeJob(job: JobPosting | null): JobPosting | null {
  if (!job) return null;
  for (const v of job.versions) v.resume = TailoredResumeSchema.parse(v.resume);
  return job;
}

export const getJob = async (id: string) => normalizeJob(await readJson<JobPosting>(jobFile(id)));
export const saveJob = (job: JobPosting) => writeJson(jobFile(job.id), job);
export const deleteJob = (id: string) => fs.rm(jobFile(id), { force: true });
