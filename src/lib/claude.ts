import { spawn } from "node:child_process";
import os from "node:os";
import { z } from "zod";
import { MODELS, type ModelAlias } from "./models";

/**
 * Ponte com o Claude Code instalado na máquina do usuário.
 * Roda `claude -p` em modo headless: usa o login já existente (sem API key),
 * sem ferramentas, sem MCP e sem carregar configurações de projeto.
 */

export { MODELS, type ModelAlias } from "./models";
export const DEFAULT_MODEL: ModelAlias = MODELS.includes(process.env.CLAUDE_MODEL as ModelAlias)
  ? (process.env.CLAUDE_MODEL as ModelAlias)
  : "opus";
/** Modelo rápido para tarefas pequenas de classificação. */
export const FAST_MODEL: ModelAlias = "haiku";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const TIMEOUT_MS = 8 * 60 * 1000;

interface AskOptions<T extends z.ZodType> {
  system: string;
  prompt: string;
  schema: T;
  model?: string;
}

export async function askClaude<T extends z.ZodType>(opts: AskOptions<T>): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const args = [
    "-p",
    "--output-format", "json",
    "--model", opts.model || DEFAULT_MODEL,
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--system-prompt", opts.system,
    "--json-schema", JSON.stringify(jsonSchema),
  ];

  // Variáveis de sessão não podem vazar para o processo filho.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, { env, cwd: os.tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("O Claude Code demorou demais para responder (timeout)."));
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        e.code === "ENOENT"
          ? new Error("Claude Code não encontrado. Instale-o e faça login com `claude` antes de usar o app.")
          : e,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (out.trim()) resolve(out);
      else reject(new Error(`Claude Code saiu com código ${code}: ${err.trim().slice(0, 500) || "sem saída"}`));
    });
    child.stdin.end(opts.prompt);
  });

  let envelope: { is_error?: boolean; result?: string; structured_output?: unknown };
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new Error(`Resposta inesperada do Claude Code: ${stdout.slice(0, 300)}`);
  }
  if (envelope.is_error) {
    throw new Error(`Claude Code retornou erro: ${String(envelope.result).slice(0, 500)}`);
  }

  let data = envelope.structured_output;
  if (data === undefined || data === null) {
    try {
      data = JSON.parse(envelope.result ?? "");
    } catch {
      throw new Error("O Claude Code não devolveu a saída estruturada esperada.");
    }
  }
  return opts.schema.parse(data);
}
