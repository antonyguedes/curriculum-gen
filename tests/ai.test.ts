import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

// Os módulos leem DATA_DIR ao carregar: importa depois de apontar para uma pasta temporária.
let ai: typeof import("@/lib/ai");
let json: typeof import("@/lib/ai/json");
let manual: typeof import("@/lib/ai/manual");

beforeAll(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-ai-test-"));
  process.env.DATA_DIR = dir;
  await fs.writeFile(path.join(dir, "ai-settings.json"), JSON.stringify({ provider: "manual" }));
  ai = await import("@/lib/ai");
  json = await import("@/lib/ai/json");
  manual = await import("@/lib/ai/manual");
});

const Schema = z.object({ titulo: z.string(), itens: z.array(z.object({ nome: z.string(), peso: z.number() })) });

describe("extração e validação de JSON", () => {
  it("aceita bloco ```json com texto ao redor, JSON puro e rejeita texto sem JSON", () => {
    const fenced = 'Claro! Aqui está:\n```json\n{"titulo":"A","itens":[{"nome":"x","peso":2}]}\n```\nAlgo mais?';
    expect(json.validate(Schema, json.extractJson(fenced))).toEqual({ titulo: "A", itens: [{ nome: "x", peso: 2 }] });
    expect(json.extractJson('texto {"titulo":"B","itens":[]} fim')).toEqual({ titulo: "B", itens: [] });
    expect(() => json.extractJson("não sei responder")).toThrow(json.InvalidAnswerError);
  });

  it("lista os problemas de forma legível", () => {
    try {
      json.validate(Schema, { titulo: 1, itens: [{ nome: "x" }] });
      throw new Error("deveria falhar");
    } catch (e) {
      const problems = (e as InstanceType<typeof json.InvalidAnswerError>).problems.join(" | ");
      expect(problems).toContain("titulo");
      expect(problems).toContain("itens.0.peso");
    }
  });

  it("schema estrito: todo objeto fecha propriedades e exige todas", () => {
    const s = json.strictJsonSchema(Schema) as { additionalProperties: boolean; required: string[]; properties: { itens: { items: { additionalProperties: boolean; required: string[] } } } };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["titulo", "itens"]);
    expect(s.properties.itens.items.additionalProperties).toBe(false);
    expect(s.properties.itens.items.required).toEqual(["nome", "peso"]);
  });
});

describe("modo copiar e colar", () => {
  it("pausa com o pedido, recusa resposta inválida, aceita a válida e segue do cache", async () => {
    const ask = () => ai.askLLM({ label: "Teste", system: "SISTEMA X", prompt: "PEDIDO Y", schema: Schema });

    let req: { id: string; label: string; prompt: string } | null = null;
    try {
      await ask();
    } catch (e) {
      expect(e).toBeInstanceOf(ai.ManualRequired);
      req = (e as InstanceType<typeof ai.ManualRequired>).request;
    }
    expect(req!.label).toBe("Teste");
    expect(req!.prompt).toContain("SISTEMA X");
    expect(req!.prompt).toContain("PEDIDO Y");
    expect(req!.prompt).toContain('"titulo"'); // o schema vai junto no pedido

    await expect(manual.submitManualAnswer(req!.id, '{"titulo": 5}')).rejects.toThrow(json.InvalidAnswerError);
    await manual.submitManualAnswer(req!.id, 'Resposta:\n```json\n{"titulo":"ok","itens":[{"nome":"a","peso":1}]}\n```');

    // a mesma ação refeita agora sai do cache, sem novo pedido
    expect(await ask()).toEqual({ titulo: "ok", itens: [{ nome: "a", peso: 1 }] });
  });

  it("o pipeline pede a análise da vaga com o nome da etapa", async () => {
    const { analyzeJob } = await import("@/lib/pipeline");
    await expect(analyzeJob("Desenvolvedor Back-end. Requisitos: Node.js, PostgreSQL e Docker. Responsabilidades: APIs REST.")).rejects.toMatchObject({
      request: { label: "Análise da vaga" },
    });
  });
});

describe("APIs no padrão OpenAI (servidor falso)", () => {
  it("tenta saída estruturada, recua para o modo JSON quando recusada e lista modelos", async () => {
    const http = await import("node:http");
    const seen: { format?: string; model?: string; hasSchemaInPrompt?: boolean }[] = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        res.setHeader("content-type", "application/json");
        if (req.url?.endsWith("/models")) return res.end(JSON.stringify({ object: "list", data: [{ id: "modelo-b", object: "model" }, { id: "modelo-a", object: "model" }] }));
        const b = JSON.parse(body);
        const user = b.messages.find((m: { role: string }) => m.role === "user").content as string;
        seen.push({ format: b.response_format?.type, model: b.model, hasSchemaInPrompt: user.includes("FORMATO DA RESPOSTA") });
        if (b.response_format?.type === "json_schema") {
          res.statusCode = 400; // este "servidor" não suporta saída estruturada estrita
          return res.end(JSON.stringify({ error: { message: "json_schema not supported" } }));
        }
        res.end(
          JSON.stringify({
            id: "x", object: "chat.completion", created: 0, model: b.model,
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '```json\n{"titulo":"via api","itens":[]}\n```' } }],
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    await fs.writeFile(
      path.join(process.env.DATA_DIR!, "ai-settings.json"),
      JSON.stringify({ provider: "openai-compatible", configs: { "openai-compatible": { baseUrl: `http://127.0.0.1:${port}/v1`, model: "modelo-a" } } }),
    );
    try {
      const r = await ai.askLLM({ label: "Teste", system: "S", prompt: "P", schema: Schema });
      expect(r).toEqual({ titulo: "via api", itens: [] });
      expect(seen.map((s) => s.format)).toEqual(["json_schema", "json_object"]);
      expect(seen[0].model).toBe("modelo-a");
      expect(seen[1].hasSchemaInPrompt).toBe(true); // no modo JSON o schema vai no prompt

      const { listModels } = await import("@/lib/ai/providers");
      const { getAiSettings } = await import("@/lib/ai/settings");
      expect(await listModels("openai-compatible", await getAiSettings())).toEqual(["modelo-a", "modelo-b"]);
    } finally {
      server.close();
    }
  });
});
