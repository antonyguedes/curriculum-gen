import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { ManualRequest } from "./catalog";
import { extractJson, jsonInstructions, jsonSchemaOf, validate } from "./json";

/**
 * Modo copiar e colar. Cada chamada à IA vira um pedido identificado pelo hash do
 * conteúdo. Sem resposta guardada, a ação é interrompida com ManualRequired; o usuário
 * cola a resposta, ela é validada e guardada, e a ação é refeita: as chamadas já
 * respondidas saem do cache e o fluxo avança até o próximo pedido ou até o fim.
 */

const DIR = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "ai-manual");
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Schemas dos pedidos pendentes (para validar a resposta colada). */
const pending = new Map<string, { schema: z.ZodType; label: string }>();

export class ManualRequired extends Error {
  constructor(public request: ManualRequest) {
    super(`Aguardando a resposta manual: ${request.label}`);
  }
}

export function manualPrompt(system: string, prompt: string, schema: z.ZodType) {
  return `${system}\n\n---\n\n${prompt}\n\n---\n\n${jsonInstructions(schema)}`;
}

const answerFile = (id: string) => {
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Pedido inválido.");
  return path.join(DIR, `${id}.json`);
};

export async function askManual(o: { label: string; system: string; prompt: string; schema: z.ZodType }): Promise<unknown> {
  const id = crypto
    .createHash("sha256")
    .update(`${o.system}\u0000${o.prompt}\u0000${JSON.stringify(jsonSchemaOf(o.schema))}`)
    .digest("hex")
    .slice(0, 24);
  try {
    return JSON.parse(await fs.readFile(answerFile(id), "utf8"));
  } catch {
    /* ainda sem resposta */
  }
  pending.set(id, { schema: o.schema, label: o.label });
  const text = manualPrompt(o.system, o.prompt, o.schema);
  throw new ManualRequired({ id, label: o.label, prompt: text, chars: text.length });
}

/** Valida a resposta colada e a guarda para a próxima execução da ação. */
export async function submitManualAnswer(id: string, answer: string) {
  const entry = pending.get(id);
  if (!entry) throw new Error("Este pedido expirou (o servidor foi reiniciado). Refaça a ação para gerar o prompt de novo.");
  const value = validate(entry.schema, extractJson(answer));
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(answerFile(id), JSON.stringify(value), "utf8");
  pending.delete(id);
  // limpeza das respostas antigas
  const now = Date.now();
  for (const name of await fs.readdir(DIR).catch(() => [] as string[])) {
    const file = path.join(DIR, name);
    const { mtimeMs } = await fs.stat(file).catch(() => ({ mtimeMs: now }));
    if (now - mtimeMs > MAX_AGE_MS) await fs.rm(file, { force: true });
  }
}
