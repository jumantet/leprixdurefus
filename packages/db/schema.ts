import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
});
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});
export const quizzes = sqliteTable("quizzes", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  title: text("title").notNull(),
  outline: text("outline").notNull(),
  currentVersion: integer("current_version"),
  position: integer("position").notNull(),
});
export const versions = sqliteTable(
  "quiz_versions",
  {
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id),
    version: integer("version").notNull(),
    body: text("body").notNull(),
    publishedAt: text("published_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.quizId, t.version] })],
);
export const progress = sqliteTable(
  "progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    quizId: text("quiz_id").notNull(),
    version: integer("version").notNull(),
    cursor: integer("cursor").notNull().default(0),
    completed: integer("completed").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.quizId, t.version] })],
);
