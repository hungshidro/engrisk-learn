import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const exerciseTypeEnum = pgEnum("exercise_type", ["quiz", "listening", "mixed"]);
export const questionTypeEnum = pgEnum("question_type", [
  "multiple_choice",
  "fill_in_blank",
  "word_order",
]);
export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "completed",
]);
export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "pending",
  "accepted",
  "rejected",
]);

// Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Exercises
export const exercises = pgTable("exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  type: exerciseTypeEnum("type").notNull().default("quiz"),
  audioUrl: text("audio_url"),
  ttsText: text("tts_text"), // Text for text-to-speech
  ttsType: text("tts_type"), // "paragraph" or "conversation"
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Questions
export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  type: questionTypeEnum("type").notNull(),
  audioIndex: integer("audio_index"),
  content: text("content").notNull(),
  correctAnswer: text("correct_answer"), // For fill_in_blank
  explanation: text("explanation"),
  orderIndex: integer("order_index").notNull().default(0),
});

// Question Options (for multiple choice)
export const questionOptions = pgTable("question_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
});

// Vocabularies
export const vocabularies = pgTable("vocabularies", {
  id: uuid("id").defaultRandom().primaryKey(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  pronunciation: text("pronunciation"),
  exampleSentence: text("example_sentence"),
});

// Exercise Audios (multiple listening entries)
export const exerciseAudios = pgTable("exercise_audios", {
  id: uuid("id").defaultRandom().primaryKey(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  title: text("title"),
  audioUrl: text("audio_url"),
  ttsText: text("tts_text"),
  ttsType: text("tts_type"),
  orderIndex: integer("order_index").notNull().default(0),
});

// Exercise Attempts
export const exerciseAttempts = pgTable("exercise_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  status: attemptStatusEnum("status").notNull().default("in_progress"),
  answers: jsonb("answers").$type<Record<string, string>>().default({}),
  score: integer("score"),
  totalQuestions: integer("total_questions").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vocabulary Attempts
export const vocabularyAttempts = pgTable("vocabulary_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  status: attemptStatusEnum("status").notNull().default("in_progress"),
  answers: jsonb("answers").$type<Record<string, { meaning: string; pronunciation: string }>>().default({}),
  score: integer("score"),
  totalItems: integer("total_items").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Friendships
export const friendships = pgTable("friendships", {
  id: uuid("id").defaultRandom().primaryKey(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: friendRequestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Exercise Followers
export const exerciseFollowers = pgTable("exercise_followers", {
  id: uuid("id").defaultRandom().primaryKey(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  userId: uuid("user_id") // The friend who is following
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followedUserId: uuid("followed_user_id") // The user whose progress is being tracked
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  exercises: many(exercises),
  attempts: many(exerciseAttempts),
  vocabAttempts: many(vocabularyAttempts),
  friendshipsRequested: many(friendships, { relationName: "requester" }),
  friendshipsReceived: many(friendships, { relationName: "receiver" }),
  following: many(exerciseFollowers, { relationName: "follower" }),
  followedBy: many(exerciseFollowers, { relationName: "followed" }),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  author: one(users, {
    fields: [exercises.authorId],
    references: [users.id],
  }),
  questions: many(questions),
  vocabularies: many(vocabularies),
  audios: many(exerciseAudios),
  attempts: many(exerciseAttempts),
  vocabAttempts: many(vocabularyAttempts),
  followers: many(exerciseFollowers),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  exercise: one(exercises, {
    fields: [questions.exerciseId],
    references: [exercises.id],
  }),
  options: many(questionOptions),
}));

export const questionOptionsRelations = relations(
  questionOptions,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionOptions.questionId],
      references: [questions.id],
    }),
  })
);

export const vocabulariesRelations = relations(vocabularies, ({ one }) => ({
  exercise: one(exercises, {
    fields: [vocabularies.exerciseId],
    references: [exercises.id],
  }),
}));

export const exerciseAudiosRelations = relations(exerciseAudios, ({ one }) => ({
  exercise: one(exercises, {
    fields: [exerciseAudios.exerciseId],
    references: [exercises.id],
  }),
}));

export const exerciseAttemptsRelations = relations(
  exerciseAttempts,
  ({ one }) => ({
    user: one(users, {
      fields: [exerciseAttempts.userId],
      references: [users.id],
    }),
    exercise: one(exercises, {
      fields: [exerciseAttempts.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const vocabularyAttemptsRelations = relations(
  vocabularyAttempts,
  ({ one }) => ({
    user: one(users, {
      fields: [vocabularyAttempts.userId],
      references: [users.id],
    }),
    exercise: one(exercises, {
      fields: [vocabularyAttempts.exerciseId],
      references: [exercises.id],
    }),
  })
);

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  requester: one(users, {
    fields: [friendships.requesterId],
    references: [users.id],
    relationName: "requester",
  }),
  receiver: one(users, {
    fields: [friendships.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

export const exerciseFollowersRelations = relations(
  exerciseFollowers,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [exerciseFollowers.exerciseId],
      references: [exercises.id],
    }),
    user: one(users, {
      fields: [exerciseFollowers.userId],
      references: [users.id],
      relationName: "follower",
    }),
    followedUser: one(users, {
      fields: [exerciseFollowers.followedUserId],
      references: [users.id],
      relationName: "followed",
    }),
  })
);
