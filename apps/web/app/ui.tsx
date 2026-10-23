"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Check,
  Search,
  X,
  Share2,
  BookOpen,
  Menu,
  ExternalLink,
  ChevronRight,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import catalogFallback from "../../../content/catalog.json";
import { api, authClient, post, API } from "./api-client";
import { RESEARCH_NOTICE } from "../../../packages/shared/validation";
type Q = {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
};
type Quiz = {
  id: string;
  slug: string;
  title: string;
  intro: string;
  version: number;
  questions: Q[];
};
type Correction = {
  questionId: string;
  selectedChoiceId: string;
  correctChoiceId: string;
  explanation: string;
  nuance: string;
  sources: {
    title: string;
    publisher: string;
    url: string;
    checkedAt: string;
  }[];
};
type Progress = {
  quiz_id: string;
  version: number;
  cursor: number;
  completed: number;
};
type Me = {
  user: { id: string; name: string } | null;
  admin?: boolean;
  progress: Progress[];
  research: any;
};
const emptyMe: Me = { user: null, progress: [], research: null };
const labels = [
  "Pas du tout vraie",
  "Plutôt fausse",
  "Ni vraie ni fausse",
  "Plutôt vraie",
  "Tout à fait vraie",
];
const readLocal = (): Progress[] => {
  try {
    const data = JSON.parse(localStorage.getItem("no-progress-v1") || "[]");
    return Array.isArray(data)
      ? data.filter(
          (p) =>
            typeof p.quiz_id === "string" &&
            Number.isInteger(p.cursor) &&
            p.cursor >= 0 &&
            Number.isInteger(p.version),
        )
      : [];
  } catch {
    return [];
  }
};
export default function Experience({ initialSlug }: { initialSlug?: string }) {
  const [catalog, setCatalog] = useState<any>(null),
    [me, setMe] = useState<Me>(emptyMe),
    [local, setLocal] = useState<Progress[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [config, setConfig] = useState<any>({ authConfigured: false });
  const [category, setCategory] = useState("all"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("available"),
    [accountOpen, setAccountOpen] = useState(false),
    [privacyOpen, setPrivacyOpen] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null),
    [started, setStarted] = useState(false),
    [index, setIndex] = useState(0),
    [selected, setSelected] = useState(""),
    [correction, setCorrection] = useState<Correction | null>(null),
    [history, setHistory] = useState<Correction[]>([]),
    [busy, setBusy] = useState(false),
    [finished, setFinished] = useState(false),
    [perceptionDone, setPerceptionDone] = useState(false);
  const focus = useRef<HTMLHeadingElement>(null);
  const progress = me.user ? me.progress : local;
  async function refreshMe() {
    const m = await api<Me>("/me");
    setMe(m);
    return m;
  }
  async function boot() {
    setError("");
    try {
      const [cat, m, conf] = await Promise.all([
        api("/catalog"),
        api<Me>("/me"),
        api("/config"),
      ]);
      setCatalog(cat);
      setMe(m);
      setConfig(conf);
      setReady(true);
    } catch (e) {
      setError(
        (e as Error).message ||
          "Le service est inaccessible. Réessaie dans un instant.",
      );
      setReady(true);
    }
  }
  useEffect(() => {
    setLocal(readLocal());
    void boot();
  }, []);
  useEffect(() => {
    if (initialSlug && catalog)
      void loadQuiz(initialSlug); /* catalog triggers once */
  }, [initialSlug, !!catalog]);
  useEffect(() => {
    if (started) focus.current?.focus();
  }, [index, started, finished]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const entries =
    catalog?.quizzes ||
    catalogFallback.quizzes.map((q) => ({
      ...q,
      category_id: q.categoryId,
      current_version: null,
    }));
  const categories = catalog?.categories || catalogFallback.categories;
  const available = entries.filter((q: any) => q.current_version).length;
  const visible = useMemo(
    () =>
      entries.filter((q: any) => {
        const p = progress.find(
          (p) => p.quiz_id === q.id && p.version === q.current_version,
        );
        return (
          (category === "all" || q.category_id === category) &&
          q.title
            .toLocaleLowerCase("fr")
            .includes(query.toLocaleLowerCase("fr")) &&
          (filter === "all" ||
            (filter === "available" && q.current_version) ||
            (filter === "draft" && !q.current_version) ||
            (filter === "started" && p && !p.completed) ||
            (filter === "done" && p?.completed))
        );
      }),
    [entries, category, query, filter, progress],
  );
  async function loadQuiz(slug: string) {
    setBusy(true);
    setError("");
    try {
      const q = await api<Quiz>("/quizzes/" + slug);
      const p = progress.find(
        (p) => p.quiz_id === q.id && p.version === q.version,
      );
      setQuiz(q);
      setIndex(
        p && !p.completed ? Math.min(p.cursor, q.questions.length - 1) : 0,
      );
      setStarted(false);
      setFinished(false);
      setCorrection(null);
      setHistory([]);
      setSelected("");
      setPerceptionDone(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share(title: string, url: string, text?: string) {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text:
            text ||
            "Une affirmation à examiner, des questions pour comprendre.",
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text || title}\n${url}`);
        setToast("Lien copié. À toi de le partager !");
      } else {
        setToast(url);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setToast("Le partage a échoué. Copie l’adresse de la page.");
    }
  }
  async function answer() {
    if (!quiz || !selected || busy || correction) return;
    setBusy(true);
    setError("");
    try {
      const result = await post("/quizzes/" + quiz.slug + "/answers", {
        questionId: quiz.questions[index].id,
        choiceId: selected,
        version: quiz.version,
      });
      setCorrection(result);
      setHistory((h) => [...h, result]);
      const p = {
        quiz_id: quiz.id,
        version: quiz.version,
        cursor: index + 1,
        completed: index === quiz.questions.length - 1 ? 1 : 0,
      };
      if (me.user) {
        await refreshMe();
      } else {
        setLocal((previous) => {
          const old = previous.find(
            (x) => x.quiz_id === p.quiz_id && x.version === p.version,
          );
          const merged = {
            ...p,
            cursor: Math.max(old?.cursor || 0, p.cursor),
            completed: Math.max(old?.completed || 0, p.completed),
          };
          const next = [
            ...previous.filter(
              (x) => !(x.quiz_id === p.quiz_id && x.version === p.version),
            ),
            merged,
          ];
          try {
            localStorage.setItem("no-progress-v1", JSON.stringify(next));
          } catch {
            setToast(
              "Le navigateur ne permet pas de conserver ta progression.",
            );
          }
          return next;
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (!quiz) return;
    if (index === quiz.questions.length - 1) {
      setFinished(true);
      setCorrection(null);
    } else {
      setIndex((i) => i + 1);
      setSelected("");
      setCorrection(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function signIn() {
    setError("");
    try {
      const r = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin + window.location.pathname,
      });
      if (r.error) throw new Error(r.error.message);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const current = quiz?.questions[index];
  const quizProgress =
    quiz &&
    progress.find((p) => p.quiz_id === quiz.id && p.version === quiz.version);
  return (
    <>
      <a href="#main" className="skip">
        Aller au contenu
      </a>
      <header className="header">
        <a href="/" className="brand" aria-label="Nouvel Ordre, accueil">
          <img src="/logo.png" width="76" height="76" alt="Nouvel Ordre" />
        </a>
        <nav aria-label="Navigation principale">
          <a href="/" className="active">
            Les quiz
          </a>
          <a
            href="https://nouvel-ordre.fr/enquetes/le-prix-du-refus/"
            className="desktop"
          >
            Les enquêtes <ArrowUpRight size={14} />
          </a>
          <button
            onClick={() => {
              setQuiz(null);
              setFilter("done");
              window.history.replaceState(null, "", "/");
            }}
          >
            Mes quiz
          </button>
        </nav>
        <button className="account-button"
          aria-label={me.user ? "Mon compte" : "Se connecter"} onClick={() => setAccountOpen(true)}>
          <UserRound size={17} />
          <span>{me.user ? "Mon compte" : "Se connecter"}</span>
        </button>
      </header>
      <main id="main" className="container">
        {error && (
          <div className="notice error" role="alert">
            {error} {!quiz && <button onClick={boot}>Réessayer</button>}
            <button
              className="icon-button"
              aria-label="Fermer le message"
              onClick={() => setError("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {!quiz ? (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">
                  <span className="dot" /> LES PHRASES QU’ON ENTEND PARTOUT.
                </p>
                <h1>
                  On a tous
                  <br />
                  des certitudes.
                  <br />
                  <span>Et si on vérifiait ?</span>
                </h1>
                <p className="lead">
                  Des questions pour prendre du recul.
                  <br />
                  Des explications et des sources pour se faire une opinion.
                </p>
                <div className="hero-actions">
                  <a href="#catalogue" className="button dark">
                    Explorer les quiz <ArrowRight size={18} />
                  </a>
                  <span>Gratuit. Sans classement. À ton rythme.</span>
                </div>
              </div>
              <aside
                className="hero-art"
                aria-label="Comprendre en trois étapes"
              >
                <span className="eyebrow">
                  UNE AFFIRMATION. PLUSIEURS QUESTIONS.
                </span>
                <div className="art-quote">
                  « On l’a
                  <br />
                  toujours
                  <br />
                  entendu. »
                </div>
                <div className="art-arrow" aria-hidden="true">
                  ↗
                </div>
                <div className="art-foot">
                  <span>
                    RÉPONDRE.
                    <br />
                    COMPRENDRE.
                    <br />
                    SE FAIRE UNE OPINION.
                  </span>
                  <BookOpen size={30} />
                </div>
              </aside>
            </section>
            <section id="catalogue" className="catalogue">
              <div className="section-head">
                <h2>À toi de questionner.</h2>
                <span>
                  {catalog
                    ? `${available} DISPONIBLES · ${entries.length - available} EN PRÉPARATION`
                    : "CHARGEMENT DU CATALOGUE"}
                </span>
              </div>
              <div className="toolbar">
                <label className="search">
                  <Search size={19} />
                  <input
                    placeholder="Une idée reçue, un sujet…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Rechercher un quiz"
                  />
                  {query && (
                    <button
                      aria-label="Effacer la recherche"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <label className="category-select">
                  <span className="sr-only">Catégorie</span>
                  <select
                    aria-label="Catégorie"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">Toutes les catégories</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className="filter-row"
                role="group"
                aria-label="Filtrer les quiz"
              >
                {[
                  ["available", "À découvrir"],
                  ["started", "À reprendre"],
                  ["done", "Terminés"],
                  ["draft", "En préparation"],
                  ["all", "Tous"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={filter === id}
                    className={filter === id ? "selected" : ""}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!catalog && !ready ? (
                <p role="status" className="empty">
                  Le catalogue arrive…
                </p>
              ) : !catalog ? (
                <p className="empty">
                  Le catalogue est momentanément inaccessible.{" "}
                  <button onClick={boot}>Réessayer</button>
                </p>
              ) : visible.length === 0 ? (
                <div className="empty">
                  <h3>Aucun quiz ici pour le moment.</h3>
                  <p>
                    Essaie un autre sujet ou découvre les parcours disponibles.
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                      setFilter("available");
                    }}
                  >
                    Voir les quiz disponibles
                  </button>
                </div>
              ) : (
                <div className="quiz-grid">
                  {visible.map((q: any, i: number) => {
                    const p = progress.find(
                      (p) =>
                        p.quiz_id === q.id && p.version === q.current_version,
                    );
                    const cat = categories.find(
                      (c: any) => c.id === q.category_id,
                    );
                    return (
                      <article
                        key={q.id}
                        className={
                          "quiz-card tone-" +
                          (i % 4) +
                          (q.current_version ? "" : " draft")
                        }
                      >
                        <div className="card-top">
                          <span>{cat?.name}</span>
                          {p?.completed ? (
                            <span className="status">
                              <Check size={13} /> Terminé
                            </span>
                          ) : p?.cursor ? (
                            <span className="status">À reprendre</span>
                          ) : null}
                        </div>
                        <h3>« {q.title} »</h3>
                        <div className="card-bottom">
                          {q.current_version ? (
                            <>
                              <span>
                                {q.question_count} questions ·{" "}
                                {Math.max(2, q.question_count)} min
                              </span>
                              <a
                                className="circle-link"
                                href={"/quiz/" + q.slug + "/"}
                                aria-label={"Ouvrir le quiz : " + q.title}
                              >
                                <ArrowUpRight size={23} />
                              </a>
                            </>
                          ) : (
                            <span>
                              En préparation · vérification des sources
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="method">
              <div>
                <p className="eyebrow">LA MÉTHODE NOUVEL ORDRE</p>
                <h2>
                  Pas besoin d’être d’accord.
                  <br />
                  Commençons par comprendre.
                </h2>
              </div>
              <div>
                <p>
                  Un titre reprend une affirmation courante. Les questions
                  examinent les faits, les mots et le contexte. Une réponse ne
                  définit jamais tes convictions.
                </p>
                <p>
                  Après chaque étape : une explication, une nuance et les
                  sources. Les parcours en préparation restent fermés tant que
                  leurs réponses ne sont pas vérifiées.
                </p>
              </div>
            </section>
          </>
        ) : (
          <section className="player">
            <a href="/" className="back">
              <ArrowLeft size={16} /> Tous les quiz
            </a>
            <div className="player-label">
              <span className="eyebrow">UNE AFFIRMATION À EXAMINER</span>
              <button
                className="text-button"
                onClick={() =>
                  share(
                    quiz.title,
                    window.location.origin + "/quiz/" + quiz.slug + "/",
                  )
                }
              >
                <Share2 size={16} /> Partager ce quiz
              </button>
            </div>
            {!started ? (
              <div className="quiz-intro">
                <h1>« {quiz.title} »</h1>
                <p className="lead">{quiz.intro}</p>
                <p className="muted">
                  {quiz.questions.length} questions · Explications et sources à
                  chaque étape
                </p>
                {quizProgress?.completed ? (
                  <div className="notice">
                    Tu as déjà terminé cette version. Tu peux la relire ; tes
                    nouvelles réponses ne remplaceront pas ta première
                    participation à l’étude.
                  </div>
                ) : null}
                {me.research && !quizProgress?.cursor && !perceptionDone ? (
                  <Perception
                    onSubmit={async (value) => {
                      await post("/quizzes/" + quiz.slug + "/perceptions", {
                        phase: "before",
                        value,
                        version: quiz.version,
                      });
                      setPerceptionDone(true);
                    }}
                    onSkip={() => setPerceptionDone(true)}
                    phase="before"
                  />
                ) : null}
                <button
                  className="button dark"
                  onClick={() => setStarted(true)}
                >
                  {index > 0 ? "Reprendre le quiz" : "Commencer le quiz"}
                  <ArrowRight size={18} />
                </button>
                <p className="small muted">
                  {me.user
                    ? "Ta progression est enregistrée dans ton compte."
                    : "Sans compte, la progression reste dans ce navigateur."}
                </p>
              </div>
            ) : finished ? (
              <div className="results">
                <p className="eyebrow">
                  <Check size={16} /> PARCOURS TERMINÉ
                </p>
                <h1 ref={focus} tabIndex={-1}>
                  Un sujet.
                  <br />
                  <span>Un regard plus précis.</span>
                </h1>
                <p className="lead">
                  Tu as parcouru « {quiz.title} ». Garde les distinctions utiles
                  et prends le temps de consulter les sources.
                </p>
                {me.research && !perceptionDone ? (
                  <Perception
                    phase="after"
                    onSubmit={async (value) => {
                      await post("/quizzes/" + quiz.slug + "/perceptions", {
                        phase: "after",
                        value,
                        version: quiz.version,
                      });
                      setPerceptionDone(true);
                    }}
                    onSkip={() => setPerceptionDone(true)}
                  />
                ) : null}
                <div className="hero-actions">
                  <button
                    className="button dark"
                    onClick={() =>
                      share(
                        quiz.title,
                        window.location.origin + "/quiz/" + quiz.slug + "/",
                        `J’ai terminé le quiz « ${quiz.title} » sur Nouvel Ordre. Et toi, qu’en penses-tu ?`,
                      )
                    }
                  >
                    <Share2 size={17} /> Partager mon parcours
                  </button>
                  <a href="/" className="button">
                    Découvrir un autre quiz <ArrowRight size={17} />
                  </a>
                </div>
                <h2>Ce qu’on a examiné</h2>
                {history.map((r) => {
                  const q = quiz.questions.find((q) => q.id === r.questionId)!;
                  return (
                    <details key={r.questionId} className="review">
                      <summary>
                        {q.prompt}
                        <ChevronRight size={18} />
                      </summary>
                      <p>
                        <b>La réponse :</b>{" "}
                        {
                          q.choices.find((x) => x.id === r.correctChoiceId)
                            ?.text
                        }
                      </p>
                      <p>{r.explanation}</p>
                      <p className="nuance">{r.nuance}</p>
                      <Sources sources={r.sources} />
                    </details>
                  );
                })}
                {history.length < quiz.questions.length && (
                  <p className="muted">
                    Ce récapitulatif affiche les étapes de cette session. Tu
                    peux relire le quiz pour retrouver les précédentes.
                  </p>
                )}
              </div>
            ) : current ? (
              <>
                <div className="step-head">
                  <span>
                    Question {index + 1} sur {quiz.questions.length}
                  </span>
                  <span>{quiz.title}</span>
                </div>
                <div
                  className="step-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={quiz.questions.length}
                  aria-valuenow={index}
                  aria-label="Progression"
                >
                  <span
                    style={{
                      width: `${(index / quiz.questions.length) * 100}%`,
                    }}
                  />
                </div>
                <h1 className="question-title" ref={focus} tabIndex={-1}>
                  {current.prompt}
                </h1>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void answer();
                  }}
                >
                  <fieldset className="choices" disabled={busy || !!correction}>
                    <legend className="sr-only">Choisis une réponse</legend>
                    {current.choices.map((choice, i) => (
                      <label
                        key={choice.id}
                        className={
                          "choice " +
                          (selected === choice.id ? "chosen " : "") +
                          (correction
                            ? correction.correctChoiceId === choice.id
                              ? "correct"
                              : correction.selectedChoiceId === choice.id
                                ? "incorrect"
                                : ""
                            : "")
                        }
                      >
                        <input
                          type="radio"
                          name="answer"
                          value={choice.id}
                          checked={selected === choice.id}
                          onChange={() => setSelected(choice.id)}
                        />
                        <span className="choice-letter">{"ABCD"[i]}</span>
                        <span>{choice.text}</span>
                        {correction?.correctChoiceId === choice.id && (
                          <span className="choice-verdict">
                            <Check size={17} /> Bonne réponse
                          </span>
                        )}
                        {correction?.selectedChoiceId === choice.id &&
                          choice.id !== correction.correctChoiceId && (
                            <span className="choice-verdict">Ta réponse</span>
                          )}
                      </label>
                    ))}
                  </fieldset>
                  {!correction && (
                    <button
                      className="button dark answer-button"
                      disabled={!selected || busy}
                      type="submit"
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : null}
                      Voir l’explication <ArrowRight size={17} />
                    </button>
                  )}
                </form>
                {correction && (
                  <section className="explanation" aria-live="polite">
                    <p className="eyebrow">
                      {correction.selectedChoiceId ===
                      correction.correctChoiceId
                        ? "C’EST LA BONNE RÉPONSE"
                        : "VOICI CE QU’IL FAUT DISTINGUER"}
                    </p>
                    <h2>Comprendre la réponse.</h2>
                    <p>{correction.explanation}</p>
                    <div className="nuance">
                      <b>La nuance</b>
                      <p>{correction.nuance}</p>
                    </div>
                    <Sources sources={correction.sources} />
                    <button
                      className="button dark"
                      onClick={() => {
                        if (index === quiz.questions.length - 1)
                          setPerceptionDone(false);
                        next();
                      }}
                    >
                      {index === quiz.questions.length - 1
                        ? "Voir mon récapitulatif"
                        : "Question suivante"}
                      <ArrowRight size={17} />
                    </button>
                  </section>
                )}
              </>
            ) : null}
          </section>
        )}
      </main>
      <footer>
        <div>
          <strong>NOUVEL ORDRE</strong>
          <p>
            Les phrases qu’on entend partout.
            <br />
            Les faits pour se faire une opinion.
          </p>
        </div>
        <div>
          <button onClick={() => setPrivacyOpen(true)}>
            Données et confidentialité
          </button>
          <a href="https://nouvel-ordre.fr/">
            Découvrir le média <ArrowUpRight size={14} />
          </a>
          {me.admin && <a href="/admin/">Administration</a>}
        </div>
        <span>GRATUIT · SANS CLASSEMENT</span>
      </footer>
      <Dialog.Root open={accountOpen} onOpenChange={setAccountOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="modal">
            <Dialog.Title>Ton espace Nouvel Ordre</Dialog.Title>
            <Dialog.Description>
              Retrouve tes parcours et choisis ce que tu souhaites partager.
            </Dialog.Description>
            <Dialog.Close className="modal-close" aria-label="Fermer">
              <X />
            </Dialog.Close>
            {!me.user ? (
              <>
                <p>
                  Connecte-toi avec Google pour retrouver ta progression sur tes
                  appareils. Nous ne demandons aucun accès à tes e-mails.
                </p>
                <button
                  className="button dark full"
                  disabled={!config.authConfigured}
                  onClick={signIn}
                >
                  Continuer avec Google <ArrowRight size={17} />
                </button>
                {!config.authConfigured && (
                  <p className="small">
                    La connexion Google n’est pas encore disponible sur cet
                    environnement. Les quiz restent accessibles sans compte.
                  </p>
                )}
                <Dialog.Close className="button full">
                  Continuer sans compte
                </Dialog.Close>
              </>
            ) : (
              <>
                <p>Bonjour {me.user.name}.</p>
                <ResearchSettings
                  me={me}
                  refresh={refreshMe}
                  toast={setToast}
                />
                <div className="account-actions">
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        const data = await api("/me/export");
                        download(
                          JSON.stringify(data, null, 2),
                          "nouvel-ordre-mes-donnees.json",
                          "application/json",
                        );
                      } catch (e) {
                        setToast((e as Error).message);
                      }
                    }}
                  >
                    Exporter mes données
                  </button>
                  <button
                    className="button"
                    onClick={async () => {
                      await authClient.signOut();
                      setMe(emptyMe);
                      setAccountOpen(false);
                      window.location.assign("/");
                    }}
                  >
                    Me déconnecter
                  </button>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Supprimer ton compte, ta progression et tes contributions à l’étude ? Cette action est définitive.",
                        )
                      )
                        return;
                      try {
                        await api("/me", { method: "DELETE" });
                        setMe(emptyMe);
                        setAccountOpen(false);
                        setToast(
                          "Ton compte et ses données ont été supprimés.",
                        );
                        window.location.assign("/");
                      } catch (e) {
                        setToast((e as Error).message);
                      }
                    }}
                  >
                    Supprimer mon compte
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="modal">
            <Dialog.Title>Données et confidentialité</Dialog.Title>
            <Dialog.Description>
              Tu peux apprendre sans participer aux analyses.
            </Dialog.Description>
            <Dialog.Close className="modal-close" aria-label="Fermer">
              <X />
            </Dialog.Close>
            <h3>Progression</h3>
            <p>
              Sans compte, seuls les identifiants des quiz et les étapes
              terminées restent dans ton navigateur. Avec un compte, cette
              progression est synchronisée. Les réponses détaillées ne sont pas
              enregistrées dans ton compte sans participation explicite à
              l’étude.
            </p>
            <h3>Contribution facultative</h3>
            <p>{RESEARCH_NOTICE}</p>
            <p>
              Réservée aux adultes. Les réponses et perceptions sont conservées
              au maximum 12 mois, avec des données démographiques facultatives.
              Elles sont pseudonymisées, pas anonymes. Retirer sa participation
              efface les contributions liées à son compte.
            </p>
            <h3>Accès et statistiques</h3>
            <p>
              Les statistiques sont réservées à l’administration. Les petits
              groupes et certaines répartitions rares sont masqués. Elles
              décrivent les participants volontaires, pas la population
              française. Aucun profil politique individuel n’est attribué.
            </p>
            <h3>Tes choix</h3>
            <p>
              Depuis ton compte, tu peux retirer ta participation, exporter tes
              données ou supprimer le compte. Aucun partage de réponses n’est
              automatique. Aucun outil publicitaire n’est intégré.
            </p>
            <p>
              Responsable : {config.publisher || "Nouvel Ordre"}.{" "}
              {config.contact
                ? `Contact : ${config.contact}`
                : "Les coordonnées de contact seront renseignées avant l’ouverture des comptes."}{" "}
              Prestataires : Cloudflare (hébergement et base UE), Google
              (connexion choisie). Les requêtes techniques peuvent être traitées
              par ces prestataires.
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
function Sources({ sources }: { sources: Correction["sources"] }) {
  return (
    <div className="sources">
      <p className="eyebrow">REMONTONS AUX SOURCES</p>
      {sources.map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
          <span>
            <strong>{s.publisher}</strong> · {s.title}
            <small>
              Consultée le{" "}
              {new Date(s.checkedAt + "T12:00:00").toLocaleDateString("fr-FR")}
            </small>
          </span>
          <ArrowUpRight size={19} />
        </a>
      ))}
    </div>
  );
}
function Perception({
  phase,
  onSubmit,
  onSkip,
}: {
  phase: "before" | "after";
  onSubmit: (v: number | null) => Promise<void>;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <aside className="perception">
      <p className="eyebrow">
        ÉTUDE FACULTATIVE ·{" "}
        {phase === "before" ? "AVANT LE PARCOURS" : "APRÈS LE PARCOURS"}
      </p>
      <h3>À quel point cette affirmation te paraît-elle vraie ?</h3>
      <p>Il n’y a pas de bonne réponse ici. Tu peux aussi passer.</p>
      <div className="perception-options">
        {[...labels, "Je ne sais pas"].map((label, i) => (
          <button
            disabled={busy}
            key={label}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onSubmit(i === 5 ? null : i + 1);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <button className="text-button" disabled={busy} onClick={onSkip}>
        Passer cette étape
      </button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
function ResearchSettings({
  me,
  refresh,
  toast,
}: {
  me: Me;
  refresh: () => Promise<Me>;
  toast: (s: string) => void;
}) {
  const [profile, setProfile] = useState(
      me.research?.profile || {
        ageBand: null,
        gender: null,
        country: null,
        department: null,
      },
    ),
    [accepted, setAccepted] = useState(false),
    [adult, setAdult] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="research-settings">
      <h3>Contribuer à la compréhension des idées reçues</h3>
      <p className="small">
        Facultatif. Le quiz reste exactement le même si tu refuses. Les
        statistiques décrivent uniquement nos participants.
      </p>
      {me.research ? (
        <>
          <p>
            <Check size={16} /> Ta participation est activée. Tu peux la retirer
            et effacer les réponses recueillies.
          </p>
          <button
            disabled={busy}
            className="button"
            onClick={async () => {
              setBusy(true);
              try {
                await api("/research/consent", { method: "DELETE" });
                await refresh();
                setAccepted(false);
                setAdult(false);
                toast(
                  "Ta participation et les réponses associées ont été supprimées.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Retirer ma participation
          </button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post("/research/consent", {
                accepted,
                adult,
                version: "research-v1",
                profile,
              });
              await refresh();
              toast("Participation activée pour tes prochaines réponses.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Tranche d’âge
              <select
                value={profile.ageBand || ""}
                onChange={(e) =>
                  setProfile({ ...profile, ageBand: e.target.value || null })
                }
              >
                <option value="">Ne pas préciser</option>
                {["18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Genre
              <select
                value={profile.gender || ""}
                onChange={(e) =>
                  setProfile({ ...profile, gender: e.target.value || null })
                }
              >
                <option value="">Ne pas préciser</option>
                {[
                  ["woman", "Femme"],
                  ["man", "Homme"],
                  ["nonbinary", "Non binaire"],
                  ["other", "Autre"],
                  ["undisclosed", "Préfère ne pas répondre"],
                ].map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pays de résidence
              <select
                value={profile.country || ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    country: e.target.value || null,
                    department: null,
                  })
                }
              >
                <option value="">Ne pas préciser</option>
                {[
                  ["FR", "France"],
                  ["BE", "Belgique"],
                  ["CH", "Suisse"],
                  ["IT", "Italie"],
                  ["ES", "Espagne"],
                  ["DE", "Allemagne"],
                  ["GB", "Royaume-Uni"],
                  ["CA", "Canada"],
                  ["ZZ", "Autre pays"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {profile.country === "FR" && (
              <label>
                Département (facultatif)
                <input
                  maxLength={3}
                  placeholder="Ex. 83, 2A, 971"
                  value={profile.department || ""}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      department: e.target.value.toUpperCase() || null,
                    })
                  }
                />
              </label>
            )}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              required
            />
            <span>J’ai 18 ans ou plus.</span>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
            />
            <span>{RESEARCH_NOTICE}</span>
          </label>
          <button
            disabled={busy || !accepted || !adult}
            className="button dark"
          >
            Participer volontairement
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
