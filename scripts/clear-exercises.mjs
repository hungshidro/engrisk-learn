import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function clearExercises() {
  console.log("Deleting all exercises...");
  await sql`DELETE FROM exercises`;
  console.log("All exercises and related data (questions, vocabularies, attempts, etc.) deleted successfully.");
  process.exit(0);
}

clearExercises().catch((e) => {
  console.error("Error clearing exercises:", e);
  process.exit(1);
});
