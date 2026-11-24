# Claude.ai Complete Guide — provenance and maintenance (reviewed 2026-11-24)

Course id `c-claude-mastery` · 24 lessons, ids `cm-*` (stable — progress is keyed by them) · source: `src/lib/curriculum/courses.ts` · guardrail test: `tests/claude-course.test.ts`.

## Independence and wording rules
- Rreal AI Academy is **independent of Anthropic**. The course says so in lesson 1 and never implies endorsement, partnership or official certification. The certificate is a Rreal completion certificate only.
- Lessons are **original wording**. Facts come from Anthropic's public guides listed below. No text is copied.
- No prices, usage limits, token counts or file-size limits are stated (they change, and were not verified against a billing page). Availability statements are tied to plan names as written in the sources and each lesson tells learners that menus and plans change.
- Practice uses made-up details or placeholders only. Nothing requires a paid account, a real login or sharing private data. Features that need a paid plan or an admin say so.

## Sources used (all public, read 2026-11-24)
Anthropic Academy (https://academy.claude.com):
- Claude 101 course: what-is-claude, your-first-conversation-with-claude, getting-better-results, claude-desktop-app-chat-cowork-code, introduction-to-projects, creating-with-artifacts, working-with-skills, connecting-your-tools, research-mode-for-deep-dives, other-ways-to-work-with-claude
- Tutorials: getting-started-with-claude, choosing-the-right-claude-model, how-to-select-the-right-effort-setting-for-claude-cowork-and-chat, how-to-choose-between-voice-mode-and-dictation, create-and-edit-files-with-claude-to-eliminate-hours-of-busy-work, customize-claude-cowork, navigating-the-claude-desktop-app, what-does-ai-know-about-me

## Lesson → source map
| Lessons | Main sources |
|---|---|
| cm-welcome, cm-first-chat | what-is-claude, your-first-conversation-with-claude, getting-started-with-claude |
| cm-prompting, cm-iterate | your-first-conversation-with-claude (stage/task/rules), getting-better-results |
| cm-files | your-first-conversation-with-claude (file types), working-with-skills (new version, not in-place edit) |
| cm-models | choosing-the-right-claude-model, how-to-select-the-right-effort-setting… |
| cm-search-think, cm-research | getting-started-with-claude (web search defaults), research-mode-for-deep-dives |
| cm-memory | your-first-conversation-with-claude (Instructions, Memory) |
| cm-projects, cm-which-tool | introduction-to-projects, working-with-skills (projects store knowledge, skills perform tasks), customize-claude-cowork |
| cm-artifacts, cm-docs-slides | creating-with-artifacts, getting-started-with-claude |
| cm-files-create, cm-skills | create-and-edit-files…, working-with-skills, navigating-the-claude-desktop-app (record a skill) |
| cm-connectors | connecting-your-tools |
| cm-voice | how-to-choose-between-voice-mode-and-dictation |
| cm-desktop, cm-act-safely, cm-handoff | navigating-the-claude-desktop-app, claude-desktop-app-chat-cowork-code, other-ways-to-work-with-claude |
| cm-surfaces | other-ways-to-work-with-claude |
| cm-safety, cm-fluency | getting-better-results (4D Framework; Dakan and Feller), what-does-ai-know-about-me, navigating-the-claude-desktop-app (prompt-injection and computer-use cautions) |
| cm-playbook | synthesis of all of the above |

## Known time-sensitive statements (re-check on every review)
1. Model names and defaults (Fable, Opus, Sonnet, Haiku; Opus default on Pro/Max/Ultra/Team; Free has Haiku and Sonnet) — cm-models.
2. Effort levels Low / Medium / High / Extra / Max and "levels vary by model" — cm-models.
3. Web search defaults per plan; "no toggle in the newer layout" — cm-search-think.
4. Research is on paid plans — cm-research, cm-search-think.
5. Settings paths: **Settings → search "Instructions" / "Memory"** (switch: *Generate memory from chats*), **Settings → Capabilities → Create and edit files** — cm-memory, cm-files-create, cm-skills.
6. Artifact availability and sharing rules per plan; which artifact types are beta — cm-artifacts, cm-docs-slides.
7. Voice-mode language support (beta beyond English), listening modes — cm-voice.
8. Desktop shortcuts, folder/browser/computer-use availability and permissions, Record a skill (Mac, paid) — cm-desktop, cm-act-safely, cm-skills.
9. Claude in Chrome is on paid plans only; "low-risk tasks on trusted sites" — cm-act-safely.

## Update checklist (do this at least every 90 days, or when Anthropic announces a major release)
1. Re-read the sources above (the Anthropic Academy MCP `get_content`, or the public pages) and compare with the nine statements.
2. Edit only the affected lesson text; keep lesson/quiz ids unchanged; update the review date in the `courses.ts` comment and this file.
3. `npm run typecheck && npm run lint && npm test`. Run `npm run db:seed` only if lessons are added or removed.
4. Do not add prices, limits or screenshots without a dated primary source.

## Not done / limits
- Not an official Anthropic course. Not reviewed by Anthropic.
- Spanish version not produced: an AI-translated lesson must be reviewed once and stored (do not pay to translate on every read).
- Not browser/screen-reader tested in this change; the content uses only existing lesson block types, which the E2E accessibility smoke test already covers. Run `tests/e2e/smoke.mjs` before release.
- Production seed: `supabase/seed.sql` was regenerated locally; applying it to the production database is a separate founder-approved step.
