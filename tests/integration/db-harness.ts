import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * In-process Postgres (pglite) with a Supabase-compatible shim:
 *  - roles anon / authenticated / service_role
 *  - auth.users table and auth.uid() reading request.jwt.claims
 * Migrations from supabase/migrations are applied in order, unmodified.
 */
export interface Harness {
  db: PGlite;
  /** Run SQL as a signed-in household member (RLS enforced). */
  as<T>(userId: string | null, fn: (q: Query) => Promise<T>): Promise<T>;
  /** Run SQL as the service role (bypasses RLS, like the research runner). */
  admin: Query;
  createUser(email: string, displayName: string): Promise<string>;
  close(): Promise<void>;
}

export interface Query {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<R[]>;
  exec(sql: string): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create or replace function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;
  `);
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  // Supabase grants these by default for the public schema.
  await db.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables in schema public to authenticated, service_role;
    grant all on all sequences in schema public to authenticated, service_role;
    grant select on auth.users to authenticated;
  `);

  const admin: Query = {
    async query(sql, params) {
      const res = await db.query(sql, params as never[]);
      return res.rows as never;
    },
    async exec(sql) {
      await db.exec(sql);
    },
  };

  return {
    db,
    admin,
    async as(userId, fn) {
      await db.exec("begin");
      try {
        await db.exec("set local role authenticated");
        await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
        await db.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
        const q: Query = {
          async query(sql, params) {
            const res = await db.query(sql, params as never[]);
            return res.rows as never;
          },
          async exec(sql) {
            await db.exec(sql);
          },
        };
        const out = await fn(q);
        await db.exec("commit");
        return out;
      } catch (e) {
        await db.exec("rollback");
        throw e;
      }
    },
    async createUser(email, displayName) {
      const rows = await admin.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, { display_name: displayName }]);
      return rows[0].id;
    },
    async close() {
      await db.close();
    },
  };
}
