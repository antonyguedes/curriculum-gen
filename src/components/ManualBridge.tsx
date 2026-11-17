"use client";

import { Check, ClipboardCopy, ExternalLink, MessagesSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, ErrorBox, Modal, Spinner, Textarea } from "@/components/ui";
import { CHAT_SITES, type ManualRequest } from "@/lib/ai/catalog";
import { ManualCancelled, setManualHandler } from "@/lib/manual-client";

const LONG_PROMPT = 100_000;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback para contextos sem a API de clipboard
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/**
 * Modal do modo copiar e colar: mostra o pedido para o usuário levar a qualquer chat de IA
 * e recebe a resposta de volta. Fica montado na tela principal e atende qualquer ação.
 */
export function ManualBridge() {
  const [req, setReq] = useState<ManualRequest | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [copied, setCopied] = useState<"prompt" | "fix" | null>(null);
  const [count, setCount] = useState(0);
  const pending = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  useEffect(() => {
    setManualHandler(
      (r) =>
        new Promise<void>((resolve, reject) => {
          pending.current = { resolve, reject };
          setReq(r);
          setAnswer("");
          setError(null);
          setProblems([]);
          setCopied(null);
          setCount((n) => n + 1);
        }),
    );
    return () => setManualHandler(null);
  }, []);

  const cancel = () => {
    pending.current?.reject(new ManualCancelled());
    pending.current = null;
    setReq(null);
  };

  const copy = async (what: "prompt" | "fix", text: string) => {
    await copyText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const submit = async () => {
    if (!req) return;
    setBusy(true);
    setError(null);
    setProblems([]);
    try {
      const res = await fetch("/api/ai/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: req.id, answer }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `Erro ${res.status}`);
        setProblems(data?.problems ?? []);
        return;
      }
      pending.current?.resolve();
      pending.current = null;
      setReq(null);
    } finally {
      setBusy(false);
    }
  };

  const fixPrompt = `Sua resposta não seguiu o formato pedido. Problemas encontrados:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nResponda novamente, SOMENTE com o JSON completo e corrigido, dentro de um bloco \`\`\`json.`;

  return (
    <Modal
      open={!!req}
      onClose={cancel}
      wide
      icon={<MessagesSquare />}
      title={
        <span className="flex flex-wrap items-center gap-2">
          Responda com a sua IA
          {req && <Badge tone="neon">{req.label}</Badge>}
          {count > 1 && <Badge>pedido {count}</Badge>}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={busy || answer.trim().length < 2} onClick={submit}>
            {busy ? <Spinner /> : <Check className="h-4 w-4" />} Enviar resposta
          </Button>
        </>
      }
    >
      {req && (
        <div className="space-y-5 text-sm">
          <section>
            <p className="label-mono mb-2 text-neon">1 · Copie o pedido</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={copied === "prompt" ? "secondary" : "primary"} onClick={() => copy("prompt", req.prompt)}>
                {copied === "prompt" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} {copied === "prompt" ? "Copiado" : "Copiar pedido"}
              </Button>
              <span className="font-mono text-xs text-subtle">{req.chars.toLocaleString("pt-BR")} caracteres</span>
            </div>
            {req.chars > LONG_PROMPT && (
              <p className="mt-2 text-xs text-warn">Pedido longo: alguns chats podem recusar. Se acontecer, use um modelo com mais contexto ou reduza os documentos dos projetos.</p>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-subtle hover:text-fg">Ver o pedido</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-ink/60 p-3 font-mono text-[0.7rem] leading-relaxed text-muted">
                {req.prompt}
              </pre>
            </details>
          </section>

          <section>
            <p className="label-mono mb-2 text-neon">2 · Cole numa IA</p>
            <div className="flex flex-wrap gap-1.5">
              {CHAT_SITES.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="tile tile-hover flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-fg"
                >
                  {s.name} <ExternalLink className="h-3 w-3 text-subtle" />
                </a>
              ))}
            </div>
          </section>

          <section>
            <p className="label-mono mb-2 text-neon">3 · Traga a resposta</p>
            <Textarea
              rows={4}
              maxHeight="30vh"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Cole aqui a resposta completa da IA (o bloco JSON)"
              aria-label="Resposta da IA"
              className="font-mono text-xs"
            />
          </section>

          {error && (
            <div className="space-y-2">
              <ErrorBox message={error} />
              {problems.length > 0 && (
                <Button small onClick={() => copy("fix", fixPrompt)}>
                  {copied === "fix" ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} Copiar pedido de correção para a IA
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
