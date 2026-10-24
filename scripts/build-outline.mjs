import { readFileSync, writeFileSync } from "node:fs";
const categories = [],
  quizzes = [];
let category;
for (const line of readFileSync(
  new URL("../content/outline.txt", import.meta.url),
  "utf8",
)
  .trim()
  .split("\n")) {
  if (line.startsWith("# ")) {
    const [id, name] = line.slice(2).split("|");
    category = { id, name, position: categories.length };
    categories.push(category);
  } else {
    const [title, ...outline] = line.split("|");
    const id = "q" + String(quizzes.length + 1).padStart(3, "0");
    const slug = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-$/, "");
    quizzes.push({
      id,
      slug,
      categoryId: category.id,
      title,
      outline,
      position: quizzes.length,
    });
  }
}
writeFileSync(
  new URL("../content/catalog.json", import.meta.url),
  JSON.stringify({ categories, quizzes }, null, 2) + "\n",
);
console.log(
  `${categories.length} catégories, ${quizzes.length} quiz, ${quizzes.reduce((n, q) => n + q.outline.length, 0)} questions prévues`,
);
