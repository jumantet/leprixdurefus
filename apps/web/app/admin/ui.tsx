"use client";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, post } from "../api-client";
import { download } from "../ui";
const blankQuestion = (id: string, prompt: string) => ({
  id,
  prompt,
  choices: ["a", "b", "c", "d"].map((id) => ({ id, text: "" })),
  correctChoiceId: "a",
  explanation: "",
  nuance: "",
  sources: [
    {
      title: "",
      publisher: "",
      url: "",
      checkedAt: new Date().toISOString().slice(0, 10),
    },
  ],
});
export default function Admin() {
  const [authorized, setAuthorized] = useState(false),
    [ready, setReady] = useState(false),
    [rows, setRows] = useState<any[]>([]),
    [chosen, setChosen] = useState<any>(null),
    [body, setBody] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [tab, setTab] = useState("content"),
    [stats, setStats] = useState<any>(null),
    [dimension, setDimension] = useState("all"),
    [version, setVersion] = useState(1);
  async function load() {
    try {
      const m = await api("/me");
      if (!m.admin) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      setRows(await api("/admin/quizzes"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function pick(row: any) {
    setChosen(row);
    setBody(
      row.draft_body
        ? JSON.parse(row.draft_body)
        : row.published_body
          ? JSON.parse(row.published_body)
          : {
              title: row.title,
              intro: "",
              questions: JSON.parse(row.outline).map((p: string, i: number) =>
                blankQuestion(`${row.id}-${i + 1}`, p),
              ),
            },
    );
    setReviewed(false);
    setStats(null);
    setVersion(row.current_version || 1);
    setError("");
    setNotice("");
  }
  function changeQuestion(index: number, update: any) {
    setBody({
      ...body,
      questions: body.questions.map((q: any, i: number) =>
        i === index ? { ...q, ...update } : q,
      ),
    });
    setReviewed(false);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const chartRows =
    stats?.distribution.flatMap((g: any) =>
      g.suppressed
        ? []
        : Object.entries(g.counts).map(([choice, n]) => ({
            label: `${g.questionId} / ${g.segment} / ${choice.toUpperCase()}`,
            participants: n,
          })),
    ) || [];
  return (
    <>
      <header className="header">
        <a className="brand" href="/">
          <img src="/logo.png" width={58} height={58} alt="Nouvel Ordre" />
        </a>
        <nav>
          <a href="/">Retour aux quiz</a>
          <span>Administration</span>
        </nav>
      </header>
      <main className="container admin">
        <h1>Contenus & compréhension.</h1>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!ready ? (
          <p>Vérification de l’accès…</p>
        ) : !authorized ? (
          <div className="empty">
            <h2>Accès réservé.</h2>
            <p>Connecte-toi avec un compte autorisé depuis l’accueil.</p>
            <a className="button" href="/">
              Revenir à l’accueil
            </a>
          </div>
        ) : (
          <>
            <p className="muted">
              {rows.length} parcours ·{" "}
              {rows.filter((q) => q.current_version).length} publiés. Les
              versions publiées sont conservées : chaque modification crée une
              nouvelle version.
            </p>
            <div className="filter-row" style={{ marginTop: 20 }}>
              {[
                ["content", "Éditer les contenus"],
                ["stats", "Consulter les résultats"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "selected" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="admin-layout">
              <aside>
                <input
                  aria-label="Rechercher dans l’administration"
                  placeholder="Chercher un parcours…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="admin-list">
                  {rows
                    .filter((q) =>
                      q.title.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((q) => (
                      <button
                        key={q.id}
                        className={chosen?.id === q.id ? "selected" : ""}
                        onClick={() => pick(q)}
                      >
                        {q.title}
                        <br />
                        <small>
                          {q.current_version
                            ? `Publié · v${q.current_version}`
                            : "Brouillon"}
                        </small>
                      </button>
                    ))}
                </div>
              </aside>
              <section className="admin-editor">
                {!chosen ? (
                  <div className="empty">Choisis un parcours.</div>
                ) : tab === "content" ? (
                  <>
                    <label>
                      Titre de l’affirmation
                      <input
                        value={body.title}
                        onChange={(e) => {
                          setBody({ ...body, title: e.target.value });
                          setReviewed(false);
                        }}
                      />
                    </label>
                    <label>
                      Introduction
                      <textarea
                        value={body.intro}
                        onChange={(e) => {
                          setBody({ ...body, intro: e.target.value });
                          setReviewed(false);
                        }}
                      />
                    </label>
                    {body.questions.map((q: any, i: number) => (
                      <fieldset key={q.id}>
                        <legend>Question {i + 1}</legend>
                        <label>
                          Énoncé
                          <textarea
                            value={q.prompt}
                            onChange={(e) =>
                              changeQuestion(i, { prompt: e.target.value })
                            }
                          />
                        </label>
                        {q.choices.map((choice: any, j: number) => (
                          <label key={choice.id}>
                            Proposition {choice.id.toUpperCase()}
                            <input
                              value={choice.text}
                              onChange={(e) =>
                                changeQuestion(i, {
                                  choices: q.choices.map((x: any, k: number) =>
                                    k === j
                                      ? { ...x, text: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          Bonne réponse
                          <select
                            value={q.correctChoiceId}
                            onChange={(e) =>
                              changeQuestion(i, {
                                correctChoiceId: e.target.value,
                              })
                            }
                          >
                            {q.choices.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.id.toUpperCase()} — {c.text}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Explication
                          <textarea
                            value={q.explanation}
                            onChange={(e) =>
                              changeQuestion(i, { explanation: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Nuance
                          <textarea
                            value={q.nuance}
                            onChange={(e) =>
                              changeQuestion(i, { nuance: e.target.value })
                            }
                          />
                        </label>
                        {q.sources.map((s: any, j: number) => (
                          <div className="admin-sources" key={j}>
                            <strong>Source officielle {j + 1}</strong>
                            {[
                              ["publisher", "Institution"],
                              ["title", "Titre précis du document"],
                              ["url", "URL officielle HTTPS"],
                              ["checkedAt", "Date de vérification"],
                            ].map(([key, label]) => (
                              <label key={key}>
                                {label}
                                <input
                                  type={
                                    key === "checkedAt"
                                      ? "date"
                                      : key === "url"
                                        ? "url"
                                        : "text"
                                  }
                                  value={s[key]}
                                  onChange={(e) =>
                                    changeQuestion(i, {
                                      sources: q.sources.map(
                                        (x: any, k: number) =>
                                          k === j
                                            ? { ...x, [key]: e.target.value }
                                            : x,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        ))}
                        <button
                          className="button"
                          onClick={() =>
                            changeQuestion(i, {
                              sources: [
                                ...q.sources,
                                {
                                  title: "",
                                  publisher: "",
                                  url: "",
                                  checkedAt: new Date()
                                    .toISOString()
                                    .slice(0, 10),
                                },
                              ],
                            })
                          }
                        >
                          Ajouter une source
                        </button>
                      </fieldset>
                    ))}
                    <button
                      className="button"
                      onClick={() => {
                        setBody({
                          ...body,
                          questions: [
                            ...body.questions,
                            blankQuestion(
                              `${chosen.id}-${crypto.randomUUID()}`,
                              "",
                            ),
                          ],
                        });
                        setReviewed(false);
                      }}
                    >
                      Ajouter une question
                    </button>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      <span>
                        J’ai vérifié les sources officielles, leur pertinence,
                        les quatre propositions et la portée des explications.
                      </span>
                    </label>
                    <button
                      disabled={busy}
                      className="button"
                      onClick={() =>
                        run(async () => {
                          await api(`/admin/quizzes/${chosen.id}/draft`, {
                            method: "PUT",
                            body: JSON.stringify(body),
                          });
                          setNotice("Brouillon enregistré.");
                          const updated = await api<any[]>("/admin/quizzes");
                          setRows(updated);
                          setChosen(updated.find((q) => q.id === chosen.id));
                        })
                      }
                    >
                      Enregistrer le brouillon
                    </button>
                    <button
                      disabled={busy || !reviewed}
                      className="button dark"
                      onClick={() =>
                        run(async () => {
                          const result = await post(
                            `/admin/quizzes/${chosen.id}/publish`,
                            {
                              body,
                              expectedVersion: chosen.current_version || 0,
                              editorialReviewed: true,
                            },
                          );
                          setNotice(`Version ${result.version} publiée.`);
                          const updated = await api<any[]>("/admin/quizzes");
                          setRows(updated);
                          setChosen(updated.find((q) => q.id === chosen.id));
                          setReviewed(false);
                        })
                      }
                    >
                      Publier une nouvelle version
                    </button>
                  </>
                ) : (
                  <>
                    <h2>{chosen.title}</h2>
                    <p className="small muted">
                      Premières réponses des participants adultes volontaires.
                      Aucune estimation représentative des Français. Les
                      questions suivantes peuvent être influencées par les
                      explications précédentes.
                    </p>
                    {!chosen.current_version ? (
                      <p className="notice">Aucune version publiée.</p>
                    ) : (
                      <>
                        <div className="form-grid">
                          <label>
                            Version
                            <select
                              value={version}
                              onChange={(e) =>
                                setVersion(Number(e.target.value))
                              }
                            >
                              {Array.from(
                                { length: chosen.current_version },
                                (_, i) => (
                                  <option key={i} value={i + 1}>
                                    Version {i + 1}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label>
                            Comparer selon
                            <select
                              value={dimension}
                              onChange={(e) => setDimension(e.target.value)}
                            >
                              {[
                                ["all", "Ensemble"],
                                ["ageBand", "Tranche d’âge"],
                                ["gender", "Genre"],
                                ["country", "Pays"],
                                ["department", "Département"],
                              ].map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button
                          disabled={busy}
                          className="button"
                          onClick={() =>
                            run(async () =>
                              setStats(
                                await api(
                                  `/admin/stats?quiz=${chosen.id}&version=${version}&dimension=${dimension}`,
                                ),
                              ),
                            )
                          }
                        >
                          Afficher les résultats
                        </button>
                        {stats && (
                          <>
                            <p className="notice">
                              {stats.population} Groupes de moins de 20
                              participants ou répartitions rares masqués. Un
                              seul axe démographique à la fois.
                            </p>
                            {!stats.distribution.length ? (
                              <p>Aucune contribution pour cette version.</p>
                            ) : (
                              stats.distribution.map((g: any) => (
                                <div
                                  className="stat-block"
                                  key={g.questionId + g.segment}
                                >
                                  <h3>
                                    {g.questionId} · {g.segment}
                                  </h3>
                                  {g.suppressed ? (
                                    <p className="muted">
                                      Effectif insuffisant ou répartition trop
                                      rare : résultats masqués.
                                    </p>
                                  ) : (
                                    <>
                                      <p>{g.n} participants</p>
                                      <table className="stats-table">
                                        <thead>
                                          <tr>
                                            <th>Réponse</th>
                                            <th>Nombre</th>
                                            <th>Part</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Object.entries(g.counts).map(
                                            ([choice, n]: any) => (
                                              <tr key={choice}>
                                                <td>{choice.toUpperCase()}</td>
                                                <td>{n}</td>
                                                <td>
                                                  {Math.round((n / g.n) * 100)}{" "}
                                                  %
                                                </td>
                                              </tr>
                                            ),
                                          )}
                                        </tbody>
                                      </table>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                            {chartRows.length > 0 && (
                              <div
                                style={{
                                  height: Math.min(
                                    700,
                                    chartRows.length * 40 + 80,
                                  ),
                                }}
                              >
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={chartRows} layout="vertical">
                                    <XAxis
                                      type="number"
                                      allowDecimals={false}
                                    />
                                    <YAxis
                                      dataKey="label"
                                      type="category"
                                      width={150}
                                    />
                                    <Tooltip />
                                    <Bar
                                      dataKey="participants"
                                      fill="#8871b5"
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                            <h3>Perception avant / après</h3>
                            <p className="small">
                              {stats.perceptions.scope}. Seules les personnes
                              ayant répondu aux deux étapes sont comparées ;
                              cela ne mesure pas un effet causal durable.
                            </p>
                            {stats.perceptions.suppressed ? (
                              <p className="notice">
                                Résultats masqués : effectif insuffisant ou
                                cellules rares.
                              </p>
                            ) : (
                              <table className="stats-table">
                                <thead>
                                  <tr>
                                    <th>Avant (1–5)</th>
                                    <th>Après (1–5)</th>
                                    <th>Participants</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stats.perceptions.pairs.map(
                                    (p: any, i: number) => (
                                      <tr key={i}>
                                        <td>
                                          {p.before_value ?? "Ne sait pas"}
                                        </td>
                                        <td>
                                          {p.after_value ?? "Ne sait pas"}
                                        </td>
                                        <td>{p.n}</td>
                                      </tr>
                                    ),
                                  )}
                                </tbody>
                              </table>
                            )}
                            <button
                              className="button"
                              onClick={() => {
                                const lines = [
                                  "question,segment,choix,participants",
                                ];
                                for (const g of stats.distribution)
                                  if (!g.suppressed)
                                    for (const [choice, n] of Object.entries(
                                      g.counts,
                                    ))
                                      lines.push(
                                        [g.questionId, g.segment, choice, n]
                                          .map(
                                            (v) =>
                                              '"' +
                                              String(v).replaceAll('"', '""') +
                                              '"',
                                          )
                                          .join(","),
                                      );
                                download(
                                  lines.join("\n"),
                                  "nouvel-ordre-resultats-agreges.csv",
                                  "text/csv",
                                );
                              }}
                            >
                              Exporter les résultats non masqués
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
