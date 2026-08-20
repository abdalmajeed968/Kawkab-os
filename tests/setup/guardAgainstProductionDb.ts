// tests/setup/guardAgainstProductionDb.ts
//
// Mandatory fail-safe: this runs before any test file, and throws instead
// of letting a single test execute if DATABASE_URL doesn't look like an
// isolated test database. vitest.config.ts already pins DATABASE_URL to
// kawkab_os_test, but this guard exists so that mistake — or any future
// mistake, like a shell environment variable overriding it, or someone
// weakening the config — fails loudly instead of quietly writing to
// production. Real business data must never be touched by test runs.

const url = process.env.DATABASE_URL || "";

let dbName = "";
try {
  dbName = new URL(url).pathname.replace(/^\//, "");
} catch {
  // Unparseable URL — treated as unsafe below, not ignored.
}

const looksLikeTestDb = /(^|[_-])test$/i.test(dbName);
const looksLikeKnownProductionDb = dbName === "kawkab_os";

if (!url || looksLikeKnownProductionDb || !looksLikeTestDb) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not point at an isolated test database ` +
      `(resolved database name: "${dbName || "<unparseable>"}"). ` +
      `Tests must only ever run against a database whose name ends in "_test" or "-test", ` +
      `and must never point at "kawkab_os". Fix vitest.config.ts's test.env.DATABASE_URL ` +
      `or your shell environment before running tests again.`
  );
}
