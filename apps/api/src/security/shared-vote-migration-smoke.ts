import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

async function main() {
  const databaseUrl = new ConfigService(process.env).getOrThrow<string>('DATABASE_URL');
  const client = new pg.Client({ connectionString: databaseUrl });
  const schema = `shared_vote_migration_smoke_${Date.now()}`;
  const sessionId = randomUUID();
  const candidateId = randomUUID();
  const voteId = randomUUID();
  const watchlistId = randomUUID();
  const itemId = randomUUID();
  const userId = randomUUID();

  await client.connect();

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE shared_voting_sessions (
        id UUID PRIMARY KEY,
        "watchlistId" UUID NOT NULL,
        title VARCHAR(80) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      );
      CREATE TABLE shared_voting_candidates (
        id UUID PRIMARY KEY,
        "sessionId" UUID NOT NULL,
        "itemId" UUID NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE shared_voting_votes (
        id UUID PRIMARY KEY,
        "candidateId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(
      `INSERT INTO shared_voting_sessions (id, "watchlistId", title, "createdAt", "updatedAt")
       VALUES ($1, $2, 'Preservation sentinel', '2026-07-01T12:00:00Z', '2026-07-01T12:00:00Z')`,
      [sessionId, watchlistId],
    );
    await client.query(
      `INSERT INTO shared_voting_candidates (id, "sessionId", "itemId") VALUES ($1, $2, $3)`,
      [candidateId, sessionId, itemId],
    );
    await client.query(
      `INSERT INTO shared_voting_votes (id, "candidateId", "userId") VALUES ($1, $2, $3)`,
      [voteId, candidateId, userId],
    );

    const migrationSql = await readFile(
      resolve(__dirname, '../../prisma/migrations/20260710170000_shared_vote_lifecycle/migration.sql'),
      'utf8',
    );
    await client.query(migrationSql);

    const session = await client.query<{
      closedAt: Date | null;
      closesAt: Date;
      createdAt: Date;
      id: string;
      status: string;
      winningCandidateId: string | null;
    }>(
      `SELECT id, status::text, "closesAt", "closedAt", "winningCandidateId", "createdAt"
       FROM shared_voting_sessions WHERE id = $1`,
      [sessionId],
    );
    const history = await client.query<{ candidateId: string; voteId: string; userId: string }>(
      `SELECT c.id AS "candidateId", v.id AS "voteId", v."userId" AS "userId"
       FROM shared_voting_candidates c
       JOIN shared_voting_votes v ON v."candidateId" = c.id
       WHERE c."sessionId" = $1`,
      [sessionId],
    );
    const migrated = session.rows[0];

    assert(migrated?.id === sessionId, 'Migration must preserve the existing session ID.');
    assert(migrated.status === 'OPEN', 'Existing sessions must migrate as OPEN.');
    assert(migrated.closedAt === null, 'Existing sessions must remain unclosed.');
    assert(migrated.winningCandidateId === null, 'Existing sessions must not gain a fabricated winner.');
    assert(
      migrated.closesAt.getTime() - migrated.createdAt.getTime() === 7 * 24 * 60 * 60 * 1000,
      'Existing sessions must receive a seven-day close horizon from creation.',
    );
    assert(history.rows.length === 1, 'Migration must preserve existing candidate/vote history.');
    assert(history.rows[0]?.candidateId === candidateId, 'Migration must preserve candidate IDs.');
    assert(history.rows[0]?.voteId === voteId, 'Migration must preserve vote IDs.');
    assert(history.rows[0]?.userId === userId, 'Migration must preserve voters.');

    console.log('Shared vote migration preservation smoke passed.');
  } finally {
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

void main();
