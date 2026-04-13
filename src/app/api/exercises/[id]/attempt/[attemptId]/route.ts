import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseAttempts, exercises, questions, exerciseFollowers } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, or } from "drizzle-orm";

// GET: Get attempt result with correct answers
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: exerciseId, attemptId } = await params;

    const attempt = await db.query.exerciseAttempts.findFirst({
      where: and(
        eq(exerciseAttempts.id, attemptId),
        eq(exerciseAttempts.exerciseId, exerciseId)
      ),
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.userId !== session.user.id) {
      // Check if they are connected as followers for this exercise
      const connection = await db.query.exerciseFollowers.findFirst({
        where: and(
          eq(exerciseFollowers.exerciseId, exerciseId),
          or(
            and(eq(exerciseFollowers.userId, session.user.id), eq(exerciseFollowers.followedUserId, attempt.userId)),
            and(eq(exerciseFollowers.userId, attempt.userId), eq(exerciseFollowers.followedUserId, session.user.id))
          )
        )
      });
      if (!connection) {
        return NextResponse.json({ error: "Unauthorized to view this attempt" }, { status: 403 });
      }
    }

    // Get exercise with questions and correct answers
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        questions: {
          with: { options: true },
          orderBy: (q, { asc }) => [asc(q.orderIndex)],
        },
        vocabularies: true,
      },
    });

    return NextResponse.json({
      attempt,
      exercise,
    });
  } catch (error) {
    console.error("Error fetching attempt result:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
