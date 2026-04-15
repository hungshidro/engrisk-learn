import { NextResponse } from "next/server";
import { db } from "@/db";
import { vocabularyAttempts, vocabularies } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and } from "drizzle-orm";

// POST: Start or resume vocabulary attempt
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
    const body = await request.json().catch(() => ({}));
    const forceNew = (body as { forceNew?: boolean }).forceNew === true;

    if (!forceNew) {
      // Check for existing in-progress attempt
      const existingAttempt = await db.query.vocabularyAttempts.findFirst({
        where: and(
          eq(vocabularyAttempts.userId, session.user.id),
          eq(vocabularyAttempts.exerciseId, exerciseId),
          eq(vocabularyAttempts.status, "in_progress")
        ),
      });

      if (existingAttempt) {
        return NextResponse.json(existingAttempt);
      }
    }

    // Count vocabularies
    const vocabList = await db.query.vocabularies.findMany({
      where: eq(vocabularies.exerciseId, exerciseId),
    });

    // totalItems = vocabCount * 2 (meaning + pronunciation for each word)
    const totalItems = vocabList.length * 2;

    // Create new attempt
    const [attempt] = await db
      .insert(vocabularyAttempts)
      .values({
        userId: session.user.id,
        exerciseId,
        totalItems,
        answers: {},
      })
      .returning();

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    console.error("Error creating vocab attempt:", error);
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
      .update(vocabularyAttempts)
      .set({ answers })
      .where(
        and(
          eq(vocabularyAttempts.id, attemptId),
          eq(vocabularyAttempts.userId, session.user.id),
          eq(vocabularyAttempts.exerciseId, exerciseId)
        )
      )
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error saving vocab answers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Submit vocabulary attempt
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

    // Get vocabularies for this exercise
    const vocabList = await db.query.vocabularies.findMany({
      where: eq(vocabularies.exerciseId, exerciseId),
    });

    // Calculate score
    let score = 0;
    for (const vocab of vocabList) {
      const answer = answers[vocab.id];
      if (!answer) continue;

      // Check meaning
      if (answer.meaning === vocab.meaning) {
        score++;
      }

      // Check pronunciation
      if (answer.pronunciation === "correct") {
        score++;
      }
    }

    const [updated] = await db
      .update(vocabularyAttempts)
      .set({
        answers,
        score,
        status: "completed",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(vocabularyAttempts.id, attemptId),
          eq(vocabularyAttempts.userId, session.user.id),
          eq(vocabularyAttempts.exerciseId, exerciseId)
        )
      )
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error submitting vocab attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
