import { z } from "zod";
import { isOfficialSource } from "./sources";
export const ages = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;
export const genders = [
  "woman",
  "man",
  "nonbinary",
  "other",
  "undisclosed",
] as const;
export const profileSchema = z
  .object({
    ageBand: z.enum(ages).nullable(),
    gender: z.enum(genders).nullable(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    department: z
      .string()
      .regex(/^(?:0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/)
      .nullable(),
  })
  .strict()
  .refine((p) => !p.department || p.country === "FR", {
    message: "Le département concerne uniquement la France.",
  });
export const consentSchema = z
  .object({
    accepted: z.literal(true),
    adult: z.literal(true),
    version: z.literal("research-v1"),
    profile: profileSchema,
  })
  .strict();
export const answerSchema = z
  .object({
    questionId: z.string().max(100),
    choiceId: z.string().max(100),
    version: z.number().int().positive(),
  })
  .strict();
export const perceptionSchema = z
  .object({
    phase: z.enum(["before", "after"]),
    value: z.number().int().min(1).max(5).nullable(),
    version: z.number().int().positive(),
  })
  .strict();
export const sourceSchema = z.object({
  title: z.string().min(3),
  publisher: z.string().min(2),
  url: z
    .url()
    .refine(isOfficialSource, {
      message:
        "Une source officielle HTTPS appartenant à la liste éditoriale est requise.",
    }),
  checkedAt: z.iso.date(),
  publishedAt: z.string().max(40).optional(),
});
export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    prompt: z.string().min(15),
    choices: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          text: z.string().min(1),
        }),
      )
      .length(4),
    correctChoiceId: z.string(),
    explanation: z.string().min(40),
    nuance: z.string().min(15),
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((q, c) => {
    if (
      new Set(q.choices.map((x) => x.id)).size !== 4 ||
      new Set(q.choices.map((x) => x.text)).size !== 4
    )
      c.addIssue({
        code: "custom",
        message: "Quatre propositions distinctes requises.",
      });
    if (!q.choices.some((x) => x.id === q.correctChoiceId))
      c.addIssue({ code: "custom", message: "Réponse correcte absente." });
  });
export const quizBodySchema = z
  .object({
    title: z.string().min(5).max(200),
    intro: z.string().min(20),
    questions: z.array(questionSchema).min(3).max(12),
  })
  .superRefine((q, c) => {
    if (new Set(q.questions.map((x) => x.id)).size !== q.questions.length)
      c.addIssue({
        code: "custom",
        message: "Identifiants de question dupliqués.",
      });
  });
export type QuizBody = z.infer<typeof quizBodySchema>;
export type Demographics = z.infer<typeof profileSchema>;
export const CONSENT_VERSION = "research-v1";
export const RESEARCH_NOTICE =
  "Je souhaite contribuer aux analyses de Nouvel Ordre. J’accepte explicitement que mes réponses, pouvant révéler des opinions politiques, soient rapprochées de mes informations démographiques pour produire des statistiques sur les participants. Cette participation est facultative, sans avantage ni conséquence sur l’accès aux quiz. Je peux retirer mon consentement et supprimer ma contribution à tout moment.";
