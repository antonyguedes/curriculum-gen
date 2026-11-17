import { ProfileSchema, type JobAnalysis, type Profile, type TailoredResume } from "@/lib/types";

export const profile: Profile = ProfileSchema.parse({
  contact: { name: "Ana Souza", email: "ana@example.com", phone: "11987654321", city: "São Paulo", state: "SP", linkedin: "linkedin.com/in/anasouza", github: "github.com/anasouza" },
  summary: "Desenvolvedora back-end.",
  experiences: [
    {
      id: "exp_1", title: "Desenvolvedora Back-end Pleno", company: "Loja Fictícia", location: "São Paulo, SP (Remoto)", start: "2021-03", end: "",
      facts: [
        { id: "f_1", text: "Reduzi o tempo de resposta da API de pedidos em 40% reescrevendo consultas no PostgreSQL.", skills: ["PostgreSQL", "Node.js"] },
        { id: "f_2", text: "Implementei filas com RabbitMQ para processar 2 milhões de eventos por dia.", skills: ["RabbitMQ"] },
        { id: "f_3", text: "Configurei pipelines de deploy no GitLab CI com Docker.", skills: ["GitLab CI", "Docker"] },
      ],
    },
    {
      id: "exp_2", title: "Desenvolvedora Júnior", company: "Agência Exemplo", location: "Campinas, SP", start: "2018-01", end: "2021-02",
      facts: [{ id: "f_4", text: "Desenvolvi APIs REST em Node.js e TypeScript para 12 clientes.", skills: ["Node.js", "TypeScript"] }],
    },
  ],
  education: [{ id: "edu_1", degree: "Bacharelado em Ciência da Computação", institution: "Universidade Exemplo", period: "2014 – 2017" }],
  skills: [
    { id: "sk_1", name: "Node.js" }, { id: "sk_2", name: "TypeScript" }, { id: "sk_3", name: "PostgreSQL" },
    { id: "sk_4", name: "Docker" }, { id: "sk_5", name: "AWS" },
  ],
  languages: [{ id: "lang_1", name: "Inglês", level: "Avançado" }],
});

export const analysis: JobAnalysis = {
  job_title: "Desenvolvedor Back-end Sênior", company: "Fintech X", language: "pt", seniority: "Sênior", years_required: 5,
  hard_skills: [
    { name: "Node.js", aliases: ["NodeJS"], required: true, weight: 5 },
    { name: "Postgres", aliases: ["PostgreSQL"], required: true, weight: 4 },
    { name: "Amazon Web Services", aliases: ["AWS"], required: true, weight: 3 },
    { name: "Kubernetes", aliases: ["K8s"], required: false, weight: 2 },
    { name: "Terraform", aliases: [], required: false, weight: 1 },
  ],
  soft_skills: [], responsibilities: ["Desenvolver APIs REST escaláveis em Node.js", "Otimizar consultas em banco de dados"],
  domain_keywords: ["fintech"], certifications: [], education: [], languages: [], location: "Remoto",
};

export const resume: TailoredResume = {
  language: "pt",
  headline: "Desenvolvedor Back-end Sênior | Node.js · PostgreSQL · AWS",
  summary: "Desenvolvedora back-end com 8 anos de experiência em APIs REST com Node.js e TypeScript, bancos PostgreSQL e mensageria. Histórico de otimização de consultas e processamento de alto volume, com foco em eficiência, confiabilidade e fluxo de entrega contínua em ambientes de produção.",
  skill_groups: [{ label: "Back-end", items: ["Node.js", "TypeScript", "PostgreSQL"] }, { label: "Cloud", items: ["Amazon Web Services (AWS)", "Docker"] }],
  experiences: [
    {
      source_id: "exp_1", title: "Desenvolvedora Back-end Pleno", company: "Loja Fictícia", location: "São Paulo, SP (Remoto)", start: "2021-03", end: "",
      bullets: [
        { text: "Reduzi em 40% o tempo de resposta da API de pedidos ao otimizar consultas no PostgreSQL com Node.js.", source_ids: ["f_1"], inferred: false, manual: false },
        { text: "Implementei filas com RabbitMQ para processar 2 milhões de eventos por dia, com eficiência e perfil de carga estável.", source_ids: ["f_2"], inferred: false, manual: false },
      ],
    },
    {
      source_id: "exp_2", title: "Desenvolvedora Júnior", company: "Agência Exemplo", location: "Campinas, SP", start: "2018-01", end: "2021-02",
      bullets: [
        { text: "Desenvolvi APIs REST em Node.js e TypeScript para 12 clientes.", source_ids: ["f_4"], inferred: false, manual: false },
        { text: "Mantive integrações em Node.js para clientes da agência.", source_ids: ["f_4"], inferred: false, manual: false },
      ],
    },
  ],
  projects: [],
  education: [{ source_id: "edu_1", degree: "Bacharelado em Ciência da Computação", institution: "Universidade Exemplo", period: "2014 – 2017", bullets: [] }],
  certifications: [],
  languages: ["Inglês — Avançado"],
};
