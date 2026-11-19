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
