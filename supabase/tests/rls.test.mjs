// RLS / tenancy tests against an in-memory Postgres (PGlite), no Docker needed.
// Run with: npm run test:db
//
// A minimal stand-in for Supabase's auth schema and default role grants is created first,
// then every migration in supabase/migrations is applied in order.
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  -- Supabase grants table access by default and relies on RLS for row filtering.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

/** @type {PGlite} */
let db;
const users = {};

async function createUser(key, fullName) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${key}@example.com`, { full_name: fullName }],
  );
  users[key] = rows[0].id;
}

/** Run `fn` as an authenticated user inside a transaction that is always rolled back. */
async function as(userKey, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [users[userKey] ?? ""]);
    try {
      return await fn(tx);
    } finally {
      await tx.rollback();
    }
  });
}

/** Like `as`, but commits: used to build shared fixtures. */
async function asCommit(userKey, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [users[userKey]]);
    return fn(tx);
  });
}

const tenants = {};

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(join(MIGRATIONS_DIR, file), "utf8"));
  }

  await createUser("alice", "Alice Admin"); // admin of Acme
  await createUser("bob", "Bob Agent"); // desk agent at Acme
  await createUser("carol", "Carol Rival"); // admin of Rival Rentals
  await createUser("dave", "Dave Nobody"); // no tenant

  tenants.acme = await asCommit("alice", async (tx) => {
    const { rows } = await tx.query(`select * from public.create_tenant('Acme Rentals', 'acme')`);
    await tx.query(
      `insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'desk_agent')`,
      [rows[0].id, users.bob],
    );
    return rows[0].id;
  });
  tenants.rival = await asCommit("carol", async (tx) => {
    const { rows } = await tx.query(`select * from public.create_tenant('Rival Rentals', 'rival')`);
    return rows[0].id;
  });
});

after(async () => {
  await db?.close();
});

test("new auth users get a profile", async () => {
  const { rows } = await db.query(`select full_name from public.profiles where id = $1`, [users.alice]);
  assert.equal(rows[0].full_name, "Alice Admin");
});

test("profile email follows auth.users email changes", async () => {
  await db.transaction(async (tx) => {
    await tx.query(`update auth.users set email = 'alice@new.example' where id = $1`, [users.alice]);
    const { rows } = await tx.query(`select email from public.profiles where id = $1`, [users.alice]);
    assert.equal(rows[0].email, "alice@new.example");
    await tx.rollback();
  });
});

test("users can rename themselves but not change their email or others' names", async () => {
  const own = await as("bob", (tx) =>
    tx.query(`update public.profiles set full_name = 'Robert' where id = $1`, [users.bob]),
  );
  assert.equal(own.affectedRows, 1);

  const other = await as("bob", (tx) =>
    tx.query(`update public.profiles set full_name = 'Mallory' where id = $1`, [users.alice]),
  );
  assert.equal(other.affectedRows, 0);

  await assert.rejects(
    as("bob", (tx) => tx.query(`update public.profiles set email = 'x@y.z' where id = $1`, [users.bob])),
    /permission denied/,
  );
});

test("create_tenant makes the caller admin", async () => {
  const { rows } = await db.query(
    `select role from public.tenant_members where tenant_id = $1 and user_id = $2`,
    [tenants.acme, users.alice],
  );
  assert.equal(rows[0].role, "admin");
});

test("create_tenant rejects anonymous callers", async () => {
  await assert.rejects(
    as("nobody", (tx) => tx.query(`select public.create_tenant('Ghost', 'ghost')`)),
    /Not authenticated/,
  );
});

test("create_tenant rejects duplicate and malformed slugs", async () => {
  await assert.rejects(
    as("dave", (tx) => tx.query(`select public.create_tenant('Acme 2', 'acme')`)),
    /duplicate key/,
  );
  await assert.rejects(
    as("dave", (tx) => tx.query(`select public.create_tenant('Bad', 'Bad Slug!')`)),
    /check constraint/,
  );
});

test("users only see tenants they belong to", async () => {
  const seen = await as("bob", (tx) => tx.query(`select slug from public.tenants order by slug`));
  assert.deepEqual(seen.rows.map((r) => r.slug), ["acme"]);

  const none = await as("dave", (tx) => tx.query(`select slug from public.tenants`));
  assert.equal(none.rows.length, 0);
});

test("tenants cannot be inserted directly", async () => {
  await assert.rejects(
    as("dave", (tx) => tx.query(`insert into public.tenants (name, slug) values ('Direct', 'direct')`)),
    /row-level security/,
  );
});

test("only admins can rename a tenant; nobody can change plan directly", async () => {
  const byAgent = await as("bob", (tx) =>
    tx.query(`update public.tenants set name = 'Hacked' where id = $1`, [tenants.acme]),
  );
  assert.equal(byAgent.affectedRows, 0);

  const byAdmin = await as("alice", (tx) =>
    tx.query(`update public.tenants set name = 'Acme Car Rental' where id = $1`, [tenants.acme]),
  );
  assert.equal(byAdmin.affectedRows, 1);

  await assert.rejects(
    as("alice", (tx) => tx.query(`update public.tenants set plan = 'enterprise' where id = $1`, [tenants.acme])),
    /permission denied/,
  );

  const crossTenant = await as("carol", (tx) =>
    tx.query(`update public.tenants set name = 'Mine now' where id = $1`, [tenants.acme]),
  );
  assert.equal(crossTenant.affectedRows, 0);
});

test("members see their roster but not other tenants' members", async () => {
  const roster = await as("bob", (tx) => tx.query(`select user_id from public.tenant_members`));
  assert.deepEqual(new Set(roster.rows.map((r) => r.user_id)), new Set([users.alice, users.bob]));
});

test("profiles are visible to teammates only", async () => {
  const seen = await as("bob", (tx) => tx.query(`select id from public.profiles`));
  assert.deepEqual(new Set(seen.rows.map((r) => r.id)), new Set([users.alice, users.bob]));

  const lonely = await as("dave", (tx) => tx.query(`select id from public.profiles`));
  assert.deepEqual(lonely.rows.map((r) => r.id), [users.dave]);
});

test("non-admins cannot add members or escalate their role", async () => {
  await assert.rejects(
    as("bob", (tx) =>
      tx.query(`insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'admin')`, [
        tenants.acme,
        users.dave,
      ]),
    ),
    /row-level security/,
  );

  const escalate = await as("bob", (tx) =>
    tx.query(`update public.tenant_members set role = 'admin' where user_id = $1`, [users.bob]),
  );
  assert.equal(escalate.affectedRows, 0);
});

test("admins cannot add members to another tenant", async () => {
  await assert.rejects(
    as("carol", (tx) =>
      tx.query(`insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'admin')`, [
        tenants.acme,
        users.carol,
      ]),
    ),
    /row-level security/,
  );
});

test("the last admin cannot be demoted or removed", async () => {
  await assert.rejects(
    as("alice", (tx) =>
      tx.query(`update public.tenant_members set role = 'fleet_manager' where tenant_id = $1 and user_id = $2`, [
        tenants.acme,
        users.alice,
      ]),
    ),
    /at least one admin/,
  );
  await assert.rejects(
    as("alice", (tx) =>
      tx.query(`delete from public.tenant_members where tenant_id = $1 and user_id = $2`, [tenants.acme, users.alice]),
    ),
    /at least one admin/,
  );
});

test("an admin can step down once another admin exists", async () => {
  await as("alice", async (tx) => {
    await tx.query(`update public.tenant_members set role = 'admin' where tenant_id = $1 and user_id = $2`, [
      tenants.acme,
      users.bob,
    ]);
    const res = await tx.query(
      `update public.tenant_members set role = 'fleet_manager' where tenant_id = $1 and user_id = $2`,
      [tenants.acme, users.alice],
    );
    assert.equal(res.affectedRows, 1);
  });
});

test("deleting a tenant cascades its memberships", async () => {
  await db.transaction(async (tx) => {
    await tx.query(`delete from public.tenants where id = $1`, [tenants.rival]);
    const { rows } = await tx.query(`select count(*)::int as n from public.tenant_members where tenant_id = $1`, [
      tenants.rival,
    ]);
    assert.equal(rows[0].n, 0);
    await tx.rollback();
  });
});

test("anon role sees nothing", async () => {
  const rows = await db.transaction(async (tx) => {
    await tx.exec(`set local role anon`);
    const res = await tx.query(`select * from public.tenants`);
    await tx.rollback();
    return res.rows;
  });
  assert.equal(rows.length, 0);
});
