import { readFileSync, writeFileSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync(new URL("../content/catalog.json", import.meta.url)),
);
const published = JSON.parse(
  readFileSync(new URL("../content/published.json", import.meta.url)),
);
const sql = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const lines = [
  "-- Initial editorial seed; INSERT OR IGNORE makes re-import safe.",
];
for (const c of catalog.categories)
  lines.push(
    `INSERT OR IGNORE INTO categories(id,name,position) VALUES (${sql(c.id)},${sql(c.name)},${c.position});`,
  );
for (const q of catalog.quizzes) {
  lines.push(
    `INSERT OR IGNORE INTO quizzes(id,slug,category_id,title,outline,current_version,position) VALUES (${sql(q.id)},${sql(q.slug)},${sql(q.categoryId)},${sql(q.title)},${sql(JSON.stringify(q.outline))},NULL,${q.position});`,
  );
  if (published[q.id]) {
    lines.push(
      `INSERT OR IGNORE INTO quiz_versions(quiz_id,version,body,published_at) VALUES (${sql(q.id)},1,${sql(JSON.stringify(published[q.id]))},'2026-10-23T12:00:00.000Z');`,
    );
    lines.push(
      `UPDATE quizzes SET current_version=1 WHERE id=${sql(q.id)} AND current_version IS NULL;`,
    );
  }
}
writeFileSync(
  new URL("../apps/api/migrations/0002_content.sql", import.meta.url),
  lines.join("\n") + "\n",
);
