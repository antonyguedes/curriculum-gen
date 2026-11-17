import { spawn } from "node:child_process";
import { PROVIDERS, type ProviderId } from "./catalog";

const TIMEOUT_MS = 10 * 60 * 1000;

/** Executa uma CLI de agente sem shell, com entrada opcional e tempo-limite. */
export function runCli(id: ProviderId, args: string[], opts: { stdin?: string; cwd: string }) {
  const info = PROVIDERS[id];
  const bin = info.bin!;
  // Variáveis de sessão do Claude Code não podem vazar para processos filhos.
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn(bin, args, { env, cwd: opts.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${info.label} demorou demais para responder (mais de 10 minutos).`));
    }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        e.code === "ENOENT"
          ? new Error(`${info.label} não está instalado (comando "${bin}" não encontrado).${info.install ? ` Instale com: ${info.install}` : ""}`)
          : e,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(opts.stdin ?? "");
  });
}

/** Versão instalada (ou null), para a tela de configurações. */
export async function cliVersion(id: ProviderId): Promise<string | null> {
  try {
    const { stdout, code } = await runCli(id, ["--version"], { cwd: process.cwd() });
    return code === 0 ? stdout.trim().split("\n")[0].slice(0, 60) : null;
  } catch {
    return null;
  }
}
