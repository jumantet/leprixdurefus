import { beforeAll, afterAll, it, expect } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
import { authFor } from "../apps/api/src/index";
let mf: Miniflare, db: D1Database;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: "auth",
          modules: true,
          script: 'export default {fetch(){return new Response("ok")}}',
          compatibilityDate: "2026-10-01",
          d1Databases: { DB: "auth-test" },
        },
      ],
    }),
  );
  db = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const line of readFileSync("apps/api/migrations/0001_schema.sql", "utf8")
    .split("\n")
    .filter((x) => x.trim()))
    await db.prepare(line).run();
});
afterAll(async () => {
  await mf.dispose();
});
it("initialise le flux OAuth réel avec le schéma D1, sans contacter Google ni connecter un faux utilisateur", async () => {
  const auth = authFor({
    DB: db,
    WEB_ORIGIN: "https://quizz.nouvel-ordre.fr",
    API_ORIGIN: "https://api.nouvel-ordre.fr",
    BETTER_AUTH_SECRET: "TEST_ONLY_NOT_A_REAL_SECRET_01234567890123456789",
    GOOGLE_CLIENT_ID: "test-only.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-only",
  });
  const r = await auth.handler(
    new Request("https://api.nouvel-ordre.fr/api/auth/sign-in/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://quizz.nouvel-ordre.fr",
      },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "https://quizz.nouvel-ordre.fr/",
      }),
    }),
  );
  expect(r.status).toBe(200);
  const b = (await r.json()) as any;
  expect(new URL(b.url).hostname).toBe("accounts.google.com");
  expect(new URL(b.url).searchParams.get("redirect_uri")).toBe(
    "https://api.nouvel-ordre.fr/api/auth/callback/google",
  );
  expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  expect((await db.prepare("SELECT COUNT(*) n FROM user").first<any>()).n).toBe(
    0,
  );
});
