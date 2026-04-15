import { NextResponse } from "next/server";
import { db } from "@/db";
import { vocabularyAttempts, exercises, exerciseFollowers } from "@/db/schema";
import { auth } from "@/auth";
import { eq, and, or } from "drizzle-orm";

// GET: Get vocabulary attempt result with correct answers
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

    const attempt = await db.query.vocabularyAttempts.findFirst({
      where: and(
        eq(vocabularyAttempts.id, attemptId),
        eq(vocabularyAttempts.exerciseId, exerciseId)
      ),
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Vocabulary attempt not found" },
        { status: 404 }
      );
    }

    // Check access: owner or follower
    if (attempt.userId !== session.user.id) {
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

    // Get exercise with vocabularies
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        vocabularies: true,
      },
    });

    return NextResponse.json({
      attempt,
      exercise,
    });
  } catch (error) {
    console.error("Error fetching vocab attempt result:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
