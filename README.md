# curriculum-gen

Gerador local de currículos sob medida para filtros ATS. Usa o Claude Code instalado na máquina como motor de IA (sem API key).

## Requisitos
- Node 20+ e pnpm
- Claude Code instalado e logado (`claude`)

## Uso
```
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # testes do núcleo (render, parse-back, score, grounding)
```

Tudo acontece numa tela só: a órbita do fluxo. Clique numa etapa para abrir o painel dela (o progresso na órbita avança conforme você conclui cada uma):

1. **Perfil** — preencha ou importe um CV (PDF/DOCX). Em cada projeto, anexe documentos de apoio e use **Sugerir fatos**.
2. **Vaga** — cole o texto da vaga; veja a cobertura dos requisitos e registre experiências que faltam.
3. **Gerar** — escolha a temperatura (Conservador / Equilibrado / Ousado), o modelo visual e, se quiser, a carta de apresentação.
4. **Verificar** — edite qualquer parte com score, grounding e prévia recalculados a cada alteração.
5. **Baixar** — PDF, DOCX ou TXT do currículo e da carta.

A etapa aberta fica na URL (`/?step=vaga&job=…`): recarregar mantém o painel, e o Voltar do navegador ou o Esc fecham.

Os documentos anexados também servem de evidência: a IA pode citá-los como fonte dos bullets do projeto, e a checagem de grounding confere números e tecnologias contra o texto deles. Documentos longos são lidos em parte (30 mil caracteres cada), e a interface avisa quando isso acontece.

Os dados ficam em `data/` (fora do git). Variáveis opcionais: `DATA_DIR`, `CLAUDE_MODEL`, `CLAUDE_BIN`.
