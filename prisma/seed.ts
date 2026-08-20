// prisma/seed.ts
//
// Phase 0 seed: exactly what's needed to log in and prove the app works —
// one OWNER account and one Marketplace row. No fabricated business data;
// Phase 0 has no operational entities to fabricate data for in the first
// place.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL || "owner@kawkab.local";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || "change-this-password";

  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existingOwner) {
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const owner = await prisma.user.create({
      data: { name: "Owner", email: ownerEmail, passwordHash, role: "OWNER", status: "ACTIVE" },
    });
    console.log(`Created OWNER account: ${owner.email} (change the seed password before any real use)`);
  } else {
    console.log(`OWNER account already exists: ${ownerEmail}`);
  }

  const existingMarketplace = await prisma.marketplace.findUnique({ where: { code: "ATVPDKIKX0DER" } });
  if (!existingMarketplace) {
    const marketplace = await prisma.marketplace.create({
      data: {
        code: "ATVPDKIKX0DER",
        displayName: "Amazon.com (US)",
        countryCode: "US",
        currency: "USD",
        isActive: true,
      },
    });
    console.log(`Created Marketplace: ${marketplace.displayName}`);
  } else {
    console.log("Marketplace ATVPDKIKX0DER already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
