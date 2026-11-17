import { z } from "zod";

/** JSON Schema de um schema Zod (sem a chave $schema). */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

/**
 * Versão "estrita" exigida pelas saídas estruturadas da OpenAI (e pelo Codex):
 * todo objeto com additionalProperties: false e todas as propriedades em required.
 */
export function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v);
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as object);
    }
    return out;
  };
  return walk(jsonSchemaOf(schema)) as Record<string, unknown>;
}

/** Instruções de formato para provedores sem saída estruturada nativa (e para o modo manual). */
export function jsonInstructions(schema: z.ZodType) {
  return `FORMATO DA RESPOSTA
Responda SOMENTE com um objeto JSON válido, dentro de um bloco \`\`\`json, sem nenhum texto antes ou depois.
O JSON deve seguir exatamente este JSON Schema (todos os campos são obrigatórios):
${JSON.stringify(jsonSchemaOf(schema), null, 1)}`;
}

/** Extrai o objeto JSON de uma resposta em texto (aceita bloco ```json e texto ao redor). */
export function extractJson(text: string): unknown {
  const raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* cai no erro abaixo */
      }
    }
    throw new InvalidAnswerError(["A resposta não contém um JSON válido."]);
  }
}

/** Resposta da IA fora do formato esperado (lista de problemas legíveis). */
export class InvalidAnswerError extends Error {
  constructor(public problems: string[]) {
    super(`A resposta da IA não seguiu o formato esperado: ${problems.slice(0, 5).join("; ")}`);
  }
}

export function validate<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  throw new InvalidAnswerError(r.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`));
}
