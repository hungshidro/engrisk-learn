import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseAttempts, exercises, questions, questionOptions } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";

// POST: Start or resume attempt
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: exerciseId } = await params;

    // Check for existing in-progress attempt
    const existingAttempt = await db.query.exerciseAttempts.findFirst({
      where: and(
        eq(exerciseAttempts.userId, session.user.id),
        eq(exerciseAttempts.exerciseId, exerciseId),
        eq(exerciseAttempts.status, "in_progress")
      ),
    });

    if (existingAttempt) {
      return NextResponse.json(existingAttempt);
    }

    // Count questions
    const exerciseQuestions = await db.query.questions.findMany({
      where: eq(questions.exerciseId, exerciseId),
    });

    // Create new attempt
    const [attempt] = await db
      .insert(exerciseAttempts)
      .values({
        userId: session.user.id,
        exerciseId,
        totalQuestions: exerciseQuestions.length,
        answers: {},
      })
      .returning();

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    console.error("Error creating attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Save in-progress answers
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: exerciseId } = await params;
    const { attemptId, answers } = await request.json();

    const [updated] = await db
      .update(exerciseAttempts)
      .set({ answers })
      .where(
        and(
          eq(exerciseAttempts.id, attemptId),
          eq(exerciseAttempts.userId, session.user.id),
          eq(exerciseAttempts.exerciseId, exerciseId)
        )
      )
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error saving answers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Submit attempt
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: exerciseId } = await params;
    const { attemptId, answers } = await request.json();

    // Get all questions with options
    const exerciseQuestions = await db.query.questions.findMany({
      where: eq(questions.exerciseId, exerciseId),
      with: { options: true },
      orderBy: (q, { asc }) => [asc(q.orderIndex)],
    });

    // Calculate score
    let score = 0;
    for (const question of exerciseQuestions) {
      const userAnswer = answers[question.id];
      if (!userAnswer) continue;

      if (question.type === "multiple_choice") {
        const correctOption = question.options.find((o) => o.isCorrect);
        if (correctOption && userAnswer === correctOption.id) {
          score++;
        }
      } else if (question.type === "fill_in_blank") {
        if (
          userAnswer.trim().toLowerCase() ===
          question.correctAnswer?.trim().toLowerCase()
        ) {
          score++;
        }
      }
    }

    const [updated] = await db
      .update(exerciseAttempts)
      .set({
        answers,
        score,
        status: "completed",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(exerciseAttempts.id, attemptId),
          eq(exerciseAttempts.userId, session.user.id),
          eq(exerciseAttempts.exerciseId, exerciseId)
        )
      )
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error submitting attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
