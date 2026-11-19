# Rules for agents working in this repo

Read `docs/spec.md` first. It is the contract.

1. **Ponytail ultra.** Before writing code, run the `ponytail:ponytail` skill with `ultra`. Ship the smallest change that fully solves the task, and question any part the need does not justify.
2. **Modern web guidance.** Before writing HTML, CSS or client JS, run the `modern-web-guidance` skill and retrieve the guides for what you are building. The spec lists the ids to start from.
3. **No spoilers, anywhere.** No story beats, mission names, character fates or plot in content, code, comments, tests, commit messages, pull requests or reports. If a source shows them, do not repeat them. Places and collectibles are `places` tier and stay out of every default page.
4. **Every fact has a source.** A record without a source link, a date checked and a confidence level does not ship. Do not guess. Restate facts in your own words.
5. **Front end.** Semantic HTML first, CSS before JavaScript, progressive enhancement. ARIA only when native semantics cannot do the job. No new dependency for a few lines of code.
6. **Tokens are the contract.** Use the colour and spacing tokens in the spec. Do not invent a value or a pattern when one exists.
7. **No attribution.** No "Co-Authored-By", "Generated with" or similar lines in commits, pull requests or comments.
8. **Prove it.** Run `npm run check` before you report done, and say what you ran and what it printed. Report failures as failures.
9. **Nothing official-looking.** No Rockstar logos, art, screenshots or fonts. The site says it is unofficial.
10. **Design skills.** Work that touches HTML, CSS, layout, motion or copy on a screen invokes the `interface-design` and Emil Kowalski skills (`emil-design-eng`, `animate`, `mobile-native`, `review-animations`, and the rest of that set) with the Skill tool before designing, plus `example-skills:frontend-design` (no web fonts: get character from scale, weight, spacing and colour) and, for Playwright tests, `example-skills:webapp-testing`; the report says which advice from each was applied. They are installed locally under `.claude/skills/` (git-ignored; if the Skill tool does not list them in a worktree, read `<main worktree>/.claude/skills/<name>/SKILL.md`). `docs/spec.md` wins any disagreement; take the idea and build it with CSS if a skill suggests a library or web font.
11. **Look at it in a browser.** Every worker invokes `example-skills:webapp-testing` and checks its own work in a real browser before it reports: load the screens it changed at phone and tablet widths with touch, exercise what it built, look at a screenshot and read the console. The report says what was tested and what was seen. Do not install or log in to the Vercel CLI; use git pushes and the GitHub deployment status instead.
