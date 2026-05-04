const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const migrationSentinels = new Map([
  ["20260428114443_init_schema", "User"],
  ["20260501120000_add_multitenancy", "OrderDraft"],
]);

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = $1
      LIMIT 1
    `,
    [tableName],
  );

  return result.rowCount > 0;
}

async function ensureMigrationLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "_codex_migrations" (
      "migrationName" TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function hasMigrationRecord(client, migrationName) {
  const result = await client.query(
    `SELECT 1 FROM "_codex_migrations" WHERE "migrationName" = $1 LIMIT 1`,
    [migrationName],
  );

  return result.rowCount > 0;
}

async function recordMigration(client, migrationName) {
  await client.query(
    `
      INSERT INTO "_codex_migrations" ("migrationName")
      VALUES ($1)
      ON CONFLICT ("migrationName") DO NOTHING
    `,
    [migrationName],
  );
}

async function applyMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to apply migrations.");
  }

  const migrationsPath = path.resolve(__dirname, "../prisma/migrations");
  const migrationNames = (await fs.readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureMigrationLedger(client);

    for (const migrationName of migrationNames) {
      if (await hasMigrationRecord(client, migrationName)) {
        continue;
      }

      const sentinelTable = migrationSentinels.get(migrationName);

      if (sentinelTable && (await tableExists(client, sentinelTable))) {
        await recordMigration(client, migrationName);
        continue;
      }

      const sql = await fs.readFile(
        path.join(migrationsPath, migrationName, "migration.sql"),
        "utf8",
      );

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await recordMigration(client, migrationName);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

applyMigrations().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
