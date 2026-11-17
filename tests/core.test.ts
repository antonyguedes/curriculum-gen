import { describe, expect, it } from "vitest";
import { evaluate } from "@/lib/evaluate";
import { checkGrounding } from "@/lib/grounding";
import { computeCoverage } from "@/lib/matching";
import { buildResumeDoc, formatPhone, formatRange, STYLES } from "@/lib/render/model";
import { renderPdf } from "@/lib/render/pdf";
import { countForms, formsFor, norm } from "@/lib/taxonomy";
import { pdfToText } from "@/lib/validate";
import { analysis, profile, resume } from "./fixtures";

describe("taxonomia", () => {
  it("resolve aliases e respeita limites de palavra", () => {
    expect(formsFor("K8s")).toContain("kubernetes");
    expect(countForms(norm("Uso JavaScript e Java"), ["java"])).toBe(1);
    expect(countForms(norm("C++ e C#"), ["c"])).toBe(0);
    expect(countForms(norm("APIs em Node.js."), formsFor("NodeJS"))).toBe(1);
  });
});

describe("cobertura", () => {
  it("classifica cada requisito pela evidência real do perfil", () => {
    const byName = Object.fromEntries(computeCoverage(profile, analysis, []).map((c) => [c.name, c.status]));
    expect(byName["Node.js"]).toBe("forte");
    expect(byName["Postgres"]).toBe("forte"); // alias de PostgreSQL
    expect(byName["Amazon Web Services"]).toBe("parcial"); // só na lista de skills
    expect(byName["Kubernetes"]).toBe("nenhuma");
  });
});

describe("formatação", () => {
  it("normaliza telefone e datas", () => {
    expect(formatPhone("11987654321")).toBe("+55 11 98765-4321");
    expect(formatRange("2021-03", "", "pt")).toBe("03/2021 – Atual");
    expect(formatRange("2021-03", "2023-01", "en")).toBe("Mar 2021 – Jan 2023");
  });
});

describe("grounding", () => {
  it("aceita um currículo fiel ao perfil", () => {
    expect(checkGrounding(profile, analysis, resume).filter((i) => i.severity === "erro")).toEqual([]);
  });

  it("bloqueia número, tecnologia e habilidade inventados", () => {
    const bad = structuredClone(resume);
    bad.experiences[0].bullets[0].text = "Reduzi em 70% o tempo de resposta usando Kubernetes.";
    bad.skill_groups[0].items.push("Terraform");
    const messages = checkGrounding(profile, analysis, bad).filter((i) => i.severity === "erro").map((i) => i.message).join("\n");
    expect(messages).toContain('"70"');
    expect(messages).toContain('"Kubernetes"');
    expect(messages).toContain('"Terraform"');
  });
});

describe("render + parse-back", () => {
  for (const template of ["classico", "moderno", "compacto"] as const) {
    it(`PDF e DOCX (${template}) são relidos com 100% de fidelidade`, async () => {
      const ev = await evaluate(profile, analysis, resume, template);
      expect(ev.parse.pdf).toEqual({ fidelity: 100, missing: [] });
      expect(ev.parse.docx).toEqual({ fidelity: 100, missing: [] });
      expect(ev.score.total).toBeGreaterThan(70);
    });
  }

  it("o PDF não quebra palavras com ligaduras (fi/fl)", async () => {
    const doc = buildResumeDoc(resume, profile.contact, analysis.job_title);
    const text = await pdfToText(await renderPdf(doc, STYLES.classico));
    expect(text).toContain("eficiência");
    expect(text).toContain("perfil");
    expect(text).toContain("fluxo");
    expect(text).toContain("+55 11 98765-4321");
  });
});

describe("ajustes pós-teste real", () => {
  it("título ignora flexão de gênero", async () => {
    const { foldTitle } = await import("@/lib/scoring");
    expect(foldTitle("Desenvolvedora Back-end Sênior")).toBe(foldTitle("Desenvolvedor(a) Back-end Sênior"));
    expect(foldTitle("Engenheira de Dados")).toBe(foldTitle("Engenheiro de Dados"));
  });

  it("requisito conceitual comprovado por fato vira cobertura forte", () => {
    const withConcept = { ...analysis, hard_skills: [...analysis.hard_skills, { name: "Otimização de consultas", aliases: [], required: true, weight: 3 }] };
    const adjacency = [{ requirement: "Otimização de consultas", related_skills: [], covers: true, evidence_fact_ids: ["f_1", "f_inexistente"], rationale: "Reescreveu consultas." }];
    const item = computeCoverage(profile, withConcept, adjacency).find((c) => c.name === "Otimização de consultas")!;
    expect(item.status).toBe("forte");
    expect(item.evidence.map((e) => e.factId)).toEqual(["f_1"]);
    // e o termo pode aparecer no currículo sem erro de grounding
    const r = structuredClone(resume);
    r.experiences[0].bullets[0].text = "Reduzi em 40% o tempo de resposta com otimização de consultas no PostgreSQL.";
    expect(checkGrounding(profile, withConcept, r, adjacency).filter((i) => i.severity === "erro")).toEqual([]);
  });

  it("carta: aceita números do perfil e datas, bloqueia número inventado", async () => {
    const { checkLetter } = await import("@/lib/grounding");
    const ok = { greeting: "Olá,", body: "Desde 2021 reduzi em 40% o tempo da API e atendi 12 clientes.", closing: "Atenciosamente," };
    expect(checkLetter(profile, analysis, ok)).toEqual([]);
    const bad = { ...ok, body: "Liderei um time de 15 pessoas usando Kubernetes." };
    const issues = checkLetter(profile, analysis, bad);
    expect(issues.some((i) => i.severity === "erro" && i.message.includes('"15"'))).toBe(true);
    expect(issues.some((i) => i.message.includes("Kubernetes"))).toBe(true);
  });
});

it("traduz a modalidade de trabalho no currículo em inglês", async () => {
  const { localizeLocation } = await import("@/lib/render/model");
  expect(localizeLocation("São Paulo, SP (Remoto)", "en")).toBe("São Paulo, SP (Remote)");
  expect(localizeLocation("Recife, PE (Híbrido)", "en")).toBe("Recife, PE (Hybrid)");
  expect(localizeLocation("São Paulo, SP (Remoto)", "pt")).toBe("São Paulo, SP (Remoto)");
});

describe("documentos de projetos", () => {
  const withProject = () => {
    const p = structuredClone(profile);
    p.projects.push({ id: "proj_1", name: "Gerador de Relatórios", url: "", description: "Projeto pessoal.", facts: [], documents: [{ id: "doc_abc", name: "README.md", size: 100, chars: 200, addedAt: "" }] });
    return p;
  };
  const docs = [{ id: "doc_abc", projectId: "proj_1", name: "README.md", text: "Serviço em Go que roda em Kubernetes e gera 500 relatórios por hora." }];

  it("documento conta como evidência do projeto", async () => {
    const { withDocuments } = await import("@/lib/documents");
    const k8s = computeCoverage(withDocuments(withProject(), docs), analysis, []).find((c) => c.name === "Kubernetes")!;
    expect(k8s.status).toBe("forte");
    expect(k8s.evidence[0]).toEqual({ factId: "doc_abc", where: "Projeto: Gerador de Relatórios (documento: README.md)" });
    // sem o texto do documento, continua sendo lacuna
    expect(computeCoverage(withProject(), analysis, []).find((c) => c.name === "Kubernetes")!.status).toBe("nenhuma");
  });

  it("bullet sustentado pelo documento passa no grounding; número fora dele não", async () => {
    const { withDocuments } = await import("@/lib/documents");
    const evidence = withDocuments(withProject(), docs);
    const r = structuredClone(resume);
    r.skill_groups[1].items.push("Kubernetes");
    r.projects = [{ source_id: "proj_1", name: "Gerador de Relatórios", url: "", bullets: [{ text: "Construí um serviço em Kubernetes que gera 500 relatórios por hora.", source_ids: ["doc_abc"], inferred: false, manual: false }] }];
    expect(checkGrounding(evidence, analysis, r).filter((i) => i.severity === "erro")).toEqual([]);
    r.projects[0].bullets[0].text = "Construí um serviço em Kubernetes que gera 900 relatórios por hora.";
    expect(checkGrounding(evidence, analysis, r).some((i) => i.message.includes('"900"'))).toBe(true);
  });

  it("recorta documentos longos e informa quais foram cortados", async () => {
    const { docsForPrompt } = await import("@/lib/documents");
    const big = [{ id: "doc_a", projectId: "p", name: "longo.pdf", text: "x".repeat(50_000) }, { id: "doc_b", projectId: "p", name: "curto.md", text: "ok" }];
    const out = docsForPrompt(big);
    expect(out.truncated).toEqual(["longo.pdf"]);
    expect(out.docs[0].text.length).toBeLessThan(31_000);
    expect(out.docs[1].text).toBe("ok");
  });
});

describe("conquistas da formação", () => {
  const withThesis = () => {
    const p = structuredClone(profile);
    p.education[0].facts = [{ id: "f_tcc", text: "TCC: orquestrei microsserviços com Kubernetes em um cluster de 4 nós, aprovado com nota 10.", skills: ["Kubernetes"] }];
    return p;
  };

  it("conquista acadêmica comprova requisito e sustenta bullet da formação", async () => {
    const p = withThesis();
    const k8s = computeCoverage(p, analysis, []).find((c) => c.name === "Kubernetes")!;
    expect(k8s.status).toBe("forte");
    expect(k8s.evidence[0].where).toBe("Formação: Bacharelado em Ciência da Computação — Universidade Exemplo");

    const r = structuredClone(resume);
    r.education[0].bullets = [{ text: "TCC sobre orquestração de microsserviços com Kubernetes em cluster de 4 nós (nota 10).", source_ids: ["f_tcc"], inferred: false, manual: false }];
    expect(checkGrounding(p, analysis, r).filter((i) => i.severity === "erro")).toEqual([]);
    r.education[0].bullets[0].text = "TCC sobre Kubernetes em cluster de 8 nós.";
    expect(checkGrounding(p, analysis, r).some((i) => i.message.includes('"8"'))).toBe(true);

    r.education[0].bullets[0].text = "TCC sobre orquestração de microsserviços com Kubernetes em cluster de 4 nós (nota 10).";
    const ev = await evaluate(p, analysis, r, "classico");
    expect(ev.parse.pdf.fidelity).toBe(100);
    expect(ev.parse.docx.fidelity).toBe(100);
  });
});
