import { Hono } from "hono";
import { cors } from "hono/cors";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../../packages/db/schema";
import {
  answerSchema,
  consentSchema,
  perceptionSchema,
  quizBodySchema,
  CONSENT_VERSION,
  type QuizBody,
} from "../../../packages/shared/validation";
export interface Env {
  DB: D1Database;
  WEB_ORIGIN: string;
  API_ORIGIN: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ADMIN_USER_IDS?: string;
  PUBLISHER_NAME?: string;
  PUBLISHER_CONTACT?: string;
}
type Identity = {
  user: { id: string; name: string; email: string };
  session: { id: string };
};
type AuthService = {
  api: { getSession: (args: { headers: Headers }) => Promise<Identity | null> };
  handler: (r: Request) => Promise<Response>;
};
export type AuthFactory = (env: Env) => AuthService;
export function authFor(env: Env): AuthService {
  if (
    !env.BETTER_AUTH_SECRET ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET
  )
    return {
      api: { getSession: async () => null },
      handler: async () =>
        Response.json(
          { error: "La connexion Google n’est pas encore configurée." },
          { status: 503 },
        ),
    };
  return betterAuth({
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: "sqlite",
      schema,
    }),
    baseURL: env.API_ORIGIN,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    advanced: {
      useSecureCookies: env.API_ORIGIN.startsWith("https://"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    rateLimit: { enabled: true },
    user: { deleteUser: { enabled: false } },
  }) as unknown as AuthService;
}
const now = () => new Date().toISOString();
const admins = (e: Env) =>
  new Set(
    (e.ADMIN_USER_IDS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
const sha = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const parse = async (r: Request) => {
  const s = await r.text();
  if (s.length > 250000) throw new Error("payload-too-large");
  return JSON.parse(s);
};
function publicBody(body: QuizBody) {
  return {
    ...body,
    questions: body.questions.map(({ id, prompt, choices }) => ({
      id,
      prompt,
      choices,
    })),
  };
}
export function createApp(factory: AuthFactory = authFor) {
  const app = new Hono<{
    Bindings: Env;
    Variables: { identity: Identity | null };
  }>();
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cache-Control", "no-store");
  });
  app.use("*", (c, next) =>
    cors({
      origin: c.env.WEB_ORIGIN,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })(c, next),
  );
  app.use("*", async (c, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      c.req.header("Origin") !== c.env.WEB_ORIGIN
    )
      return c.json({ error: "Origine non autorisée." }, 403);
    await next();
  });
  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();
    const ip = c.req.header("CF-Connecting-IP") || "local";
    const key = await sha(
      `${c.env.BETTER_AUTH_SECRET || "development"}:${ip}:${Math.floor(Date.now() / 60000)}`,
    );
    const row = await c.env.DB.prepare(
      "INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
      .bind(key, Date.now() + 120000)
      .first<{ count: number }>();
    if (row && row.count > 120)
      return c.json(
        { error: "Trop de requêtes. Réessaie dans une minute." },
        429,
      );
    await next();
  });
  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/config", (c) =>
    c.json({
      authConfigured: !!(
        c.env.BETTER_AUTH_SECRET &&
        c.env.GOOGLE_CLIENT_ID &&
        c.env.GOOGLE_CLIENT_SECRET
      ),
      consentVersion: CONSENT_VERSION,
      publisher: c.env.PUBLISHER_NAME || "Nouvel Ordre",
      contact: c.env.PUBLISHER_CONTACT || null,
    }),
  );
  app.on(["GET", "POST"], "/api/auth/*", (c) =>
    factory(c.env).handler(c.req.raw),
  );
  app.use("*", async (c, next) => {
    c.set(
      "identity",
      await factory(c.env).api.getSession({ headers: c.req.raw.headers }),
    );
    await next();
  });
  app.get("/catalog", async (c) => {
    const [categories, quizzes] = await Promise.all([
      c.env.DB.prepare("SELECT * FROM categories ORDER BY position").all(),
      c.env.DB.prepare(
        "SELECT q.id,q.slug,q.title,q.category_id,q.current_version, json_array_length(v.body,'$.questions') question_count FROM quizzes q LEFT JOIN quiz_versions v ON v.quiz_id=q.id AND v.version=q.current_version ORDER BY q.position",
      ).all(),
    ]);
    return c.json({ categories: categories.results, quizzes: quizzes.results });
  });
  app.get("/quizzes/:slug", async (c) => {
    const q = await c.env.DB.prepare("SELECT * FROM quizzes WHERE slug=?")
      .bind(c.req.param("slug"))
      .first<any>();
    if (!q) return c.json({ error: "Quiz introuvable." }, 404);
    const requested = c.req.query("version");
    const version = requested ? Number(requested) : q.current_version;
    if (!Number.isInteger(version) || version < 1)
      return c.json({ error: "Ce quiz est en préparation." }, 404);
    const row = await c.env.DB.prepare(
      "SELECT body,published_at FROM quiz_versions WHERE quiz_id=? AND version=?",
    )
      .bind(q.id, version)
      .first<any>();
    if (!row) return c.json({ error: "Version introuvable." }, 404);
    return c.json({
      id: q.id,
      slug: q.slug,
      version,
      publishedAt: row.published_at,
      ...publicBody(JSON.parse(row.body)),
    });
  });
  app.get("/me", async (c) => {
    const identity = c.get("identity");
    if (!identity) return c.json({ user: null, progress: [], research: null });
    const [progress, research] = await Promise.all([
      c.env.DB.prepare(
        "SELECT quiz_id,version,cursor,completed,updated_at FROM progress WHERE user_id=?",
      )
        .bind(identity.user.id)
        .all(),
      c.env.DB.prepare(
        "SELECT profile,consent_version,consented_at FROM research_participants WHERE user_id=?",
      )
        .bind(identity.user.id)
        .first<any>(),
    ]);
    return c.json({
      user: { id: identity.user.id, name: identity.user.name },
      admin: admins(c.env).has(identity.user.id),
      progress: progress.results,
      research: research
        ? { ...research, profile: JSON.parse(research.profile) }
        : null,
    });
  });
  app.post("/quizzes/:slug/answers", async (c) => {
    const checked = answerSchema.safeParse(await parse(c.req.raw));
    if (!checked.success) return c.json({ error: "Réponse invalide." }, 400);
    const a = checked.data;
    const row = await c.env.DB.prepare(
      "SELECT q.id,v.body FROM quizzes q JOIN quiz_versions v ON v.quiz_id=q.id WHERE q.slug=? AND v.version=?",
    )
      .bind(c.req.param("slug"), a.version)
      .first<any>();
    if (!row) return c.json({ error: "Quiz introuvable." }, 404);
    const body: QuizBody = JSON.parse(row.body);
    const index = body.questions.findIndex((x) => x.id === a.questionId);
    const question = body.questions[index];
    if (!question || !question.choices.some((x) => x.id === a.choiceId))
      return c.json({ error: "Proposition inconnue." }, 400);
    const uid = c.get("identity")?.user.id;
    let recorded = false;
    if (uid) {
      const previous = await c.env.DB.prepare(
        "SELECT cursor FROM progress WHERE user_id=? AND quiz_id=? AND version=?",
      )
        .bind(uid, row.id, a.version)
        .first<{ cursor: number }>();
      const cursor = previous?.cursor || 0;
      if (index > cursor)
        return c.json(
          { error: "Réponds d’abord à la question précédente." },
          409,
        );
      const p = await c.env.DB.prepare(
        "SELECT id,profile FROM research_participants WHERE user_id=?",
      )
        .bind(uid)
        .first<any>();
      const queries: D1PreparedStatement[] = [];
      if (p && index === cursor)
        queries.push(
          c.env.DB.prepare(
            "INSERT OR IGNORE INTO research_answers(participant_id,quiz_id,version,question_id,choice_id,profile,created_at) VALUES (?,?,?,?,?,?,?)",
          ).bind(
            p.id,
            row.id,
            a.version,
            a.questionId,
            a.choiceId,
            p.profile,
            now(),
          ),
        );
      queries.push(
        c.env.DB.prepare(
          "INSERT INTO progress(user_id,quiz_id,version,cursor,completed,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,quiz_id,version) DO UPDATE SET cursor=MAX(cursor,excluded.cursor),completed=MAX(completed,excluded.completed),updated_at=excluded.updated_at",
        ).bind(
          uid,
          row.id,
          a.version,
          index + 1,
          index === body.questions.length - 1 ? 1 : 0,
          now(),
        ),
      );
      const results = await c.env.DB.batch(queries);
      recorded =
        !!p && queries.length === 2 && (results[0].meta.changes || 0) > 0;
    }
    return c.json({
      questionId: question.id,
      selectedChoiceId: a.choiceId,
      correctChoiceId: question.correctChoiceId,
      explanation: question.explanation,
      nuance: question.nuance,
      sources: question.sources,
      recorded,
    });
  });
  app.post("/research/consent", async (c) => {
    const uid = c.get("identity")?.user.id;
    if (!uid) return c.json({ error: "Connexion requise." }, 401);
    const data = consentSchema.safeParse(await parse(c.req.raw));
    if (!data.success)
      return c.json(
        { error: "Consentement explicite et majorité requis." },
        400,
      );
    await c.env.DB.prepare(
      "INSERT INTO research_participants(id,user_id,profile,consent_version,consented_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile,consent_version=excluded.consent_version,consented_at=excluded.consented_at",
    )
      .bind(
        crypto.randomUUID(),
        uid,
        JSON.stringify(data.data.profile),
        data.data.version,
        now(),
      )
      .run();
    return c.json({ ok: true });
  });
  app.delete("/research/consent", async (c) => {
    const uid = c.get("identity")?.user.id;
    if (!uid) return c.json({ error: "Connexion requise." }, 401);
    await c.env.DB.prepare("DELETE FROM research_participants WHERE user_id=?")
      .bind(uid)
      .run();
    return c.json({ ok: true });
  });
  app.post("/quizzes/:slug/perceptions", async (c) => {
    const uid = c.get("identity")?.user.id;
    if (!uid) return c.json({ error: "Connexion requise." }, 401);
    const p = await c.env.DB.prepare(
      "SELECT id,profile FROM research_participants WHERE user_id=?",
    )
      .bind(uid)
      .first<any>();
    if (!p)
      return c.json({ error: "Participation à l’étude non activée." }, 403);
    const checked = perceptionSchema.safeParse(await parse(c.req.raw));
    if (!checked.success) return c.json({ error: "Réponse invalide." }, 400);
    const a = checked.data;
    const q = await c.env.DB.prepare(
      "SELECT q.id FROM quizzes q JOIN quiz_versions v ON q.id=v.quiz_id WHERE q.slug=? AND v.version=?",
    )
      .bind(c.req.param("slug"), a.version)
      .first<any>();
    if (!q) return c.json({ error: "Quiz introuvable." }, 404);
    const progress = await c.env.DB.prepare(
      "SELECT cursor,completed FROM progress WHERE user_id=? AND quiz_id=? AND version=?",
    )
      .bind(uid, q.id, a.version)
      .first<any>();
    if (
      (a.phase === "before" && progress?.cursor > 0) ||
      (a.phase === "after" && !progress?.completed)
    )
      return c.json({ error: "Cette étape n’est plus disponible." }, 409);
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO perceptions(participant_id,quiz_id,version,phase,value,profile,created_at) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(p.id, q.id, a.version, a.phase, a.value, p.profile, now())
      .run();
    return c.json({ ok: true });
  });
  app.get("/me/export", async (c) => {
    const uid = c.get("identity")?.user.id;
    if (!uid) return c.json({ error: "Connexion requise." }, 401);
    const p = await c.env.DB.prepare(
      "SELECT * FROM research_participants WHERE user_id=?",
    )
      .bind(uid)
      .first<any>();
    const [answers, perceptions, progress] = await Promise.all([
      c.env.DB.prepare(
        "SELECT quiz_id,version,question_id,choice_id,profile,created_at FROM research_answers WHERE participant_id=?",
      )
        .bind(p?.id || "")
        .all(),
      c.env.DB.prepare(
        "SELECT quiz_id,version,phase,value,profile,created_at FROM perceptions WHERE participant_id=?",
      )
        .bind(p?.id || "")
        .all(),
      c.env.DB.prepare(
        "SELECT quiz_id,version,cursor,completed,updated_at FROM progress WHERE user_id=?",
      )
        .bind(uid)
        .all(),
    ]);
    c.header(
      "Content-Disposition",
      'attachment; filename="nouvel-ordre-mes-donnees.json"',
    );
    return c.json({
      user: c.get("identity")?.user,
      research: p,
      answers: answers.results,
      perceptions: perceptions.results,
      progress: progress.results,
    });
  });
  app.delete("/me", async (c) => {
    const uid = c.get("identity")?.user.id;
    if (!uid) return c.json({ error: "Connexion requise." }, 401);
    await c.env.DB.prepare("DELETE FROM user WHERE id=?").bind(uid).run();
    return c.json({ ok: true });
  });
  app.use("/admin/*", async (c, next) => {
    const uid = c.get("identity")?.user.id;
    if (!uid) return c.json({ error: "Connexion requise." }, 401);
    if (!admins(c.env).has(uid))
      return c.json({ error: "Accès réservé." }, 403);
    await next();
  });
  app.get("/admin/quizzes", async (c) => {
    const rows = await c.env.DB.prepare(
      "SELECT q.*,d.body draft_body,v.body published_body FROM quizzes q LEFT JOIN quiz_drafts d ON d.quiz_id=q.id LEFT JOIN quiz_versions v ON v.quiz_id=q.id AND v.version=q.current_version ORDER BY q.position",
    ).all();
    return c.json(rows.results);
  });
  app.put("/admin/quizzes/:id/draft", async (c) => {
    const b = await parse(c.req.raw);
    if (!b || typeof b !== "object" || !Array.isArray(b.questions))
      return c.json({ error: "Structure de brouillon invalide." }, 400);
    const q = await c.env.DB.prepare("SELECT id FROM quizzes WHERE id=?")
      .bind(c.req.param("id"))
      .first();
    if (!q) return c.json({ error: "Quiz introuvable." }, 404);
    await c.env.DB.prepare(
      "INSERT INTO quiz_drafts(quiz_id,body,updated_at) VALUES (?,?,?) ON CONFLICT(quiz_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at",
    )
      .bind(c.req.param("id"), JSON.stringify(b), now())
      .run();
    return c.json({ ok: true });
  });
  app.post("/admin/quizzes/:id/publish", async (c) => {
    const input = await parse(c.req.raw);
    const checked = quizBodySchema.safeParse(input.body);
    if (!checked.success)
      return c.json(
        {
          error:
            "Publication refusée : questions, réponses et sources complètes requises.",
          issues: checked.error.issues,
        },
        400,
      );
    if (input.editorialReviewed !== true)
      return c.json(
        { error: "La vérification éditoriale doit être confirmée." },
        400,
      );
    const q = await c.env.DB.prepare(
      "SELECT current_version FROM quizzes WHERE id=?",
    )
      .bind(c.req.param("id"))
      .first<any>();
    if (!q) return c.json({ error: "Quiz introuvable." }, 404);
    if (input.expectedVersion !== (q.current_version || 0))
      return c.json(
        { error: "Le contenu a changé. Recharge avant de publier." },
        409,
      );
    const version = (q.current_version || 0) + 1;
    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO quiz_versions(quiz_id,version,body,published_at) VALUES (?,?,?,?)",
      ).bind(c.req.param("id"), version, JSON.stringify(checked.data), now()),
      c.env.DB.prepare(
        "UPDATE quizzes SET current_version=?,title=? WHERE id=?",
      ).bind(version, checked.data.title, c.req.param("id")),
      c.env.DB.prepare(
        "INSERT INTO admin_audit(id,actor_id,action,quiz_id,created_at) VALUES (?,?,?,?,?)",
      ).bind(
        crypto.randomUUID(),
        c.get("identity")!.user.id,
        "publish",
        c.req.param("id"),
        now(),
      ),
    ]);
    return c.json({ ok: true, version });
  });
  app.get("/admin/stats", async (c) => {
    const quiz = c.req.query("quiz");
    const version = Number(c.req.query("version"));
    const dimension = c.req.query("dimension") || "all";
    if (
      !quiz ||
      !Number.isInteger(version) ||
      version < 1 ||
      !["all", "ageBand", "gender", "country", "department"].includes(dimension)
    )
      return c.json({ error: "Filtres invalides." }, 400);
    const expression =
      dimension === "all"
        ? "'all'"
        : `COALESCE(json_extract(profile,'$.${dimension}'),'undisclosed')`;
    const rows = await c.env.DB.prepare(
      `SELECT question_id,choice_id,${expression} segment,COUNT(*) n FROM research_answers WHERE quiz_id=? AND version=? GROUP BY question_id,choice_id,segment`,
    )
      .bind(quiz, version)
      .all<any>();
    const groups = new Map<
      string,
      {
        questionId: string;
        segment: string;
        n: number;
        counts: Record<string, number>;
      }
    >();
    for (const r of rows.results) {
      const k = r.question_id + ":" + r.segment;
      const g = groups.get(k) || {
        questionId: r.question_id,
        segment: r.segment,
        n: 0,
        counts: {} as Record<string, number>,
      };
      g.n += r.n;
      g.counts[r.choice_id] = r.n;
      groups.set(k, g);
    }
    const distribution = [...groups.values()].map((g) => {
      const suppressed = g.n < 20 || Object.values(g.counts).some((n) => n < 5);
      return {
        ...g,
        n: suppressed ? null : g.n,
        counts: suppressed ? null : g.counts,
        suppressed,
      };
    });
    const pairs = await c.env.DB.prepare(
      "SELECT b.value before_value,a.value after_value,COUNT(*) n FROM perceptions b JOIN perceptions a ON a.participant_id=b.participant_id AND a.quiz_id=b.quiz_id AND a.version=b.version AND a.phase='after' WHERE b.quiz_id=? AND b.version=? AND b.phase='before' GROUP BY b.value,a.value",
    )
      .bind(quiz, version)
      .all<any>();
    const pairedN = pairs.results.reduce((n, r) => n + r.n, 0);
    const pairedSuppressed = pairedN < 20 || pairs.results.some((r) => r.n < 5);
    return c.json({
      population:
        "Participants adultes volontaires ayant consenti, non représentatifs de la population française.",
      dimension,
      quiz,
      version,
      minimumGroup: 20,
      distribution,
      perceptions: {
        scope: "Tous les participants appariés, sans filtre démographique",
        suppressed: pairedSuppressed,
        n: pairedSuppressed ? null : pairedN,
        pairs: pairedSuppressed ? null : pairs.results,
      },
    });
  });
  app.notFound((c) => c.json({ error: "Route introuvable." }, 404));
  app.onError((err, c) => {
    if (err instanceof SyntaxError || err.message === "payload-too-large")
      return c.json(
        { error: "Corps de requête invalide ou trop volumineux." },
        400,
      );
    if (err.message.includes("UNIQUE constraint"))
      return c.json(
        { error: "Une modification concurrente a eu lieu. Recharge la page." },
        409,
      );
    return c.json({ error: "Le service est momentanément indisponible." }, 500);
  });
  return app;
}
const app = createApp();
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM rate_limits WHERE expires_at<?").bind(
        Date.now(),
      ),
      env.DB.prepare("DELETE FROM research_answers WHERE created_at<?").bind(
        new Date(Date.now() - 365 * 86400000).toISOString(),
      ),
      env.DB.prepare("DELETE FROM perceptions WHERE created_at<?").bind(
        new Date(Date.now() - 365 * 86400000).toISOString(),
      ),
      env.DB.prepare(
        "DELETE FROM research_participants WHERE consented_at<?",
      ).bind(new Date(Date.now() - 365 * 86400000).toISOString()),
      env.DB.prepare("DELETE FROM session WHERE expiresAt<?").bind(Date.now()),
      env.DB.prepare("DELETE FROM verification WHERE expiresAt<?").bind(
        Date.now(),
      ),
    ]);
  },
};
