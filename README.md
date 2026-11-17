<div align="center">

<img src="./docs/assets/hero-banner.svg" alt="Curriculum-Gen — Dark + Rainbow Banner" width="100%" />

<br />

[![Next.js 15](https://img.shields.io/badge/Next.js-15.5-ff4d6d?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=0a1226)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-ff9a3d?style=for-the-badge&logo=react&logoColor=ff9a3d&labelColor=0a1226)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-ffd84d?style=for-the-badge&logo=typescript&logoColor=ffd84d&labelColor=0a1226)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-4dffa6?style=for-the-badge&logo=tailwindcss&logoColor=4dffa6&labelColor=0a1226)](https://tailwindcss.com/)
[![Multi-LLM](https://img.shields.io/badge/Motor_IA-Multi--Provider-3de1ff?style=for-the-badge&logo=sparkles&logoColor=3de1ff&labelColor=0a1226)](#-motor-de-ia-multi-provider)
[![ATS Ready](https://img.shields.io/badge/ATS_Parse-100%25_Verificado-a35cff?style=for-the-badge&logo=checkmarx&logoColor=a35cff&labelColor=0a1226)](#-arquitetura-do-pipeline-ats)
[![License: MIT](https://img.shields.io/badge/License-MIT-ff4d9a?style=for-the-badge&logo=opensourceinitiative&logoColor=white&labelColor=0a1226)](./LICENSE)

<p align="center">
  <strong>Gerador local de currículos sob medida otimizado para filtros ATS e triagens de IA (Gupy, Workday, Greenhouse, Lever)</strong><br />
  <em>Grounding estrito nos fatos reais do seu perfil · Score ATS em tempo real · Exportação limpa em PDF, DOCX e TXT</em>
</p>

<img src="./docs/screenshots/home.png" alt="Curriculum-Gen — Órbita Principal" width="100%" />

</div>

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

## ✨ Por que o Curriculum-Gen?

Plataformas modernas de recrutamento (**Gupy, Workday + HiredScore, Greenhouse, Lever, Ashby**) ranqueiam candidatos cruzando **extração estrutural do arquivo (Parsing)**, **correspondência exata de palavras-chave** e **aderência semântica por IA**.

O **Curriculum-Gen** atua nas duas pontas desse funil sem jamais inventar informações:

| Pilar | Como funciona no Curriculum-Gen |
| :--- | :--- |
| 🛡️ **Zero Alucinações (*Strict Grounding*)** | Cada bullet, métrica e habilidade gerada referencia fatos reais do seu perfil (`source_ids`) ou documentos anexados. Números ou tecnologias sem lastro no perfil são bloqueados automaticamente. |
| 🎯 **Espelhamento Exato de Termos da Vaga** | Normaliza sinônimos e variações (`K8s` ↔ `Kubernetes`, `NodeJS` ↔ `Node.js`) usando taxonomia integrada e aplica no currículo a grafia exata exigida pelo anúncio da vaga. |
| 📊 **Score ATS + Triagem Simulada (A–D)** | Calcula o score determinístico de compatibilidade (keywords obrigatórias, diferenciais, título, recência, higiene de formato e parse-back) aliado a um parecer de triagem simulada. |
| 📄 **PDF, DOCX e TXT 100% Parseáveis** | Layout de coluna única sem tabelas ocultas, caixas de texto ou colunas laterais. Após gerar o PDF/DOCX, o sistema **re-extrai o texto do arquivo binário** (*parse-back validation*) para garantir que nenhum dado foi corrompido. |
| 🔌 **Liberdade Total de Motor de IA** | Use agentes locais de CLI (Claude Code, Codex, Antigravity, Gemini), chaves de API (Anthropic, OpenAI, Gemini, OpenRouter, compatíveis com OpenAI), **Ollama local** ou o modo **Copiar e Colar** com qualquer chat da web. |
| 🔒 **Local-First & Privado** | Seu perfil mestre, vagas, documentos e chaves ficam exclusivamente na sua máquina em `data/` (fora do Git). |

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

## 🪐 Fluxo Orbital em 5 Etapas

Toda a experiência acontece em uma única tela interativa (**Flow Orbit**). Cada nodo da órbita acende com sua cor no espectro arco-íris conforme você avança:

### `01` · Perfil Mestre & Evidências (`#ff4d6d`)
Cadastre suas informações de contato, resumo, habilidades, formação, certificações, idiomas, experiências e projetos — ou **importe um currículo existente (PDF/DOCX)** para preenchimento automático. Anexe também **documentos de apoio** aos seus projetos e use **Sugerir fatos** para extrair conquistas verificáveis.

<div align="center">
  <img src="./docs/screenshots/perfil.png" alt="Etapa 01 — Perfil Mestre" width="96%" />
</div>

---

### `02` · Análise da Vaga & Cobertura de Lacunas (`#ffd84d`)
Cole a descrição da vaga. O motor extrai requisitos obrigatórios e diferenciais, cruza com seu perfil mestre (match exato, alias e semântico) e exibe o mapa de cobertura (**Forte**, **Parcial** ou **Lacuna**). Caso você possua uma competência que ainda não estava documentada nos fatos do perfil, registre-a direto pelo botão **"Tenho essa experiência"**.

<div align="center">
  <img src="./docs/screenshots/vaga.png" alt="Etapa 02 — Análise da Vaga e Cobertura" width="96%" />
</div>

---

### `03` · Geração Sob Medida (`#4dffa6`)
Escolha a temperatura de reescrita (**Conservador**, **Equilibrado** ou **Ousado**), o modelo visual (**Clássico**, **Moderno discreto** ou **Compacto**), adicione orientações extras e gere opcionalmente uma **Carta de Apresentação** alinhada à vaga.

<div align="center">
  <img src="./docs/screenshots/gerar.png" alt="Etapa 03 — Gerar Currículo" width="96%" />
</div>

---

### `04` · Verificação, Edição Inline & Grounding (`#3de1ff`)
Revise e edite o headline, resumo, grupos de habilidades e cada bullet das experiências. A cada alteração, o **Score ATS**, a **auditoria de grounding** e a prévia do documento são recalculados instantaneamente.

<div align="center">
  <img src="./docs/screenshots/verificar.png" alt="Etapa 04 — Verificar e Editar Currículo" width="96%" />
</div>

---

### `05` · Visualização Final & Download (`#a35cff`)
Confira a folha renderizada exatamente como o recrutador verá e baixe em **PDF** (camada de texto vetorial limpa), **DOCX** (OpenXML nativo com máxima compatibilidade ATS) ou **TXT** (pronto para colar em campos de portais).

<div align="center">
  <img src="./docs/screenshots/baixar.png" alt="Etapa 05 — Baixar PDF, DOCX e TXT" width="96%" />
</div>

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

## 🤖 Motor de IA Multi-Provider

No botão **Motor de IA** (canto superior esquerdo da órbita), você escolhe e testa em tempo real quem executa a análise e a geração:

<div align="center">
  <img src="./docs/screenshots/ia.png" alt="Configuração do Motor de IA" width="96%" />
</div>

<br />

| Categoria | Provedores Suportados | Autenticação / Configuração |
| :--- | :--- | :--- |
| **Agentes Locais (CLI)** | **Claude Code** (`claude`), **Codex CLI** (`codex`), **Antigravity CLI** (`agy`), **Gemini CLI** (`gemini`) | Reutiliza a sessão/login já autenticada no próprio CLI da sua máquina |
| **APIs Diretas** | **Anthropic**, **OpenAI**, **Google Gemini**, **OpenRouter**, **Compatível com OpenAI** (Groq, DeepSeek, Mistral, LM Studio, vLLM…) | Chave configurada na própria interface (`data/ai-settings.json`) ou via variáveis de ambiente (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`) |
| **Execução Local** | **Ollama** (`http://localhost:11434`) | Sem chave — detecta automaticamente os modelos instalados localmente |
| **Ponte Manual (Web)** | **Copiar e Colar** (ChatGPT, Claude.ai, Gemini Web, Copilot, DeepSeek, Grok…) | Zero configuração — o app monta o prompt estruturado, você cola no seu chat favorito e devolve o JSON de resposta |

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

## 🧠 Arquitetura do Pipeline ATS

```mermaid
flowchart LR
    P["01 · Perfil Mestre<br/>+ Documentos"] --> M["Matriz de Cobertura<br/>Taxonomia + Aliases"]
    J["02 · Texto da Vaga"] --> A["Extração Estruturada<br/>Requisitos + Pesos"]
    A --> M
    M --> G["03 · Geração Ancorada<br/>Bullets + source_ids"]
    G --> V["04 · Auditoria & Score<br/>Grounding + ATS Score"]
    V --> R["05 · Render & Parse-Back<br/>PDF · DOCX · TXT"]

    style P fill:#0a1226,stroke:#ff4d6d,stroke-width:2px,color:#f1f5ff
    style J fill:#0a1226,stroke:#ff9a3d,stroke-width:2px,color:#f1f5ff
    style A fill:#0a1226,stroke:#ffd84d,stroke-width:2px,color:#f1f5ff
    style M fill:#0a1226,stroke:#ffd84d,stroke-width:2px,color:#f1f5ff
    style G fill:#0a1226,stroke:#4dffa6,stroke-width:2px,color:#f1f5ff
    style V fill:#0a1226,stroke:#3de1ff,stroke-width:2px,color:#f1f5ff
    style R fill:#0a1226,stroke:#a35cff,stroke-width:2px,color:#f1f5ff
```

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js 20+** e **pnpm**
- Qualquer uma das opções de **Motor de IA** (ex.: Claude Code logado, Ollama rodando localmente, chave de API ou modo Copiar e Colar).

### Instalação e Uso

```bash
# 1. Instale as dependências
pnpm install

# 2. Inicie o servidor de desenvolvimento
pnpm dev
```

Acesse **[http://localhost:3000](http://localhost:3000)** no navegador.

### Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `pnpm dev` | Inicia o servidor de desenvolvimento em `http://localhost:3000` |
| `pnpm build` | Compila a aplicação Next.js para produção |
| `pnpm start` | Inicia o servidor de produção |
| `pnpm typecheck` | Executa a verificação estática de tipos do TypeScript (`tsc --noEmit`) |
| `pnpm test` | Executa a suíte de testes no Vitest (renderização PDF/DOCX/TXT, parse-back, score ATS, grounding e camada de IA) |

---

## 📁 Estrutura do Projeto

```text
curriculum-gen/
├── src/
│   ├── app/                  # Rotas App Router (Next.js 15) + API Routes (/api/profile, /api/jobs, /api/documents, /api/ai)
│   ├── components/           # Interface orbital (Studio, FlowOrbit, AiSettings, ManualBridge, ScoreRing, Backdrop)
│   │   ├── job/              # Painéis de análise, cobertura, geração, score e edição do currículo
│   │   └── steps/            # Etapas de Perfil, Vaga e Download
│   └── lib/
│       ├── ai/               # Camada Multi-LLM (CLI agents, APIs HTTP, Ollama, Manual Bridge, catálogo de modelos)
│       ├── render/           # Motores de exportação ATS-safe (pdf.ts, docx.ts, txt.ts, model.ts)
│       ├── matching.ts       # Cruzamento exato, por alias e semântico entre perfil e vaga
│       ├── taxonomy.ts       # Dicionário de sinônimos e normalização de tecnologias/competências
│       ├── grounding.ts      # Validador anti-alucinação contra fatos do perfil e documentos anexados
│       ├── scoring.ts        # Cálculo determinístico do Score ATS
│       ├── validate.ts       # Re-extração (parse-back) de PDF e DOCX gerados
│       └── pipeline.ts       # Orquestração ponta a ponta de análise, geração e avaliação
├── tests/                    # Testes automatizados do núcleo e da camada de IA (Vitest)
├── docs/                     # Plano de implementação, screenshots e assets visuais
└── data/                     # Armazenamento local (perfil, vagas, documentos e ajustes de IA — ignorado pelo Git)
```

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

## 📄 Licença

Este projeto é distribuído sob a licença [MIT](./LICENSE).

<img src="./docs/assets/rainbow-line.svg" alt="" width="100%" />

<div align="center">
  <sub>Construído com foco em precisão técnica, transparência e máxima compatibilidade ATS.</sub>
</div>
