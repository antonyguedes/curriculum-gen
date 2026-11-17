"use client";

import { FileSearch, Link2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, ErrorBox, Input, Spinner, Textarea } from "@/components/ui";
import { api } from "@/lib/api";

const MIN_CHARS = 80;

/** Formulário de nova vaga, aberto no painel da etapa "Vaga". */
export function NewJobForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [rawText, setRawText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chars = rawText.trim().length;
  const ready = chars >= MIN_CHARS;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/jobs", { method: "POST", json: { rawText, url } });
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div>
      <Card title="Nova vaga" icon={<FileSearch />}>
        <div className="space-y-3">
          <div className="relative">
            <Textarea
              rows={3}
              autoFocus
              value={rawText}
              disabled={busy}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
              }}
              placeholder="Cole aqui o texto completo da vaga"
              aria-label="Descrição da vaga"
            />
            {busy && (
              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
                <span className="absolute inset-y-0 w-1/3 animate-scan bg-gradient-to-r from-transparent via-neon/15 to-transparent" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-subtle" strokeWidth={1.8} aria-hidden />
            <Input value={url} disabled={busy} onChange={(e) => setUrl(e.target.value)} placeholder="Link da vaga (opcional)" aria-label="Link da vaga" />
          </div>

          <ErrorBox message={error} />

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="flex items-center gap-2 font-mono text-[0.7rem] text-subtle" aria-live="polite">
              {/* barra de progresso até o mínimo de caracteres */}
              <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full transition-all duration-300 ${ready ? "bg-gradient-to-r from-neon to-ok" : "bg-subtle"}`}
                  style={{ width: `${Math.min(100, (chars / MIN_CHARS) * 100)}%` }}
                />
              </span>
              {ready ? `${chars.toLocaleString("pt-BR")} caracteres` : `${chars}/${MIN_CHARS}`}
            </span>
            <Button variant="primary" disabled={!ready || busy} onClick={submit} title="Ctrl + Enter">
              {busy && <Spinner />} {busy ? "Analisando…" : "Analisar vaga"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
