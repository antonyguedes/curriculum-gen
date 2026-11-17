"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { CoveragePanel } from "@/components/job/CoveragePanel";
import type { JobPayload } from "@/components/job/types";
import { ScoreRing } from "@/components/ScoreRing";
import { Loading, cx } from "@/components/ui";
import { NewJobForm } from "./NewJobForm";
import type { JobRow } from "./types";

/** Etapa "Vaga": escolher uma vaga (ou criar uma nova) e ver a cobertura dos requisitos. */
export function VagaStep({
  jobs,
  selectedId,
  creating,
  payload,
  onSelect,
  onNew,
  onCreated,
  reload,
  onDelete,
}: {
  jobs: JobRow[];
  selectedId: string | null;
  creating: boolean;
  payload: JobPayload | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onCreated: (id: string) => void;
  reload: () => void;
  onDelete: (job: JobRow) => void;
}) {
  // Padrão: vaga nova. Uma vaga existente só entra no fluxo quando escolhida.
  const showForm = creating || !selectedId;

  return (
    <div className="space-y-5">
      {jobs.length > 0 && (
        <div className="-m-3 flex gap-2 overflow-x-auto p-3" role="tablist" aria-label="Vagas">
          <button
            type="button"
            role="tab"
            aria-selected={showForm}
            onClick={onNew}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-medium transition",
              showForm ? "rainbow-border rainbow-halo text-fg" : "tile tile-hover text-muted hover:text-fg",
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2} /> Nova
          </button>
          {jobs.map((j) => {
            const active = !showForm && j.id === selectedId;
            return (
              <div key={j.id} className="group relative shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelect(j.id)}
                  className={cx(
                    "flex max-w-64 items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-9 text-left transition",
                    active ? "rainbow-border rainbow-halo" : "tile tile-hover opacity-70 hover:opacity-100",
                  )}
                >
                  {j.bestScore !== null ? (
                    <ScoreRing value={j.bestScore} size={34} stroke={3} />
                  ) : (
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-dashed border-line-strong">
                      <Sparkles className="h-3.5 w-3.5 text-subtle" strokeWidth={1.5} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg">{j.title}</span>
                    <span className="block truncate text-[0.7rem] text-subtle">{j.company || "—"}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${j.title}`}
                  onClick={() => onDelete(j)}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-subtle opacity-0 transition hover:bg-bad/15 hover:text-bad focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <NewJobForm onCreated={onCreated} />
      ) : payload && payload.job.id === selectedId ? (
        <CoveragePanel data={payload} reload={reload} />
      ) : (
        <Loading />
      )}
    </div>
  );
}
