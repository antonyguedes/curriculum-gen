"use client";

import { Download, Lock, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, useCallback } from "react";
import { ProjectDocuments } from "@/components/ProjectDocuments";
import { Button, Card, CsvInput, ErrorBox, Field, Input, Spinner, Textarea, Modal, Toast, Tooltip, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { uid, type Fact, type Profile, emptyProfile, profileStats } from "@/lib/types";

type Mutate = (fn: (draft: Profile) => void) => void;

function FactsEditor({
  facts,
  onChange,
  label = "Fatos",
  placeholder = "O que você fez, como e o resultado (com números)",
}: {
  facts: Fact[];
  onChange: (facts: Fact[]) => void;
  label?: string;
  placeholder?: string;
}) {
  const set = (i: number, patch: Partial<Fact>) => onChange(facts.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">{label}</p>
      {facts.map((f, i) => (
        <div key={f.id} className="rounded-lg border border-line bg-panel-2/60 p-2">
          <Textarea rows={2} value={f.text} placeholder={placeholder} onChange={(e) => set(i, { text: e.target.value })} />
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1">
              <CsvInput value={f.skills} placeholder="Tecnologias usadas neste fato, separadas por vírgula" onChange={(skills) => set(i, { skills })} />
            </div>
            <Button variant="danger" small onClick={() => onChange(facts.filter((_, j) => j !== i))}>
              Remover
            </Button>
          </div>
        </div>
      ))}
      <Button small onClick={() => onChange([...facts, { id: uid("f"), text: "", skills: [] }])}>
        + Adicionar fato
      </Button>
    </div>
  );
}

/** Botão de inclusão no fim da lista: o item novo aparece logo acima dele, sem precisar rolar a página. */
function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button small className="w-full border-dashed" onClick={onClick}>
      {children}
    </Button>
  );
}

function ItemCard({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="space-y-3">{children}</div>
      <div className="mt-3 text-right">
        <Button variant="danger" small onClick={onRemove}>
          Remover item
        </Button>
      </div>
    </div>
  );
}

/** Editor do perfil mestre, aberto no painel da etapa "Perfil". */
export function ProfileEditor({ onChange, onDirtyChange }: { onChange?: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: Profile } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeClear = useCallback(() => {
    setClearOpen(false);
    setConfirmText("");
  }, []);

  useEffect(() => {
    api<Profile>("/api/profile").then(setProfile).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!profile) return error ? <ErrorBox message={error} /> : <Loading />;

  const mutate: Mutate = (fn) => {
    const draft = structuredClone(profile);
    fn(draft);
    setProfile(draft);
    setDirty(true);
    setNotice(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      setProfile(await api<Profile>("/api/profile", { method: "PUT", json: profile }));
      setDirty(false);
      setNotice("Perfil salvo.");
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const stats = profileStats(profile);

  /** Grava o perfil inteiro de uma vez (limpar e desfazer). */
  const persist = async (next: Profile) => {
    const saved = await api<Profile>("/api/profile", { method: "PUT", json: next });
    setProfile(saved);
    setDirty(false);
    onChange?.();
    return saved;
  };

  const clearProfile = async () => {
    const previous = structuredClone(profile); // inclui edições ainda não salvas
    setClearing(true);
    setError(null);
    try {
      await persist(emptyProfile());
      closeClear();
      setNotice(null);
      setToast({ message: "Perfil limpo. Agora você pode importar um CV.", undo: previous });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  const undoClear = async (previous: Profile) => {
    setToast(null);
    try {
      await persist(previous);
      setToast({ message: "Perfil restaurado." });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  /** Backup do perfil em JSON, baixado no navegador antes de limpar. */
  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `perfil-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (file: File) => {
    if (stats.hasData) return; // a importação substituiria o perfil: só com o perfil vazio
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const imported = await api<Profile>("/api/profile/import", { method: "POST", body: form });
      setProfile(imported);
      setDirty(true);
      setNotice("Currículo importado. Revise os dados e clique em Salvar perfil.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const c = profile.contact;
  const contactField = (key: keyof Profile["contact"], label: string, placeholder = "") => (
    <Field label={label}>
      <Input value={c[key]} placeholder={placeholder} onChange={(e) => mutate((d) => void (d.contact[key] = e.target.value))} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <Card
        title="Perfil mestre"
        className="relative z-20"
        actions={
          <>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            {stats.hasData ? (
              <>
                <Tooltip
                  content={
                    <>
                      <span className="mb-1.5 flex items-center gap-1.5 font-semibold text-warn">
                        <Lock className="h-3.5 w-3.5" /> Importação bloqueada
                      </span>
                      Seu perfil já tem dados, e importar um CV substituiria tudo o que você preencheu. Para importar, limpe o perfil primeiro na lixeira ao lado.
                    </>
                  }
                >
                  <Button aria-disabled="true" className="cursor-not-allowed opacity-45 hover:shadow-none" onClick={(e) => e.preventDefault()}>
                    <Lock className="h-4 w-4" strokeWidth={1.8} /> Importar CV
                  </Button>
                </Tooltip>
                <Tooltip align="right" content="Limpar o perfil para importar um CV do zero">
                  <Button variant="danger" aria-label="Limpar perfil" className="border border-bad/25 px-2.5" onClick={() => setClearOpen(true)}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </Button>
                </Tooltip>
              </>
            ) : (
              <Button variant="primary" disabled={importing} onClick={() => fileRef.current?.click()}>
                {importing ? <Spinner /> : <Upload className="h-4 w-4" strokeWidth={1.8} />} {importing ? "Lendo…" : "Importar CV"}
              </Button>
            )}
          </>
        }
      />

      <Modal
        open={clearOpen}
        onClose={closeClear}
        tone="bad"
        icon={<TriangleAlert />}
        title="Limpar o perfil inteiro?"
        footer={
          <>
            <Button variant="ghost" onClick={closeClear}>
              Cancelar
            </Button>
            <Button
              disabled={confirmText.trim().toUpperCase() !== "LIMPAR" || clearing}
              onClick={clearProfile}
              className="border border-bad/50 bg-bad/15 font-semibold text-bad hover:bg-bad/25 hover:shadow-[0_0_24px_-6px_rgb(255_77_109/0.9)]"
            >
              {clearing ? <Spinner /> : <Trash2 className="h-4 w-4" />} Limpar perfil
            </Button>
          </>
        }
      >
        <p>Tudo será apagado:</p>
        <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs">
          {(
            [
              ["experiências", stats.experiences],
              ["projetos", stats.projects],
              ["fatos", stats.facts],
              ["habilidades", stats.skills],
              ["formações", stats.education],
              ["documentos", stats.documents],
            ] as const
          ).map(([label, n]) => (
            <li key={label} className={`flex justify-between rounded-lg border px-2.5 py-1.5 ${n ? "border-bad/25 bg-bad/5 text-fg" : "border-line text-subtle"}`}>
              <span>{label}</span>
              <span className={n ? "text-bad" : ""}>{n}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={downloadBackup} className="mt-4 flex items-center gap-1.5 text-xs font-medium text-neon transition hover:text-white">
          <Download className="h-3.5 w-3.5" /> Baixar backup antes (.json)
        </button>
        <label className="mt-4 block">
          <span className="text-xs text-muted">
            Para confirmar, digite <strong className="font-mono text-bad">LIMPAR</strong>
          </span>
          <Input
            className="mt-1.5 font-mono uppercase tracking-widest"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmText.trim().toUpperCase() === "LIMPAR" && clearProfile()}
            placeholder="LIMPAR"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          onClose={closeToast}
          action={
            toast.undo ? (
              <Button small variant="secondary" onClick={() => undoClear(toast.undo!)}>
                Desfazer
              </Button>
            ) : undefined
          }
        />
      )}

      <ErrorBox message={error} />

      <Card title="Contato">
        <div className="grid gap-3 @xl:grid-cols-2">
          {contactField("name", "Nome completo")}
          {contactField("email", "E-mail")}
          {contactField("phone", "Telefone", "+55 11 91234-5678")}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">{contactField("city", "Cidade")}</div>
            {contactField("state", "UF")}
          </div>
          {contactField("linkedin", "LinkedIn", "linkedin.com/in/seu-usuario")}
          {contactField("github", "GitHub", "github.com/seu-usuario")}
          {contactField("website", "Site / Portfólio")}
        </div>
      </Card>

      <Card title="Sobre você">
        <Textarea rows={3} value={profile.summary} placeholder="Sua trajetória em um parágrafo" onChange={(e) => mutate((d) => void (d.summary = e.target.value))} />
      </Card>

      <Card
        title="Experiência profissional"
        actions={
          <Button small onClick={() => mutate((d) => void d.experiences.unshift({ id: uid("exp"), title: "", company: "", location: "", start: "", end: "", facts: [] }))}>
            + Experiência
          </Button>
        }
      >
        <div className="space-y-3">
          {profile.experiences.length === 0 && <p className="text-sm text-subtle">Nenhuma experiência cadastrada.</p>}
          {profile.experiences.map((e, i) => (
            <ItemCard key={e.id} onRemove={() => mutate((d) => void d.experiences.splice(i, 1))}>
              <div className="grid gap-3 @xl:grid-cols-2">
                <Field label="Cargo">
                  <Input value={e.title} onChange={(ev) => mutate((d) => void (d.experiences[i].title = ev.target.value))} />
                </Field>
                <Field label="Empresa">
                  <Input value={e.company} onChange={(ev) => mutate((d) => void (d.experiences[i].company = ev.target.value))} />
                </Field>
                <Field label="Local e modalidade">
                  <Input value={e.location} placeholder="São Paulo, SP (Remoto)" onChange={(ev) => mutate((d) => void (d.experiences[i].location = ev.target.value))} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início">
                    <Input type="month" value={e.start} onChange={(ev) => mutate((d) => void (d.experiences[i].start = ev.target.value))} />
                  </Field>
                  <Field label="Fim (vazio = atual)">
                    <Input type="month" value={e.end} onChange={(ev) => mutate((d) => void (d.experiences[i].end = ev.target.value))} />
                  </Field>
                </div>
              </div>
              <FactsEditor facts={e.facts} onChange={(facts) => mutate((d) => void (d.experiences[i].facts = facts))} />
            </ItemCard>
          ))}
        </div>
      </Card>

      <Card title="Projetos">
        <div className="space-y-3">
          {profile.projects.length === 0 && <p className="text-sm text-subtle">Nenhum projeto cadastrado.</p>}
          {profile.projects.map((p, i) => (
            <ItemCard key={p.id} onRemove={() => mutate((d) => void d.projects.splice(i, 1))}>
              <div className="grid gap-3 @xl:grid-cols-2">
                <Field label="Nome">
                  <Input value={p.name} onChange={(ev) => mutate((d) => void (d.projects[i].name = ev.target.value))} />
                </Field>
                <Field label="Link">
                  <Input value={p.url} onChange={(ev) => mutate((d) => void (d.projects[i].url = ev.target.value))} />
                </Field>
              </div>
              <Field label="Descrição">
                <Textarea rows={2} value={p.description} onChange={(ev) => mutate((d) => void (d.projects[i].description = ev.target.value))} />
              </Field>
              <FactsEditor facts={p.facts} onChange={(facts) => mutate((d) => void (d.projects[i].facts = facts))} />
              <ProjectDocuments
                project={p}
                onDocuments={(documents) => mutate((d) => void (d.projects[i].documents = documents))}
                onAddFacts={(facts) => mutate((d) => void d.projects[i].facts.push(...facts))}
              />
            </ItemCard>
          ))}
          <AddButton onClick={() => mutate((d) => void d.projects.push({ id: uid("proj"), name: "", url: "", description: "", facts: [], documents: [] }))}>
            + Projeto
          </AddButton>
        </div>
      </Card>

      <Card title="Habilidades">
        <div className="space-y-2">
          {profile.skills.length === 0 && <p className="text-sm text-subtle">Nenhuma habilidade cadastrada.</p>}
          {profile.skills.map((s, i) => (
            <div key={s.id} className="grid grid-cols-12 items-center gap-2">
              <Input className="col-span-4" value={s.name} placeholder="Nome (ex.: Kubernetes)" onChange={(ev) => mutate((d) => void (d.skills[i].name = ev.target.value))} />
              <div className="col-span-4">
                <CsvInput value={s.aliases} placeholder="Outras grafias (ex.: K8s)" onChange={(aliases) => mutate((d) => void (d.skills[i].aliases = aliases))} />
              </div>
              <Input className="col-span-3" value={s.level} placeholder="Nível (opcional)" onChange={(ev) => mutate((d) => void (d.skills[i].level = ev.target.value))} />
              <Button variant="danger" small onClick={() => mutate((d) => void d.skills.splice(i, 1))}>
                ✕
              </Button>
            </div>
          ))}
          <AddButton onClick={() => mutate((d) => void d.skills.push({ id: uid("sk"), name: "", aliases: [], level: "" }))}>+ Habilidade</AddButton>
        </div>
      </Card>

      <Card title="Formação acadêmica">
        <div className="space-y-3">
          {profile.education.length === 0 && <p className="text-sm text-subtle">Nenhuma formação cadastrada.</p>}
          {profile.education.map((e, i) => (
            <ItemCard key={e.id} onRemove={() => mutate((d) => void d.education.splice(i, 1))}>
              <div className="grid gap-3 @xl:grid-cols-12">
                <Field label="Curso" className="@xl:col-span-6">
                  <Input value={e.degree} placeholder="Ex.: Bacharelado em Ciência da Computação" onChange={(ev) => mutate((d) => void (d.education[i].degree = ev.target.value))} />
                </Field>
                <Field label="Instituição" className="@xl:col-span-4">
                  <Input value={e.institution} onChange={(ev) => mutate((d) => void (d.education[i].institution = ev.target.value))} />
                </Field>
                <Field label="Período" className="@xl:col-span-2">
                  <Input value={e.period} placeholder="2018 – 2022" onChange={(ev) => mutate((d) => void (d.education[i].period = ev.target.value))} />
                </Field>
              </div>
              <FactsEditor
                label="Conquistas"
                placeholder="TCC, pesquisa, prêmio, monitoria…"
                facts={e.facts}
                onChange={(facts) => mutate((d) => void (d.education[i].facts = facts))}
              />
            </ItemCard>
          ))}
          <AddButton onClick={() => mutate((d) => void d.education.push({ id: uid("edu"), degree: "", institution: "", period: "", facts: [] }))}>+ Formação</AddButton>
        </div>
      </Card>

      <Card title="Certificações">
        <div className="space-y-2">
          {profile.certifications.map((e, i) => (
            <div key={e.id} className="grid grid-cols-12 items-center gap-2">
              <Input className="col-span-5" value={e.name} placeholder="Nome" onChange={(ev) => mutate((d) => void (d.certifications[i].name = ev.target.value))} />
              <Input className="col-span-4" value={e.issuer} placeholder="Emissor" onChange={(ev) => mutate((d) => void (d.certifications[i].issuer = ev.target.value))} />
              <Input className="col-span-2" value={e.date} placeholder="2024" onChange={(ev) => mutate((d) => void (d.certifications[i].date = ev.target.value))} />
              <Button variant="danger" small onClick={() => mutate((d) => void d.certifications.splice(i, 1))}>
                ✕
              </Button>
            </div>
          ))}
          <AddButton onClick={() => mutate((d) => void d.certifications.push({ id: uid("cert"), name: "", issuer: "", date: "" }))}>+ Certificação</AddButton>
        </div>
      </Card>

      <Card title="Idiomas">
        <div className="space-y-2">
          {profile.languages.map((e, i) => (
            <div key={e.id} className="grid grid-cols-12 items-center gap-2">
              <Input className="col-span-6" value={e.name} placeholder="Idioma" onChange={(ev) => mutate((d) => void (d.languages[i].name = ev.target.value))} />
              <Input className="col-span-5" value={e.level} placeholder="Nível (ex.: Avançado, C1)" onChange={(ev) => mutate((d) => void (d.languages[i].level = ev.target.value))} />
              <Button variant="danger" small onClick={() => mutate((d) => void d.languages.splice(i, 1))}>
                ✕
              </Button>
            </div>
          ))}
          <AddButton onClick={() => mutate((d) => void d.languages.push({ id: uid("lang"), name: "", level: "" }))}>+ Idioma</AddButton>
        </div>
      </Card>

      <Card title="Fatos avulsos">
        <FactsEditor facts={profile.extraFacts} onChange={(facts) => mutate((d) => void (d.extraFacts = facts))} />
      </Card>

      {/* Barra de salvar presa ao rodapé do painel */}
      <div className="sticky bottom-0 z-30 -mx-5 -mb-5 border-t border-line bg-ink/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 py-3">
          <Button variant="primary" disabled={!dirty || saving} onClick={save}>
            {saving && <Spinner />} Salvar perfil
          </Button>
          <span className="text-sm text-subtle">{dirty ? "Há alterações não salvas." : (notice ?? "Tudo salvo.")}</span>
          {dirty && notice && <span className="text-sm text-neon">{notice}</span>}
        </div>
      </div>
    </div>
  );
}
