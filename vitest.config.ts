import { defineConfig } from "vitest/config";

// Tests must never run against the real kawkab_os database — this pins
// DATABASE_URL to an isolated test database before any test module (and
// therefore lib/prisma.ts) loads, overriding whatever .env would otherwise
// supply. Prisma's own dotenv loader never overwrites an already-set
// process.env value, so this wins.
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    env: {
      DATABASE_URL: "postgresql://kawkab:kawkab@localhost:5432/kawkab_os_test?schema=public",
    },
    // Second, independent layer: even if the env override above is ever
    // weakened or shadowed, this throws before any test body runs.
    setupFiles: ["./tests/setup/guardAgainstProductionDb.ts"],
  },
});
