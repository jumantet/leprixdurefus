import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { createApp, authFor, type Env } from "../apps/api/src/index";
import { quizBodySchema, profileSchema } from "../packages/shared/validation";
import { isOfficialSource } from "../packages/shared/sources";
import published from "../content/published.json";
import catalog from "../content/catalog.json";
let mf: Miniflare, db: D1Database, env: Env;
const origin = "https://quizz.nouvel-ordre.fr";
const app = createApp(() => ({
  api: {
    getSession: async ({ headers }) => {
      const uid = headers.get("X-Test-User");
      return uid
        ? {
            user: { id: uid, name: "Test", email: uid + "@example.test" },
            session: { id: "test" },
          }
        : null;
    },
  },
  handler: async () => new Response("mock"),
}));
const quiz = catalog.quizzes.find((q) => q.id === "q042")!;
const questions = published.q042.questions;
const request = (
  path: string,
  method = "GET",
  body?: any,
  uid?: string,
  extra: Record<string, string> = {},
) =>
  app.request(
    "https://api.nouvel-ordre.fr" + path,
    {
      method,
      headers: {
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(uid ? { "X-Test-User": uid } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );
const consent = {
  accepted: true,
  adult: true,
  version: "research-v1",
  profile: {
    ageBand: "25-34",
    gender: "woman",
    country: "FR",
    department: "83",
  },
};
const answer = (i = 0, choice = questions[i].correctChoiceId, uid = "u1") =>
  request(
    "/quizzes/" + quiz.slug + "/answers",
    "POST",
    { questionId: questions[i].id, choiceId: choice, version: 2 },
    uid,
  );
async function seedUser(id: string) {
  await db
    .prepare(
      "INSERT OR IGNORE INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,0,0)",
    )
    .bind(id, id, id + "@example.test")
    .run();
}
async function count(table: string) {
  return (await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first<any>())!.n;
}
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "test-worker",
          modules: true,
          script: 'export default {fetch(){return new Response("ok")}}',
          compatibilityDate: "2026-10-01",
          d1Databases: { DB: "test" },
        },
      ],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const file of readdirSync("apps/api/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync("apps/api/migrations/" + file, "utf8");
    for (const line of sql
      .split("\n")
      .filter((s) => s.trim() && !s.startsWith("--")))
      await db.prepare(line).run();
  }
  env = {
    DB: db,
    WEB_ORIGIN: origin,
    API_ORIGIN: "https://api.nouvel-ordre.fr",
    ADMIN_USER_IDS: "admin",
  };
});
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await db.batch(
    [
      "research_answers",
      "perceptions",
      "research_participants",
      "progress",
      "session",
      "account",
      "user",
      "rate_limits",
      "quiz_drafts",
      "admin_audit",
    ].map((t) => db.prepare(`DELETE FROM ${t}`)),
  );
  for (const u of ["u1", "u2", "admin"]) await seedUser(u);
});
describe("Catalogue et corrections", () => {
  it("contient les 120 parcours et 24 catégories, sans gonfler le nombre de quiz jouables", async () => {
    const r = await request("/catalog");
    const b = (await r.json()) as any;
    expect(b.quizzes).toHaveLength(120);
    expect(b.categories).toHaveLength(24);
    expect(b.quizzes.filter((q: any) => q.current_version)).toHaveLength(13);
  });
  it("publie les treize parcours de dix questions sans réécrire les versions historiques", async () => {
    for (const id of Object.keys(published)) {
      const item = catalog.quizzes.find((q) => q.id === id)!;
      const response = await request("/quizzes/" + item.slug);
      const body = (await response.json()) as any;
      expect(body.questions).toHaveLength(10);
      expect(body.version).toBe(id === "q011" ? 3 : 2);
      const stored = await db
        .prepare("SELECT body FROM quiz_versions WHERE quiz_id=? AND version=?")
        .bind(id, body.version)
        .first<any>();
      expect(JSON.parse(stored.body)).toEqual(
        published[id as keyof typeof published],
      );
    }
    const old = await db
      .prepare(
        "SELECT body FROM quiz_versions WHERE quiz_id='q011' AND version=1",
      )
      .first<any>();
    expect(JSON.parse(old.body).questions).toHaveLength(3);
    const previous = await db
      .prepare(
        "SELECT body FROM quiz_versions WHERE quiz_id='q011' AND version=2",
      )
      .first<any>();
    expect(JSON.parse(previous.body).questions).toHaveLength(12);
    for (const id of ["q096", "q099"]) {
      const item = catalog.quizzes.find((q) => q.id === id)!;
      expect((await request("/quizzes/" + item.slug)).status).toBe(404);
      expect(
        (await request("/quizzes/" + item.slug + "?version=1")).status,
      ).toBe(200);
    }
  });
  it("ne transmet pas les corrections avant une réponse", async () => {
    const r = await request("/quizzes/" + quiz.slug);
    const text = await r.text();
    expect(text).not.toContain("correctChoiceId");
    expect(text).not.toContain("explanation");
    expect(text).not.toContain("sources");
  });
  it("ferme les brouillons au public", async () => {
    const draft = catalog.quizzes.find((q) => q.id === "q002")!;
    expect((await request("/quizzes/" + draft.slug)).status).toBe(404);
  });
  it("refuse les versions invalides et inconnues", async () => {
    for (const v of ["-1", "1.5", "abc", "999"])
      expect(
        (await request("/quizzes/" + quiz.slug + "?version=" + v)).status,
      ).toBe(404);
  });
  it("retourne la correction sourcée après une réponse, sans enregistrer un invité", async () => {
    const r = await request("/quizzes/" + quiz.slug + "/answers", "POST", {
      questionId: questions[0].id,
      choiceId: "a",
      version: 2,
    });
    const b = (await r.json()) as any;
    expect(b.correctChoiceId).toBe(questions[0].correctChoiceId);
    expect(b.sources.length).toBeGreaterThan(0);
    expect(await count("research_answers")).toBe(0);
    expect(await count("progress")).toBe(0);
  });
  it("refuse une proposition inexistante", async () => {
    expect((await answer(0, "forged")).status).toBe(400);
    expect(await count("progress")).toBe(0);
  });
  it("refuse un identifiant de question d’un autre quiz", async () => {
    expect(
      (
        await request(
          "/quizzes/" + quiz.slug + "/answers",
          "POST",
          { questionId: "q011-1", choiceId: "a", version: 2 },
          "u1",
        )
      ).status,
    ).toBe(400);
  });
  it("synchronise la progression sans conserver les réponses détaillées sans consentement", async () => {
    expect((await answer()).status).toBe(200);
    const b = (await (
      await request("/me", "GET", undefined, "u1")
    ).json()) as any;
    expect(b.progress[0].cursor).toBe(1);
    expect(b.research).toBeNull();
    expect(await count("research_answers")).toBe(0);
  });
  it("empêche de sauter une étape côté API", async () => {
    expect((await answer(2)).status).toBe(409);
    expect(await count("progress")).toBe(0);
  });
  it("ne fait pas régresser la progression quand on relit une ancienne question", async () => {
    await answer(0);
    await answer(1);
    await answer(0);
    const p = await db.prepare("SELECT cursor FROM progress").first<any>();
    expect(p.cursor).toBe(2);
  });
  it("termine uniquement après les dix réponses", async () => {
    for (let i = 0; i < questions.length; i++) await answer(i);
    const p = await db.prepare("SELECT * FROM progress").first<any>();
    expect(p.completed).toBe(1);
    expect(p.cursor).toBe(questions.length);
  });
});
describe("Consentement, données et cloisonnement", () => {
  it("exige une connexion pour contribuer", async () => {
    expect((await request("/research/consent", "POST", consent)).status).toBe(
      401,
    );
  });
  it("exige une majorité et un accord explicites", async () => {
    for (const patch of [
      { adult: false },
      { accepted: false },
      { version: "old" },
    ])
      expect(
        (
          await request(
            "/research/consent",
            "POST",
            { ...consent, ...patch },
            "u1",
          )
        ).status,
      ).toBe(400);
  });
  it("permet les champs démographiques non renseignés", async () => {
    expect(
      (
        await request(
          "/research/consent",
          "POST",
          {
            ...consent,
            profile: {
              ageBand: null,
              gender: null,
              country: null,
              department: null,
            },
          },
          "u1",
        )
      ).status,
    ).toBe(200);
  });
  it("refuse une adresse exacte ou un champ politique ajouté", async () => {
    expect(
      profileSchema.safeParse({ ...consent.profile, address: "rue X" }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...consent.profile, party: "X" }).success,
    ).toBe(false);
  });
  it("conserve une seule première réponse, même lors de deux requêtes simultanées", async () => {
    await request("/research/consent", "POST", consent, "u1");
    await Promise.all([answer(), answer()]);
    expect(await count("research_answers")).toBe(1);
  });
  it("ne remplace pas une première réponse lors d’une nouvelle tentative", async () => {
    await request("/research/consent", "POST", consent, "u1");
    await answer(0, "a");
    await answer(0, "b");
    expect(
      (await db.prepare("SELECT choice_id FROM research_answers").first<any>())
        .choice_id,
    ).toBe("a");
  });
  it("ne collecte pas rétroactivement une réponse déjà vue", async () => {
    await answer();
    await request("/research/consent", "POST", consent, "u1");
    await answer();
    expect(await count("research_answers")).toBe(0);
  });
  it("ne révèle pas la progression d’un autre compte", async () => {
    await answer();
    const b = (await (
      await request("/me", "GET", undefined, "u2")
    ).json()) as any;
    expect(b.progress).toHaveLength(0);
  });
  it("supprime les contributions et perceptions au retrait tout en gardant la progression", async () => {
    await request("/research/consent", "POST", consent, "u1");
    await request(
      "/quizzes/" + quiz.slug + "/perceptions",
      "POST",
      { phase: "before", value: 3, version: 2 },
      "u1",
    );
    await answer();
    await request("/research/consent", "DELETE", undefined, "u1");
    expect(await count("research_answers")).toBe(0);
    expect(await count("perceptions")).toBe(0);
    expect(await count("research_participants")).toBe(0);
    expect(await count("progress")).toBe(1);
  });
  it("refuse une perception avant après exposition, et après avant complétion", async () => {
    await request("/research/consent", "POST", consent, "u1");
    expect(
      (
        await request(
          "/quizzes/" + quiz.slug + "/perceptions",
          "POST",
          { phase: "after", value: 3, version: 2 },
          "u1",
        )
      ).status,
    ).toBe(409);
    await answer();
    expect(
      (
        await request(
          "/quizzes/" + quiz.slug + "/perceptions",
          "POST",
          { phase: "before", value: 3, version: 2 },
          "u1",
        )
      ).status,
    ).toBe(409);
  });
  it("accepte une paire avant/après et ne remplace pas la première perception", async () => {
    await request("/research/consent", "POST", consent, "u1");
    for (const value of [2, 5])
      await request(
        "/quizzes/" + quiz.slug + "/perceptions",
        "POST",
        { phase: "before", value, version: 2 },
        "u1",
      );
    for (let i = 0; i < questions.length; i++) await answer(i);
    expect(
      (
        await request(
          "/quizzes/" + quiz.slug + "/perceptions",
          "POST",
          { phase: "after", value: null, version: 2 },
          "u1",
        )
      ).status,
    ).toBe(200);
    expect(await count("perceptions")).toBe(2);
    expect(
      (
        await db
          .prepare("SELECT value FROM perceptions WHERE phase='before'")
          .first<any>()
      ).value,
    ).toBe(2);
  });
  it("exporte uniquement les données du demandeur", async () => {
    await request("/research/consent", "POST", consent, "u1");
    await answer();
    const b = (await (
      await request("/me/export", "GET", undefined, "u2")
    ).json()) as any;
    expect(b.answers).toHaveLength(0);
    expect(b.user.id).toBe("u2");
  });
  it("supprime compte, sessions, progression et contributions en cascade", async () => {
    await request("/research/consent", "POST", consent, "u1");
    await answer();
    expect((await request("/me", "DELETE", undefined, "u1")).status).toBe(200);
    expect(await count("research_answers")).toBe(0);
    expect(await count("progress")).toBe(0);
    expect(
      await db.prepare("SELECT id FROM user WHERE id=?").bind("u1").first(),
    ).toBeNull();
  });
});
describe("Protection des accès et publication", () => {
  it("refuse les mutations cross-origin", async () => {
    expect(
      (
        await request("/research/consent", "POST", consent, "u1", {
          Origin: "https://evil.test",
        })
      ).status,
    ).toBe(403);
  });
  it("refuse l’administration aux invités et utilisateurs ordinaires", async () => {
    expect((await request("/admin/quizzes")).status).toBe(401);
    expect(
      (await request("/admin/quizzes", "GET", undefined, "u1")).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/admin/stats?quiz=q042&version=2",
          "GET",
          undefined,
          "u1",
        )
      ).status,
    ).toBe(403);
  });
  it("masque les petits effectifs", async () => {
    await request("/research/consent", "POST", consent, "u1");
    await answer();
    const b = (await (
      await request(
        "/admin/stats?quiz=q042&version=2",
        "GET",
        undefined,
        "admin",
      )
    ).json()) as any;
    expect(b.distribution[0].suppressed).toBe(true);
    expect(b.distribution[0].counts).toBeNull();
    expect(b.distribution[0].n).toBeNull();
  });
  it("refuse les axes SQL arbitraires", async () => {
    expect(
      (
        await request(
          "/admin/stats?quiz=q042&version=2&dimension=user_id",
          "GET",
          undefined,
          "admin",
        )
      ).status,
    ).toBe(400);
  });
  it("accepte un brouillon incomplet sans le publier", async () => {
    expect(
      (
        await request(
          "/admin/quizzes/q002/draft",
          "PUT",
          { questions: [] },
          "admin",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/quizzes/" + catalog.quizzes.find((q) => q.id === "q002")!.slug,
        )
      ).status,
    ).toBe(404);
  });
  it("bloque une publication incomplète", async () => {
    expect(
      (
        await request(
          "/admin/quizzes/q001/publish",
          "POST",
          {
            body: { questions: [] },
            expectedVersion: 0,
            editorialReviewed: true,
          },
          "admin",
        )
      ).status,
    ).toBe(400);
  });
  it("bloque les sources non officielles ou ressemblantes", () => {
    for (const s of [
      "https://example.org/a",
      "https://insee.fr.evil.test/",
      "http://insee.fr/",
      "https://evil-insee.fr/",
      "https://user:pass@insee.fr/",
    ])
      expect(isOfficialSource(s)).toBe(false);
    expect(
      isOfficialSource("https://www.insee.fr/fr/statistiques/8735252"),
    ).toBe(true);
  });
  it("exige une vérification éditoriale", async () => {
    expect(
      (
        await request(
          "/admin/quizzes/q001/publish",
          "POST",
          {
            body: published.q042,
            expectedVersion: 0,
            editorialReviewed: false,
          },
          "admin",
        )
      ).status,
    ).toBe(400);
  });
  it("refuse une version de base périmée", async () => {
    expect(
      (
        await request(
          "/admin/quizzes/q042/publish",
          "POST",
          { body: published.q042, expectedVersion: 0, editorialReviewed: true },
          "admin",
        )
      ).status,
    ).toBe(409);
  });
  it("ne simule jamais une connexion Google configurée", async () => {
    expect(
      (
        await authFor(env).handler(
          new Request("https://api.test/api/auth/sign-in/social"),
        )
      ).status,
    ).toBe(503);
  });
  it("ne renvoie pas une erreur interne détaillée pour du JSON invalide", async () => {
    const r = await app.request(
      "https://api.test/research/consent",
      {
        method: "POST",
        headers: { Origin: origin, "X-Test-User": "u1" },
        body: "{",
      },
      env,
    );
    expect(r.status).toBe(400);
    expect(await r.text()).not.toContain("SyntaxError");
  });
});
describe("Contenu", () => {
  it("valide toutes les corrections et sources publiées", () => {
    for (const q of Object.values(published))
      expect(quizBodySchema.safeParse(q).success).toBe(true);
  });
  it("conserve 451 questions éditoriales et 120 slugs distincts", () => {
    expect(catalog.quizzes.flatMap((q) => q.outline)).toHaveLength(451);
    expect(new Set(catalog.quizzes.map((q) => q.slug)).size).toBe(120);
  });
  it("refuse une publication avec neuf ou onze questions", () => {
    const body = structuredClone(published.q042);
    body.questions.pop();
    expect(quizBodySchema.safeParse(body).success).toBe(false);
    body.questions = [
      ...published.q042.questions,
      { ...published.q042.questions[0], id: "extra" },
    ];
    expect(quizBodySchema.safeParse(body).success).toBe(false);
  });
  it("refuse les bonnes réponses absentes et les propositions dupliquées", () => {
    const q = structuredClone(published.q042);
    q.questions[0].correctChoiceId = "z";
    expect(quizBodySchema.safeParse(q).success).toBe(false);
    q.questions[0].correctChoiceId = "a";
    q.questions[0].choices[1] = q.questions[0].choices[0];
    expect(quizBodySchema.safeParse(q).success).toBe(false);
  });
});

describe("Rate limiting", () => {
  it("rejects the next request at the limit and permits a new time window", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    try {
      expect((await request("/health")).status).toBe(200);
      await db.prepare("UPDATE rate_limits SET count=120").run();
      expect((await request("/health")).status).toBe(429);
      clock.mockReturnValue(1700000060000);
      expect((await request("/health")).status).toBe(200);
    } finally {
      clock.mockRestore();
    }
  });
});
