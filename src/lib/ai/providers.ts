import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import OpenAI from "openai";
import type { z } from "zod";
import { PROVIDERS, type AiSettings, type ProviderId } from "./catalog";
import { runCli } from "./cli";
import { jsonInstructions, jsonSchemaOf, strictJsonSchema } from "./json";
import { resolveBaseUrl, resolveKey } from "./settings";

export interface CallOptions {
  label: string;
  system: string;
  prompt: string;
  schema: z.ZodType;
  model: string;
  fast: boolean;
}

/** Linux: cada argumento de linha de comando tem no máximo 128 KB. */
const ARG_LIMIT = 120_000;

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "curriculo-ai-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const tail = (s: string) => s.trim().split("\n").slice(-6).join(" ").slice(0, 600);

/* ───────────── Agentes locais ───────────── */

async function claudeCode(o: CallOptions): Promise<unknown> {
  const args = [
    "-p",
    "--output-format", "json",
    "--model", o.model,
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--system-prompt", o.system,
    "--json-schema", JSON.stringify(jsonSchemaOf(o.schema)),
  ];
  const { stdout, stderr, code } = await runCli("claude-code", args, { stdin: o.prompt, cwd: os.tmpdir() });
  if (!stdout.trim()) throw new Error(`Claude Code saiu com código ${code}: ${tail(stderr) || "sem saída"}`);
  let env: { is_error?: boolean; result?: string; structured_output?: unknown };
  try {
    env = JSON.parse(stdout);
  } catch {
    throw new Error(`Resposta inesperada do Claude Code: ${stdout.slice(0, 300)}`);
  }
  if (env.is_error) throw new Error(`Claude Code retornou erro: ${String(env.result).slice(0, 500)}`);
  return env.structured_output ?? env.result ?? "";
}

/** Codex CLI: `codex exec -` lê o prompt da entrada; --output-schema + -o gravam o JSON final. */
async function codexCli(o: CallOptions): Promise<unknown> {
  return withTempDir(async (dir) => {
    const schemaFile = path.join(dir, "schema.json");
    const outFile = path.join(dir, "resposta.json");
    await fs.writeFile(schemaFile, JSON.stringify(strictJsonSchema(o.schema)));
    const { stderr, code } = await runCli(
      "codex-cli",
      ["exec", "-", "--skip-git-repo-check", "--output-schema", schemaFile, "-o", outFile],
      { stdin: `${o.system}\n\n---\n\n${o.prompt}`, cwd: dir },
    );
    const out = await fs.readFile(outFile, "utf8").catch(() => "");
    if (!out.trim()) throw new Error(`Codex CLI não devolveu resposta (código ${code}): ${tail(stderr) || "sem detalhes"}`);
    return out;
  });
}

function checkArgSize(label: string, text: string) {
  if (Buffer.byteLength(text) > ARG_LIMIT)
    throw new Error(`O pedido ficou grande demais para o ${label} (o sistema limita cada argumento a 128 KB). Remova documentos longos dos projetos ou use outro motor de IA.`);
}

/** Antigravity CLI (agy): -p com saída json e --json-schema; o objeto vem em structured_output. */
async function antigravityCli(o: CallOptions): Promise<unknown> {
  const full = `${o.system}\n\n---\n\n${o.prompt}`;
  checkArgSize("Antigravity CLI", full);
  return withTempDir(async (dir) => {
    const schemaFile = path.join(dir, "schema.json");
    await fs.writeFile(schemaFile, JSON.stringify(jsonSchemaOf(o.schema)));
    const args = ["-p", full, "--output-format", "json", "--json-schema", schemaFile];
    if (o.model) args.push("--model", o.model);
    const { stdout, stderr, code } = await runCli("antigravity-cli", args, { cwd: dir });
    let j: { response?: string; structured_output?: unknown; error?: unknown };
    try {
      j = JSON.parse(stdout);
    } catch {
      throw new Error(`Antigravity CLI não devolveu JSON (código ${code}): ${tail(stderr || stdout) || "sem saída"}`);
    }
    if (j.error) throw new Error(`Antigravity CLI retornou erro: ${JSON.stringify(j.error).slice(0, 400)}`);
    return j.structured_output ?? j.response ?? "";
  });
}

/** Gemini CLI (legado): -p com --output-format json; o texto vem em "response". */
async function geminiCli(o: CallOptions): Promise<unknown> {
  const full = `${o.system}\n\n---\n\n${o.prompt}\n\n---\n\n${jsonInstructions(o.schema)}`;
  checkArgSize("Gemini CLI", full);
  return withTempDir(async (dir) => {
    const { stdout, stderr, code } = await runCli("gemini-cli", ["-p", full, "--output-format", "json"], { cwd: dir });
    let j: { response?: string; error?: unknown };
    try {
      j = JSON.parse(stdout);
    } catch {
      throw new Error(`Gemini CLI não devolveu JSON (código ${code}): ${tail(stderr || stdout) || "sem saída"}`);
    }
    if (j.error) throw new Error(`Gemini CLI retornou erro: ${JSON.stringify(j.error).slice(0, 400)}`);
    return j.response ?? "";
  });
}

/* ───────────── API da Anthropic (SDK oficial) ───────────── */

/** Modelos com fallback no servidor em caso de recusa (Anthropic). */
const SERVER_FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

async function anthropicApi(o: CallOptions, settings: AiSettings): Promise<unknown> {
  const apiKey = resolveKey(settings, "anthropic");
  if (!apiKey) throw new Error("Configure a chave da Anthropic API (ou a variável ANTHROPIC_API_KEY).");
  const client = new Anthropic({ apiKey });
  const fallback = SERVER_FALLBACK_MODELS.has(o.model);
  try {
    const res = await client.beta.messages.parse(
      {
        model: o.model,
        max_tokens: 32000,
        system: o.system,
        messages: [{ role: "user", content: o.prompt }],
        output_config: { format: betaZodOutputFormat(o.schema), effort: o.fast ? "low" : "high" },
        // Se o modelo recusar o pedido, a própria API refaz com um modelo de fallback.
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      },
      { timeout: 15 * 60 * 1000 },
    );
    if (res.stop_reason === "refusal") throw new Error("O modelo recusou o pedido. Tente outro modelo.");
    if (res.stop_reason === "max_tokens") throw new Error("A resposta foi cortada por limite de tamanho.");
    if (res.parsed_output == null) throw new Error("A Anthropic API não devolveu a saída estruturada.");
    return res.parsed_output;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("Chave da Anthropic API inválida.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error("A chave da Anthropic API não tem acesso a este modelo.");
    if (e instanceof Anthropic.NotFoundError) throw new Error(`Modelo "${o.model}" não encontrado na Anthropic API.`);
    if (e instanceof Anthropic.RateLimitError) throw new Error("Limite de uso da Anthropic API atingido. Tente de novo em instantes.");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Não foi possível conectar à Anthropic API.");
    throw e;
  }
}

/* ───────────── APIs no padrão OpenAI (OpenAI, Gemini, OpenRouter, Ollama, outras) ───────────── */

function openaiClient(id: ProviderId, settings: AiSettings) {
  const info = PROVIDERS[id];
  const apiKey = resolveKey(settings, id);
  const baseURL = resolveBaseUrl(settings, id);
  if (info.key === "required" && !apiKey) throw new Error(`Configure a chave da ${info.label}${info.keyEnv ? ` (ou a variável ${info.keyEnv})` : ""}.`);
  if (info.baseUrlEditable && !baseURL) throw new Error(`Informe a URL base da ${info.label}.`);
  // Servidores locais (Ollama, LM Studio) ignoram a chave, mas o SDK exige uma.
  return { client: new OpenAI({ apiKey: apiKey || "sem-chave", baseURL: baseURL || undefined }), baseURL };
}

async function openaiCompatible(o: CallOptions, id: ProviderId, settings: AiSettings): Promise<unknown> {
  const info = PROVIDERS[id];
  const { client, baseURL } = openaiClient(id, settings);
  const messages = (extra = "") => [
    { role: "system" as const, content: o.system },
    { role: "user" as const, content: o.prompt + extra },
  ];
  // 1º: saída estruturada estrita; 2º: modo JSON; 3º: só instruções no prompt.
  const attempts = [
    () => client.chat.completions.create({ model: o.model, messages: messages(), response_format: { type: "json_schema", json_schema: { name: "resposta", schema: strictJsonSchema(o.schema), strict: true } } }),
    () => client.chat.completions.create({ model: o.model, messages: messages(`\n\n---\n\n${jsonInstructions(o.schema)}`), response_format: { type: "json_object" } }),
    () => client.chat.completions.create({ model: o.model, messages: messages(`\n\n---\n\n${jsonInstructions(o.schema)}`) }),
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      const choice = res.choices[0];
      if (choice?.message?.refusal) throw new Error(`O modelo recusou o pedido: ${choice.message.refusal}`);
      if (choice?.finish_reason === "length") throw new Error("A resposta foi cortada por limite de tamanho. Use um modelo com mais contexto.");
      return choice?.message?.content ?? "";
    } catch (e) {
      lastError = e;
      // Formato não suportado por este modelo/servidor: tenta o próximo modo.
      if (e instanceof OpenAI.BadRequestError || e instanceof OpenAI.UnprocessableEntityError) continue;
      if (e instanceof OpenAI.AuthenticationError) throw new Error(`Chave da ${info.label} inválida.`);
      if (e instanceof OpenAI.NotFoundError) throw new Error(`Modelo "${o.model}" não encontrado em ${info.label}.`);
      if (e instanceof OpenAI.RateLimitError) throw new Error(`Limite de uso da ${info.label} atingido. Tente de novo em instantes.`);
      if (e instanceof OpenAI.APIConnectionError)
        throw new Error(id === "ollama" ? `Não foi possível conectar ao Ollama em ${baseURL}. Ele está aberto?` : `Não foi possível conectar a ${baseURL || info.label}.`);
      throw e;
    }
  }
  throw lastError instanceof Error ? new Error(`${info.label} recusou o pedido: ${lastError.message}`) : new Error(`${info.label} recusou o pedido.`);
}

/* ───────────── despacho ───────────── */

export async function runProvider(id: ProviderId, settings: AiSettings, o: CallOptions): Promise<unknown> {
  switch (id) {
    case "claude-code":
      return claudeCode(o);
    case "codex-cli":
      return codexCli(o);
    case "antigravity-cli":
      return antigravityCli(o);
    case "gemini-cli":
      return geminiCli(o);
    case "anthropic":
      return anthropicApi(o, settings);
    case "openai":
    case "gemini-api":
    case "openrouter":
    case "openai-compatible":
    case "ollama":
      return openaiCompatible(o, id, settings);
    case "manual":
      throw new Error("O modo manual é tratado em askLLM.");
  }
}

/** Modelos disponíveis na conta/servidor (para escolher na tela de configurações). */
export async function listModels(id: ProviderId, settings: AiSettings): Promise<string[]> {
  if (id === "anthropic") {
    const apiKey = resolveKey(settings, "anthropic");
    if (!apiKey) throw new Error("Configure a chave da Anthropic API primeiro.");
    const client = new Anthropic({ apiKey });
    const ids: string[] = [];
    for await (const m of client.models.list()) ids.push(m.id);
    return ids;
  }
  if (!PROVIDERS[id].listModels) return PROVIDERS[id].models ?? [];
  const { client } = openaiClient(id, settings);
  const ids: string[] = [];
  for await (const m of client.models.list()) ids.push(m.id);
  return ids.sort((a, b) => a.localeCompare(b));
}
