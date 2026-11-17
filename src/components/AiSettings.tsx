"use client";

import { Bot, Check, Copy, ExternalLink, Eye, EyeOff, HardDrive, KeyRound, MessagesSquare, RefreshCw, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, ErrorBox, Field, Input, Loading, Select, Spinner, cx, type Tone } from "@/components/ui";
import { api } from "@/lib/api";
import { CHAT_SITES, GROUP_LABELS, PROVIDER_IDS, PROVIDERS, type ProviderGroup, type ProviderId, type PublicAiSettings } from "@/lib/ai/catalog";

interface Detection {
  installed: Partial<Record<ProviderId, string | null>>;
  ollama: { running: boolean; models: string[] };
}

const GROUP_ICON: Record<ProviderGroup, LucideIcon> = { agent: Bot, api: KeyRound, local: HardDrive, manual: MessagesSquare };
const GROUPS: ProviderGroup[] = ["agent", "api", "local", "manual"];

/** Estado de cada provedor nesta máquina. */
function status(id: ProviderId, s: PublicAiSettings, d: Detection | null): { tone: Tone; text: string } {
  const info = PROVIDERS[id];
  if (info.group === "agent") {
    if (!d) return { tone: "slate", text: "verificando…" };
    return d.installed[id] ? { tone: "green", text: "instalado" } : { tone: "slate", text: "não instalado" };
  }
  if (id === "ollama") {
    if (!d) return { tone: "slate", text: "verificando…" };
    return d.ollama.running ? { tone: "green", text: `rodando · ${d.ollama.models.length} modelo(s)` } : { tone: "slate", text: "parado" };
  }
  if (id === "manual") return { tone: "blue", text: "sem configuração" };
  const c = s.configs[id];
  if (info.key === "required") return c.hasKey ? { tone: "green", text: c.keyFromEnv ? "chave do ambiente" : "chave ok" } : { tone: "slate", text: "sem chave" };
  return c.baseUrl ? { tone: "green", text: "configurado" } : { tone: "slate", text: "não configurado" };
}

/** Painel "Motor de IA": escolhe e configura quem gera os currículos. */
export function AiSettings({ onChanged }: { onChanged?: () => void }) {
  const [settings, setSettings] = useState<PublicAiSettings | null>(null);
  const [detect, setDetect] = useState<Detection | null>(null);
  const [selected, setSelected] = useState<ProviderId>("claude-code");
  const [form, setForm] = useState({ apiKey: "", model: "", fastModel: "", baseUrl: "" });
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"save" | "test" | "models" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  /** Escolher um provedor leva ao formulário dele (fica abaixo da lista). */
  const choose = (id: ProviderId) => {
    setSelected(id);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const loadDetect = () => api<Detection>("/api/ai/detect").then(setDetect).catch(() => undefined);
  useEffect(() => {
    api<PublicAiSettings>("/api/ai/settings")
      .then((s) => {
        setSettings(s);
        setSelected(s.provider);
      })
      .catch((e) => setError(e.message));
    loadDetect();
  }, []);

  // Ao trocar de provedor, o formulário mostra o que está salvo para ele.
  useEffect(() => {
    if (!settings) return;
    const c = settings.configs[selected];
    setForm({ apiKey: "", model: c.model, fastModel: c.fastModel, baseUrl: c.baseUrl });
    setModels(selected === "ollama" ? (detect?.ollama.models ?? []) : []);
    setShowKey(false);
    setError(null);
    setResult(null);
  }, [selected, settings, detect]);

  const info = PROVIDERS[selected];
  const modelChoices = useMemo(() => [...new Set([...(info.models ?? []), ...models])], [info, models]);
  if (!settings) return error ? <ErrorBox message={error} /> : <Loading />;
  const saved = settings.configs[selected];
  const active = settings.provider === selected;

  const save = async () => {
    setBusy("save");
    setError(null);
    setResult(null);
    try {
      const next = await api<PublicAiSettings>("/api/ai/settings", {
        method: "PUT",
        json: {
          provider: selected,
          configs: { [selected]: { apiKey: form.apiKey.trim() ? form.apiKey : undefined, model: form.model, fastModel: form.fastModel, baseUrl: form.baseUrl } },
        },
      });
      setSettings(next);
      setResult(`${info.label} é o motor de IA agora.`);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async () => {
    setBusy("save");
    try {
      setSettings(await api<PublicAiSettings>("/api/ai/settings", { method: "PUT", json: { provider: settings.provider, configs: { [selected]: { apiKey: "" } } } }));
      setResult("Chave removida.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    setError(null);
    setResult(null);
    try {
      const r = await api<{ message: string }>("/api/ai/test", { method: "POST" });
      setResult(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const loadModels = async () => {
    setBusy("models");
    setError(null);
    try {
      const r = await api<{ models: string[] }>("/api/ai/models", { method: "POST", json: { provider: selected, apiKey: form.apiKey || undefined, baseUrl: form.baseUrl || undefined } });
      setModels(r.models);
      if (!r.models.length) setResult("Nenhum modelo encontrado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const installed = info.group === "agent" ? detect?.installed[selected] : undefined;

  return (
    <div className="space-y-6">
      {/* ── escolha do provedor ── */}
      {GROUPS.map((g) => {
        const Icon = GROUP_ICON[g];
        return (
          <section key={g}>
            <h3 className="label-mono mb-2 flex items-center gap-1.5 text-subtle">
              <Icon className="h-3.5 w-3.5" /> {GROUP_LABELS[g]}
            </h3>
            <div className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
              {PROVIDER_IDS.filter((id) => PROVIDERS[id].group === g).map((id) => {
                const st = status(id, settings, detect);
                const isActive = settings.provider === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => choose(id)}
                    aria-pressed={selected === id}
                    className={cx(
                      "relative rounded-2xl px-3.5 py-3 text-left transition",
                      selected === id ? "rainbow-border rainbow-halo" : "tile tile-hover",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-fg">{PROVIDERS[id].label}</span>
                      {isActive && (
                        <Badge tone="neon">
                          <Zap className="h-3 w-3" /> em uso
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1.5 block">
                      <Badge tone={st.tone}>{st.text}</Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ── configuração do provedor escolhido ── */}
      <section ref={detailRef} className="tile scroll-mt-2 space-y-4 rounded-3xl p-5">
        <div>
          <h3 className="font-display text-base font-semibold text-fg">{info.label}</h3>
          <p className="mt-1 text-sm text-muted">{info.description}</p>
        </div>

        {info.group === "agent" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {installed ? (
              <Badge tone="green">
                <Check className="h-3 w-3" /> {installed}
              </Badge>
            ) : detect ? (
              <>
                <Badge>não encontrado</Badge>
                {info.install && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(info.install!).catch(() => undefined);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-ink/60 px-2.5 py-1 font-mono text-xs text-fg hover:border-neon/50"
                  >
                    {info.install} {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3 text-subtle" />}
                  </button>
                )}
              </>
            ) : (
              <Spinner />
            )}
            {info.docsUrl && (
              <a href={info.docsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-neon hover:text-white">
                documentação <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button small variant="ghost" onClick={loadDetect} aria-label="Verificar de novo">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {info.key && (
          <Field label={`Chave de API${info.key === "optional" ? " (opcional)" : ""}`}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={saved.keyHint ? `salva (${saved.keyHint}) · digite para trocar` : saved.keyFromEnv ? `usando ${info.keyEnv} do ambiente` : "cole a chave aqui"}
                  className="pr-10 font-mono"
                />
                <button type="button" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Esconder chave" : "Mostrar chave"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-fg">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {saved.keyHint && (
                <Button variant="danger" onClick={removeKey}>
                  Remover
                </Button>
              )}
            </div>
            <span className="mt-1.5 flex flex-wrap gap-3 text-xs text-subtle">
              Fica só neste computador, em data/ai-settings.json.
              {info.keyUrl && (
                <a href={info.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-neon hover:text-white">
                  obter chave <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
          </Field>
        )}

        {info.baseUrlEditable && (
          <Field label="URL base">
            <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={info.baseUrl ?? "https://api.exemplo.com/v1"} className="font-mono" />
          </Field>
        )}

        {selected === "ollama" && detect && !detect.ollama.running && (
          <p className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
            O Ollama não está rodando. Abra o aplicativo (ou rode <code className="font-mono">ollama serve</code>) e baixe um modelo, por exemplo{" "}
            <code className="font-mono">ollama pull qwen3</code>.{" "}
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="underline">
              Baixar o Ollama
            </a>
          </p>
        )}

        {info.modelSelectable && (
          <div className="grid gap-3 @xl:grid-cols-2">
            <Field label="Modelo">
              <div className="flex gap-2">
                {modelChoices.length && selected !== "antigravity-cli" ? (
                  <Select value={form.model || info.defaultModel || ""} onChange={(e) => setForm({ ...form, model: e.target.value })}>
                    {!form.model && !info.defaultModel && <option value="">Escolha um modelo</option>}
                    {[...new Set([form.model, ...modelChoices].filter(Boolean))].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={selected === "antigravity-cli" ? "padrão do agy (opcional)" : "nome do modelo"} className="font-mono" />
                )}
                {(info.listModels || selected === "anthropic") && (
                  <Button onClick={loadModels} disabled={busy === "models"} aria-label="Carregar modelos da conta">
                    {busy === "models" ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </Field>
            {info.group === "api" && (
              <Field label="Modelo rápido (opcional)" hint="Para tarefas pequenas. Vazio = o mesmo modelo.">
                <Input value={form.fastModel} onChange={(e) => setForm({ ...form, fastModel: e.target.value })} placeholder={info.fastModel ?? ""} className="font-mono" list={`fast-${selected}`} />
                <datalist id={`fast-${selected}`}>
                  {modelChoices.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
            )}
          </div>
        )}

        {selected === "manual" && (
          <div className="space-y-2 text-sm text-muted">
            <p>A cada etapa que usa IA, o app mostra um pedido pronto. Você cola em qualquer um destes chats, copia a resposta e cola de volta no app:</p>
            <div className="flex flex-wrap gap-1.5">
              {CHAT_SITES.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="tile tile-hover flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-fg">
                  {s.name} <ExternalLink className="h-3 w-3 text-subtle" />
                </a>
              ))}
            </div>
            <p className="text-xs text-subtle">Para economizar colagens, este modo pula as etapas opcionais (habilidades relacionadas, triagem simulada e otimização extra).</p>
          </div>
        )}

        <ErrorBox message={error} />
        {result && <p className="rounded-xl border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">{result}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" onClick={save} disabled={busy === "save"}>
            {busy === "save" ? <Spinner /> : <Zap className="h-4 w-4" />} {active ? "Salvar" : "Usar este motor"}
          </Button>
          {active && selected !== "manual" && (
            <Button onClick={test} disabled={busy === "test"}>
              {busy === "test" ? <Spinner /> : <Check className="h-4 w-4" />} Testar conexão
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
