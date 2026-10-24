import { readFileSync } from "node:fs";
const { quizBodySchema } = await import("../packages/shared/validation.ts");
const catalog = JSON.parse(
  readFileSync(new URL("../content/catalog.json", import.meta.url)),
);
const published = JSON.parse(
  readFileSync(new URL("../content/published.json", import.meta.url)),
);
if (catalog.quizzes.length !== 120 || catalog.categories.length !== 24)
  throw Error("Unexpected catalogue size");
if (new Set(catalog.quizzes.map((q) => q.slug)).size !== 120)
  throw Error("Duplicate slugs");
for (const [id, q] of Object.entries(published)) {
  quizBodySchema.parse(q);
  if (!catalog.quizzes.find((c) => c.id === id)) throw Error("Unknown quiz");
  for (const question of q.questions)
    for (const s of question.sources)
      if (s.checkedAt > new Date().toISOString().slice(0, 10))
        throw Error("Future source check");
}
console.log(
  `24 catégories ; 120 parcours ; ${Object.keys(published).length} publiés avec sources officielles ; ${120 - Object.keys(published).length} brouillons explicites.`,
);
