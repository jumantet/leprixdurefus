import { test, expect } from "@playwright/test";
const slug = "immigre-et-etranger-c-est-la-meme-chose";
test("catalogue, recherche et catégories sans débordement horizontal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("12 DISPONIBLES · 108 EN PRÉPARATION"),
  ).toBeVisible();
  await expect(page.locator(".quiz-card")).toHaveCount(12);
  await page
    .getByRole("textbox", { name: "Rechercher un quiz" })
    .fill("immigré");
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Rechercher un quiz" }).fill("");
  await page.getByLabel("Catégorie", { exact: true }).selectOption("impots");
  await expect(page.locator(".quiz-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => ({
        viewport: window.innerWidth,
        width: document.documentElement.scrollWidth,
        outside: [...document.querySelectorAll("body *")].map(el => ({tag: el.tagName, cls: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right})).filter(el => el.left < -1 || el.right > window.innerWidth + 1).slice(0, 15),
      }),
    ),
  ).toMatchObject({ width: await page.evaluate(() => window.innerWidth) });
});
test("trois réponses, explications officielles, récapitulatif et progression après rechargement", async ({
  page,
}) => {
  await page.goto("/quiz/" + slug + "/");
  await page
    .getByRole("button", { name: "Commencer le quiz", exact: true })
    .click();
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByText(`Question ${i + 1} sur 3`, { exact: true }),
    ).toBeVisible();
    const submit = page.getByRole("button", { name: "Voir l’explication" });
    await expect(submit).toBeDisabled();
    await page.getByRole("radio").first().check();
    await submit.click();
    await expect(
      page.getByRole("heading", { name: "Comprendre la réponse." }),
    ).toBeVisible();
    await expect(page.locator(".sources a").first()).toHaveAttribute(
      "href",
      /^https:\/\/(www\.)?insee.fr\//,
    );
    await page
      .getByRole("button", {
        name: i === 2 ? "Voir mon récapitulatif" : "Question suivante",
      })
      .click();
  }
  await expect(
    page.getByText("PARCOURS TERMINÉ", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".review")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Partager mon parcours" }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Terminés", exact: true }).click();
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Terminés", exact: true }).click();
  await expect(page.locator(".quiz-card")).toHaveCount(1);
});
test("reprise au bon endroit", async ({ page }) => {
  await page.goto("/quiz/" + slug + "/");
  await page
    .getByRole("button", { name: "Commencer le quiz", exact: true })
    .click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Voir l’explication" }).click();
  await expect(
    page.getByRole("heading", { name: "Comprendre la réponse." }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Reprendre le quiz" }).click();
  await expect(
    page.getByText("Question 2 sur 3", { exact: true }),
  ).toBeVisible();
});
test("compte facultatif, absence de faux login et confidentialité", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuer avec Google" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Continuer sans compte" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Données et confidentialité" })
    .click();
  await expect(
    page.getByText("Tu peux apprendre sans participer aux analyses."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => ({
        viewport: window.innerWidth,
        width: document.documentElement.scrollWidth,
        outside: [...document.querySelectorAll("body *")].map(el => ({tag: el.tagName, cls: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right})).filter(el => el.left < -1 || el.right > window.innerWidth + 1).slice(0, 15),
      }),
    ),
  ).toMatchObject({ width: await page.evaluate(() => window.innerWidth) });
});
test("administration refusée à un visiteur", async ({ page }) => {
  await page.goto("/admin/");
  await expect(
    page.getByRole("heading", { name: "Accès réservé." }),
  ).toBeVisible();
  const r = await page.request.get("/backend/admin/quizzes");
  expect(r.status()).toBe(401);
});
test("les brouillons restent explicitement non jouables", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "En préparation", exact: true })
    .click();
  await expect(page.locator(".quiz-card")).toHaveCount(108);
  await expect(page.locator(".quiz-card a")).toHaveCount(0);
});
test("une panne de l’API affiche une erreur récupérable", async ({ page }) => {
  await page.route("**/backend/catalog", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Service temporairement indisponible." }),
    }),
  );
  await page.goto("/");
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "Service temporairement indisponible.",
  );
  await expect(
    page.getByRole("button", { name: "Réessayer" }).first(),
  ).toBeVisible();
});
test("formulaire démographique non précoché — session simulée uniquement pour ce test UI", async ({
  page,
}) => {
  await page.route("**/backend/me", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "test-ui", name: "Test" },
        progress: [],
        research: null,
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Mon compte" }).click();
  await expect(
    page.getByRole("button", { name: "Participer volontairement" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "J’ai 18 ans ou plus." }),
  ).not.toBeChecked();
  await expect(page.getByRole("checkbox").nth(1)).not.toBeChecked();
  await page.getByLabel("Pays de résidence").selectOption("FR");
  await expect(page.getByLabel("Département (facultatif)")).toBeVisible();
  expect(
    await page.evaluate(
      () => ({
        viewport: window.innerWidth,
        width: document.documentElement.scrollWidth,
        outside: [...document.querySelectorAll("body *")].map(el => ({tag: el.tagName, cls: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right})).filter(el => el.left < -1 || el.right > window.innerWidth + 1).slice(0, 15),
      }),
    ),
  ).toMatchObject({ width: await page.evaluate(() => window.innerWidth) });
});
