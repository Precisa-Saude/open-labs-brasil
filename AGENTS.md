# Specific instructions: open-labs-brasil

> This file holds ONLY the rules specific to this repository. The
> shared rules across the precisa-saude ecosystem (tone, git, hooks,
> reviews, worktrees, source verification, test coverage, code
> conventions) live in `@precisa-saude/agent-instructions`.
>
> **Read the shared base online:**
> https://github.com/Precisa-Saude/tooling/blob/main/packages/agent-instructions/AGENTS.md
>
> Claude Code loads both files (shared base + this one) via imports in
> `CLAUDE.md`. Update the base with:
> `pnpm update @precisa-saude/agent-instructions`.

## Overview

Open Labs Brasil is a draft open protocol for a patient-chosen app to access,
with the patient's consent, a clinical laboratory's catalogue, units, schedule,
booking and results (FAPI 2.0 security profile, FHIR R4 data, consent model
from Open Finance Brasil). The repo holds the specification text and the
TypeScript tools around it: an example provider server with synthetic data, a
provider conformance suite, a minimal receiver and a local test PKI.

The protocol is meant to be vendor-neutral. Precisa Saúde is the current
maintainer, not the owner of the rules: `GOVERNANCE.md` says who decides and
how control passes to an implementers' committee and later a standards body.

## Structure

```
especificacao/          the specification (normative text), chapters 00 to 09
  registro/             JSON Schema and the signed example of the participant registry
docs/                   working docs: sources, review notes, tool guide, pilot runbook,
                        lab presentation (.md and .pdf), generated coverage table
servidor-de-exemplo/    example provider (synthetic data, test-only control interface)
suite-de-conformidade/  provider conformance suite, minimal receiver, end-to-end journey
ambiente-local/         test PKI and signed local registry generator; `pnpm demonstracao`
                        (example server plus hosting, for a real app to connect as receiver F)
comum/                  CPF, registry verification (V1 to V14), version negotiation
ferramentas/            Markdown link check, coverage table generator
site/                   landing page (Vite, React, Tailwind, @precisa-saude/ui), `pnpm site`
```

## Commit scopes

Valid scopes: `especificacao`, `registro`, `servidor`, `suite`, `ambiente`,
`ferramentas`, `docs`, `ci`, `deps`, `lint`, `config`, `site`.

## Language

Everything in the repo is Brazilian Portuguese with full accents: spec text,
docs, code identifiers, comments, test names, commit descriptions, PR titles
and bodies. Protocol identifiers stay in English (scope names, paths, JSON
fields, error codes), as the spec says in chapter 1, section 1.3. This file
is the exception. In `site/`, props of shared components from
`@precisa-saude/ui` keep their English names. No em or en dashes in
anything written to the repo.

## Changing the specification

- Behaviour changes go through `GOVERNANCE.md`, section 4: an issue with the
  proposal, a comment period, then a PR that references the issue. Do not
  change normative text (`DEVE`, `NÃO DEVE`, `DEVERIA`, `PODE`) in a PR that
  is about something else.
- Every spec change bumps the document version and gets a `CHANGELOG.md`
  entry that says, point by point, whether providers, receivers or neither
  change behaviour. While MAJOR is 0, a PATCH may fix behaviour and must be
  marked **(fixa comportamento)** (chapter 9, section 9.1).
- Conformance requirement IDs (`REG-001`, `RCP-012`...) are never renumbered
  or reused. A removed requirement is marked as withdrawn.
- When code reveals an ambiguity in the text, record it in
  `docs/pontos-da-especificacao.md` with the reading adopted, instead of
  editing the chapter.
- Every claim about an external source (RFC, FAPI, Open Finance Brasil, LGPD,
  FHIR) is checked at the primary source and recorded in `docs/FONTES.md`
  with the access date.
- `GOVERNANCE.md` itself is a protected document (its section 12): changes
  need a public PR open for 14 days.

## Files that must not be reformatted

- `especificacao/registro/participantes.exemplo.json` is signed over its
  exact bytes by `participantes.exemplo.json.jws`. Any byte change breaks the
  signature. Regenerating it means a new key and a `CHANGELOG.md` note.
- `especificacao/`, `docs/` and `GOVERNANCE.md` are in `.prettierignore` on
  purpose: reformatting tables there would show up as diffs in normative
  text.
- `docs/cobertura-de-requisitos.md` is generated: run
  `pnpm conformidade:local && node ferramentas/gerar-cobertura.ts`.
- `docs/apresentacao-para-laboratorios.pdf` is built from the `.md` with
  pandoc and a headless Chromium, with the Mermaid diagram pre-rendered to
  SVG. When the `.md` changes, rebuild the PDF and confirm it is still two
  A4 pages (`pdfinfo`).

## Site

- The landing page reads the spec version and date from
  `especificacao/00-indice.md` and the conformance numbers from
  `docs/cobertura-de-requisitos.md` at build time
  (`site/src/dados/situacao.ts`), and the request and response examples
  from `especificacao/05-api.md` (`site/src/dados/exemplos.ts`). The consent
  screen in the hero takes its names, scope texts, purpose and expiry from
  the registry example, sections 3.4 and 5.4.1 (`site/src/dados/consentimento.ts`). Never type
  those numbers or snippets into a component. If either sentence changes shape, the build fails on purpose.
- Every claim on the page comes from the spec, the README or
  `docs/apresentacao-para-laboratorios.md`. When the spec changes what the
  page says, update the page in the same PR.
- The visual language is the fhir-brasil site's: `components/marca/` and
  `lib/tipografia.ts` are ports of it. Change them there first.

## Tests and checks

- `pnpm verificar` runs lint, format check, typecheck, tests, the
  conformance suite against the example server, and the link check. CI runs
  the same pieces through the shared `_checks.yml` plus `pnpm conferir`.
- Tests bind fixed ports (8443, 8444, 8445, 9443), so only one test process
  can run per machine at a time, across all worktrees. `fileParallelism` is
  off for the same reason.
- A bug fix starts with a test that fails on `main`. A new or tightened suite
  check needs a deliberate violation in `servidor-de-exemplo/violacoes.ts`
  that makes it fail in `suite-de-conformidade/testes/violacoes.test.ts`, and
  the violation count in `docs/servidor-e-suite.md` updated.

## Dependency rules

- Runtime dependencies are `jose` and `ajv` only. The spec recommends an
  established JOSE library over hand-written signing and verification, and
  the registry schema needs a JSON Schema 2020-12 validator. Anything else
  needs explicit approval.
- `site/` is a separate workspace package. Its dependencies (React, Vite,
  Tailwind, `@precisa-saude/ui`, `@precisa-saude/themes`, `lucide-react`)
  serve only the landing page and never reach the tools' runtime. New ones
  still need explicit approval.
- Node runs the TypeScript directly (type stripping, Node 22.18 or newer).
  There is no build step; `pnpm build` only prints that.

## Justified divergences from the shared baseline

- **Portuguese identifiers.** Types, functions, variables and files are
  named in pt-BR (`verificarCandidato`, `servidor-de-exemplo/`), unlike the
  shared rule. Keep new code consistent with the surrounding files.
- **TypeScript 6.0, not the ecosystem's 5.7 and not 7.0.** The code uses
  `erasableSyntaxOnly` (5.8+). typescript-eslint supports TypeScript below
  6.1 only, so 7.0 breaks lint.
- **No turbo.** The root `package.json` holds the tools; the only workspace
  package is `site/`, and the root `build` and `typecheck` scripts reach it
  through `pnpm --filter`.
- **No `worktree-cli`.** The fixed ports above would collide anyway. The
  site's dev server uses port 4322 (the fhir-brasil site uses 4321).
- **No release or publish workflows.** Nothing here is published to npm; the
  spec version lives in `CHANGELOG.md` and the chapters. The site is
  published to Cloudflare Pages (project `open-labs-brasil`, on
  `pages.dev`) by `.github/workflows/site.yml`, like datasus-viz. The
  workflow creates the project on its first run if it does not exist.
- **No coverage floor.** The conformance suite and the deliberate violations
  are the evidence that the tools test what they claim.
- **Files over 400 lines** are listed in `eslint.config.js`. They predate
  the shared config; splitting them is separate work.
