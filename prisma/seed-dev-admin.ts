// Dev-only: creates an admin user in Supabase Auth + our users table.
// Run explicitly: `npm run db:seed:admin`.
// SAFE GUARDS:
//  - Refuses to run unless SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set
//  - Uses upsert so re-running is idempotent

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const dbUrl = process.env.DATABASE_URL;
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME ?? "Dev Admin";

if (!dbUrl) throw new Error("DATABASE_URL is not set");
if (!supaUrl || !supaKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
}
if (!email || !password) {
  throw new Error(
    "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env.local",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: dbUrl }),
});
const supabase = createClient(supaUrl, supaKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Create or fetch the Supabase Auth user
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let authUser = list?.users.find((u) => u.email === email);

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email!,
      password: password!,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    authUser = data.user!;
    console.log(`✓ Created Supabase Auth user: ${authUser.id}`);
  } else {
    console.log(`✓ Supabase Auth user exists: ${authUser.id}`);
  }

  // 2. Upsert into our users table with role=ADMIN
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email: email!,
      name,
      role: "ADMIN",
    },
    update: {
      role: "ADMIN",
      name,
    },
  });
  console.log(`✓ User row: ${user.email} (role=${user.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
