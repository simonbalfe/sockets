import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-http";
import { openAPI } from "better-auth/plugins";

import { accounts, sessions, users, verifications } from "./db/schema";

const sql = neon(process.env.POSTGRES_URL!);
const db = drizzle(sql, {
	schema: { user: users, session: sessions, account: accounts, verification: verifications },
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  plugins: [openAPI()],
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
});
