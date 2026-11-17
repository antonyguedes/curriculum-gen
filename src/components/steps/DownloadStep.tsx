"use client";

import { ClipboardList, FileDown, FileText, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import type { ResumeVersion } from "@/lib/types";

const FORMATS: { key: "pdf" | "docx" | "txt"; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "pdf", label: "PDF", hint: "Para enviar", icon: FileDown },
  { key: "docx", label: "DOCX", hint: "Maior compatibilidade", icon: FileText },
  { key: "txt", label: "TXT", hint: "Colar em formulários", icon: ClipboardList },
];

/** Etapa "Baixar": prévia e downloads do currículo e da carta. */
export function DownloadStep({ jobId, version, onDownloaded }: { jobId: string; version: ResumeVersion; onDownloaded: () => void }) {
  const [doc, setDoc] = useState<"resume" | "cover">("resume");
  const base = `/api/jobs/${jobId}/versions/${version.id}/file`;
  const docs = version.coverLetter ? (["resume", "cover"] as const) : (["resume"] as const);

  return (
    <div className="grid gap-5 @3xl:grid-cols-[1fr_280px]">
      <div className="tile overflow-hidden rounded-3xl p-2">
        <iframe key={doc} title="Prévia" src={`${base}?doc=${doc}&format=pdf&inline=1#toolbar=0&view=FitH`} className="h-[min(70vh,720px)] w-full rounded-2xl bg-white" />
      </div>

      <div className="space-y-4">
        {docs.length > 1 && (
          <div className="tile flex rounded-2xl p-1" role="tablist" aria-label="Documento">
            {docs.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={doc === d}
                onClick={() => setDoc(d)}
                className={cx("flex-1 rounded-xl py-1.5 text-sm transition", doc === d ? "bg-white/10 text-fg shadow-[inset_0_0_0_1px_rgb(61_225_255/0.4)]" : "text-muted hover:text-fg")}
              >
                {d === "resume" ? "Currículo" : "Carta"}
              </button>
            ))}
          </div>
        )}

        {FORMATS.map(({ key, label, hint, icon: Icon }) => (
          <a
            key={key}
            href={`${base}?doc=${doc}&format=${key}`}
            onClick={() => setTimeout(onDownloaded, 900)}
            className={cx(
              "group flex items-center gap-3 rounded-2xl p-3.5 transition",
              key === "pdf" ? "rainbow-border rainbow-halo" : "tile tile-hover",
            )}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-neon/30 bg-neon/10 text-neon transition group-hover:scale-105">
              <Icon className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <span>
              <span className="block font-display font-semibold text-fg">{label}</span>
              <span className="block text-xs text-subtle">{hint}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
