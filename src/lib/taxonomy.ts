/** Normalização de termos e dicionário de aliases de tecnologia. */

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Cada grupo lista grafias equivalentes do MESMO conceito (nunca tecnologias apenas parecidas). */
const ALIAS_GROUPS: string[][] = [
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["node.js", "nodejs", "node js", "node"],
  ["react", "react.js", "reactjs"],
  ["react native", "react-native"],
  ["next.js", "nextjs", "next js"],
  ["vue", "vue.js", "vuejs"],
  ["nuxt", "nuxt.js", "nuxtjs"],
  ["angular", "angularjs", "angular.js"],
  ["express", "express.js", "expressjs"],
  ["nestjs", "nest.js", "nest js"],
  ["python", "python3"],
  ["django", "django rest framework", "drf"],
  ["fastapi", "fast api"],
  ["golang", "go"],
  ["c#", "csharp", "c sharp"],
  [".net", "dotnet", "dot net", ".net core", "asp.net"],
  ["c++", "cpp"],
  ["ruby on rails", "rails", "ror"],
  ["spring boot", "springboot", "spring"],
  ["postgresql", "postgres", "psql"],
  ["mongodb", "mongo"],
  ["sql server", "mssql", "microsoft sql server"],
  ["elasticsearch", "elastic search"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],
  ["kubernetes", "k8s"],
  ["docker compose", "docker-compose"],
  ["infrastructure as code", "iac", "infraestrutura como codigo"],
  ["ci/cd", "cicd", "ci cd", "continuous integration", "integracao continua", "continuous delivery", "entrega continua"],
  ["github actions", "gh actions"],
  ["gitlab ci", "gitlab-ci", "gitlab ci/cd"],
  ["rest", "rest api", "restful", "api rest", "apis rest", "apis restful"],
  ["graphql", "graph ql"],
  ["grpc", "g rpc"],
  ["microsservicos", "microservices", "micro-services", "microsservico", "microservice"],
  ["rabbitmq", "rabbit mq"],
  ["apache kafka", "kafka"],
  ["tailwind css", "tailwind", "tailwindcss"],
  ["html", "html5"],
  ["css", "css3"],
  ["sass", "scss"],
  ["machine learning", "ml", "aprendizado de maquina"],
  ["inteligencia artificial", "artificial intelligence", "ai", "ia"],
  ["large language models", "llm", "llms"],
  ["natural language processing", "nlp", "processamento de linguagem natural", "pln"],
  ["pytorch", "torch"],
  ["scikit-learn", "sklearn", "scikit learn"],
  ["power bi", "powerbi"],
  ["apache spark", "spark", "pyspark"],
  ["apache airflow", "airflow"],
  ["test-driven development", "tdd"],
  ["domain-driven design", "ddd"],
  ["testes unitarios", "unit tests", "unit testing", "testes automatizados", "automated tests", "automated testing"],
  ["metodologias ageis", "agile", "agil", "agile methodologies", "metodologia agil"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["search engine optimization", "seo"],
  ["object-oriented programming", "oop", "poo", "programacao orientada a objetos", "orientacao a objetos"],
  ["observabilidade", "observability", "monitoring", "monitoramento"],
];

const GROUP_INDEX = new Map<string, string[]>();
for (const group of ALIAS_GROUPS) for (const term of group) GROUP_INDEX.set(norm(term), group.map(norm));

/** Todas as grafias (normalizadas) equivalentes a um termo. */
export function formsFor(name: string, aliases: string[] = []): string[] {
  const forms = new Set<string>();
  for (const raw of [name, ...aliases]) {
    const n = norm(raw);
    if (!n) continue;
    forms.add(n);
    for (const alias of GROUP_INDEX.get(n) ?? []) forms.add(alias);
  }
  return [...forms];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reCache = new Map<string, RegExp>();

function termRegex(term: string) {
  let re = reCache.get(term);
  if (!re) {
    // Limites manuais: \b falha com "c++", "c#", ".net", "node.js".
    re = new RegExp(`(?<![a-z0-9])${escapeRe(term)}(?![a-z0-9+#])`, "g");
    reCache.set(term, re);
  }
  return re;
}

/** Quantas vezes alguma das grafias aparece em um texto já normalizado. */
export function countForms(normalizedText: string, forms: string[]): number {
  let best = 0;
  for (const f of forms) {
    const m = normalizedText.match(termRegex(f));
    if (m && m.length > best) best = m.length;
  }
  return best;
}

export const hasForms = (normalizedText: string, forms: string[]) => countForms(normalizedText, forms) > 0;

const STOPWORDS = new Set(
  "a o e de da do das dos em no na nos nas para por com sem um uma uns umas que se ao aos as os ou como mais entre sobre seu sua seus suas the and of to in for with on at by an or as is are be from our your their will you we that this".split(
    " ",
  ),
);

export const tokens = (s: string) =>
  norm(s)
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
