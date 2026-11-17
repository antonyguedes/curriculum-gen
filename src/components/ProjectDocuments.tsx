"use client";

import { useRef, useState } from "react";
import { Badge, Button, ErrorBox, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { DOC_EXTENSIONS, DOC_PROMPT_CHARS, DOCS_PER_PROJECT } from "@/lib/documents";
import { uid, type DocumentRef, type Fact, type Project } from "@/lib/types";

interface Suggestion {
  text: string;
  skills: string[];
  sourceDoc: string;
  selected: boolean;
}

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Documentos de apoio de um projeto: upload, lista e sugestão de fatos a partir deles. */
export function ProjectDocuments({
  project,
  onDocuments,
  onAddFacts,
}: {
  project: Project;
  onDocuments: (docs: DocumentRef[]) => void;
  onAddFacts: (facts: Fact[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [truncated, setTruncated] = useState<string[]>([]);
  const docs = project.documents;
  const slots = DOCS_PER_PROJECT - docs.length;

  const upload = async (files: File[]) => {
    const accepted = files.slice(0, slots);
    const skipped = files.slice(slots).map((f) => `"${f.name}": limite de ${DOCS_PER_PROJECT} documentos por projeto.`);
    if (!accepted.length) return setErrors(skipped);
    setUploading(true);
    setErrors([]);
    try {
      const form = new FormData();
      accepted.forEach((f) => form.append("file", f));
      const res = await api<{ documents: DocumentRef[]; errors: string[] }>("/api/documents", { method: "POST", body: form });
      if (res.documents.length) onDocuments([...docs, ...res.documents]);
      setErrors([...res.errors, ...skipped]);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    setErrors([]);
    setSuggestions(null);
    try {
      const res = await api<{ facts: Omit<Suggestion, "selected">[]; truncated: string[] }>("/api/documents/suggest-facts", {
        method: "POST",
        json: {
          name: project.name,
          description: project.description,
          facts: project.facts.map((f) => f.text).filter(Boolean),
          documents: docs.map((d) => ({ id: d.id, name: d.name })),
        },
      });
      setSuggestions(res.facts.map((f) => ({ ...f, selected: true })));
      setTruncated(res.truncated);
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setSuggesting(false);
    }
  };

  const addSelected = () => {
    const chosen = (suggestions ?? []).filter((s) => s.selected);
    onAddFacts(chosen.map((s) => ({ id: uid("f"), text: s.text, skills: s.skills })));
    setSuggestions(null);
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-line-strong p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs font-medium text-muted">Documentos do projeto ({docs.length} de {DOCS_PER_PROJECT})</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOC_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => e.target.files?.length && upload([...e.target.files])}
        />
        <Button small disabled={uploading || slots <= 0} onClick={() => inputRef.current?.click()}>
          {uploading && <Spinner />} {uploading ? "Lendo…" : "+ Anexar documento"}
        </Button>
        {docs.length > 0 && (
          <Button small variant="primary" disabled={suggesting} onClick={suggest}>
            {suggesting && <Spinner />} {suggesting ? "Lendo documentos…" : "Sugerir fatos"}
          </Button>
        )}
      </div>


      {docs.length > 0 && (
        <ul className="divide-y divide-line/70 rounded-lg border border-line bg-panel-2/60">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-fg" title={d.name}>
                {d.name}
              </span>
              {d.chars > DOC_PROMPT_CHARS && (
                <Badge tone="amber" title={`O documento tem ${d.chars.toLocaleString("pt-BR")} caracteres; a IA lê os primeiros ${DOC_PROMPT_CHARS.toLocaleString("pt-BR")}. Para ela ver o resto, divida o arquivo.`}>
                  lido em parte
                </Badge>
              )}
              <span className="text-xs text-subtle">
                {kb(d.size)} · {d.chars.toLocaleString("pt-BR")} caracteres
              </span>
              <Button small variant="danger" onClick={() => onDocuments(docs.filter((x) => x.id !== d.id))} aria-label={`Remover ${d.name}`}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && <ErrorBox message={errors.join(" ")} />}

      {suggestions && (
        <div className="space-y-2 rounded-lg border border-neon/30 bg-neon/5 p-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-fg/85">Nada novo encontrado.</p>
          ) : (
            <>
              {truncated.length > 0 && <p className="text-xs text-warn">Lidos em parte por serem longos: {truncated.join(", ")}.</p>}
              <ul className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-sm text-fg">
                      <input
                        type="checkbox"
                        className="mt-1 accent-neon"
                        checked={s.selected}
                        onChange={(e) => setSuggestions(suggestions.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                      />
                      <span>
                        {s.text}
                        <span className="block text-xs text-subtle">
                          {[s.skills.join(", "), s.sourceDoc && `de ${s.sourceDoc}`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            {suggestions.some((s) => s.selected) && (
              <Button small variant="primary" onClick={addSelected}>
                Adicionar {suggestions.filter((s) => s.selected).length} fato(s) ao projeto
              </Button>
            )}
            <Button small variant="ghost" onClick={() => setSuggestions(null)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
