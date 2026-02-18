// Prisma 7: конфигурация CLI (migrate, generate). URL БД только здесь, не в schema.
// Таблицы Supabase Auth и user_preferences — внешние, Prisma их не трогает при db push.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: [
      "auth.audit_log_entries",
      "auth.flow_state",
      "auth.identities",
      "auth.mfa_amr_claims",
      "auth.mfa_challenges",
      "auth.mfa_factors",
      "auth.refresh_tokens",
      "auth.schema_migrations",
      "auth.sessions",
      "auth.users",
      "public.favorite_suppliers",
      "public.user_preferences",
    ],
  },
  enums: {
    external: [
      "auth.aal_level",
      "auth.code_challenge_method",
      "auth.factor_status",
      "auth.factor_type",
      "auth.one_time_token_type",
    ],
  },
});
