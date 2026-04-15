import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  exercises,
  questions,
  questionOptions,
  vocabularies,
  exerciseAudios,
} from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";

const optionSchema = z.object({
  content: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  type: z.enum(["multiple_choice", "fill_in_blank", "word_order"]),
  audioIndex: z.number().int().min(0).nullable().optional(),
  content: z.string().min(1),
  correctAnswer: z.string().optional(),
  explanation: z.string().optional(),
  options: z.array(optionSchema).optional(),
});

const vocabularySchema = z.object({
  word: z.string().min(1),
  meaning: z.string().min(1),
  pronunciation: z.string().optional(),
  exampleSentence: z.string().optional(),
});

const audioSchema = z.object({
  title: z.string().optional(),
  audioUrl: z.string().optional(),
  ttsText: z.string().optional(),
  ttsType: z.string().optional(),
});

const createExerciseSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(["quiz", "listening", "mixed"]),
    // Legacy single audio fields (backward compat)
    audioUrl: z.string().optional(),
    ttsText: z.string().optional(),
    ttsType: z.string().optional(),
    // New: multiple audios
    audios: z.array(audioSchema).optional(),
    isPublished: z.boolean().default(true),
    questions: z.array(questionSchema).min(1),
    vocabularies: z.array(vocabularySchema).optional(),
  })
  .superRefine((data, ctx) => {
    const usableAudioCount = data.audios?.filter((a) => a.audioUrl || a.ttsText).length ?? 0;
    data.questions.forEach((q, index) => {
      if (q.audioIndex == null) return;
      if (usableAudioCount === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "audioIndex"],
          message: "Question is marked as listening but no listening entry was provided",
        });
        return;
      }
      if (q.audioIndex >= usableAudioCount) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "audioIndex"],
          message: "Listening question points to an invalid audio entry",
        });
      }
    });
  });

// GET: List all published exercises
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    const query = db
      .select({
        id: exercises.id,
        title: exercises.title,
        description: exercises.description,
        type: exercises.type,
        authorId: exercises.authorId,
        isPublished: exercises.isPublished,
        createdAt: exercises.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.exercise_id = exercises.id)`,
        vocabCount: sql<number>`(SELECT COUNT(*) FROM vocabularies WHERE vocabularies.exercise_id = exercises.id)`,
      })
      .from(exercises)
      .where(eq(exercises.isPublished, true))
      .orderBy(desc(exercises.createdAt))
      .limit(limit)
      .offset(offset);

    const allExercises = await query;

    let filtered = allExercises;
    if (type && type !== "all") {
      filtered = filtered.filter((e) => e.type === type);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(searchLower) ||
          e.description?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error fetching exercises:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create exercise
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createExerciseSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Create exercise (keep legacy fields for backward compat)
    const [exercise] = await db
      .insert(exercises)
      .values({
        authorId: session.user.id,
        title: data.title,
        description: data.description || null,
        type: data.type,
        audioUrl: data.audioUrl || null,
        ttsText: data.ttsText || null,
        ttsType: data.ttsType || null,
        isPublished: data.isPublished,
      })
      .returning();

    // Create audio entries
    if (data.audios && data.audios.length > 0) {
      for (let i = 0; i < data.audios.length; i++) {
        const audio = data.audios[i];
        if (audio.audioUrl || audio.ttsText) {
          await db.insert(exerciseAudios).values({
            exerciseId: exercise.id,
            title: audio.title || null,
            audioUrl: audio.audioUrl || null,
            ttsText: audio.ttsText || null,
            ttsType: audio.ttsType || null,
            orderIndex: i,
          });
        }
      }
    }

    // Create questions with options
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const [question] = await db
        .insert(questions)
        .values({
          exerciseId: exercise.id,
          type: q.type,
          audioIndex: q.audioIndex ?? null,
          content: q.content,
          correctAnswer: q.correctAnswer || null,
          explanation: q.explanation || null,
          orderIndex: i,
        })
        .returning();

      if (q.type === "multiple_choice" && q.options) {
        for (let j = 0; j < q.options.length; j++) {
          await db.insert(questionOptions).values({
            questionId: question.id,
            content: q.options[j].content,
            isCorrect: q.options[j].isCorrect,
            orderIndex: j,
          });
        }
      }
    }

    // Create vocabularies
    if (data.vocabularies && data.vocabularies.length > 0) {
      for (const vocab of data.vocabularies) {
        await db.insert(vocabularies).values({
          exerciseId: exercise.id,
          word: vocab.word,
          meaning: vocab.meaning,
          pronunciation: vocab.pronunciation || null,
          exampleSentence: vocab.exampleSentence || null,
        });
      }
    }

    return NextResponse.json(exercise, { status: 201 });
  } catch (error) {
    console.error("Error creating exercise:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
