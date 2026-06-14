import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const requiredTables = [
  'audit_logs',
  'auth_identities',
  'personal_watchlist_items',
  'personal_watchlists',
  'privacy_settings',
  'release_notifications',
  'user_blocks',
  'user_content_states',
  'user_episode_progress',
  'user_episode_ratings',
  'user_episode_reviews',
  'user_follows',
  'user_movie_ratings',
  'user_movie_reviews',
  'users',
];

const requiredMigrations = [
  '20260610073000_init_user_auth_privacy',
  '20260612090000_add_user_content_states',
  '20260612103000_add_user_movie_ratings',
  '20260612113000_add_user_episode_ratings',
  '20260612120000_add_user_reviews',
  '20260612123000_add_user_episode_progress',
  '20260612133000_add_user_blocks',
  '20260612143000_add_user_follows',
  '20260613100000_add_personal_watchlists',
  '20260614100000_add_release_notifications',
  '20260614113000_add_audit_logs',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  assertRequiredMigrationsExist();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${requiredTables})
    `;
    const actualTables = new Set(rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !actualTables.has(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing backup-critical tables: ${missingTables.join(', ')}`);
    }

    console.log('Backup readiness passed.');
  } finally {
    await prisma.$disconnect();
  }
}

function assertRequiredMigrationsExist() {
  const migrationsPath = join(process.cwd(), 'prisma', 'migrations');
  const missingMigrations = requiredMigrations.filter(
    (migration) => !existsSync(join(migrationsPath, migration, 'migration.sql')),
  );

  if (missingMigrations.length > 0) {
    throw new Error(`Missing backup-critical migrations: ${missingMigrations.join(', ')}`);
  }
}

void main();
