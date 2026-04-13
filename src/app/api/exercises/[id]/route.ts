import { NextResponse } from "next/server";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, id),
      with: {
        questions: {
          with: {
            options: {
              orderBy: (options, { asc }) => [asc(options.orderIndex)],
            },
          },
          orderBy: (questions, { asc }) => [asc(questions.orderIndex)],
        },
        vocabularies: true,
        audios: {
          orderBy: (audios, { asc }) => [asc(audios.orderIndex)],
        },
        author: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!exercise) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(exercise);
  } catch (error) {
    console.error("Error fetching exercise:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
