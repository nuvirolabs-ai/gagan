/**
 * Development helper: mint a staff session for a seeded salesperson so the
 * Sales app can be driven locally.
 *
 * The mock SMS adapter deliberately never logs or stores an OTP, so there is
 * otherwise no way to sign in against a local database. This refuses to run
 * outside a development or test NODE_ENV, and needs the database and signing
 * secrets it would take to mint a token by hand anyway.
 *
 * Usage:
 *   NODE_ENV=development npx ts-node --transpile-only scripts/devSession.ts 9812345670
 *   NODE_ENV=development npx ts-node --transpile-only scripts/devSession.ts 9999999999 retailer
 *   NODE_ENV=development npx ts-node --transpile-only scripts/devSession.ts 9812345672 admin
 */
import { prisma } from "../src/lib/prisma";
import { lazyIdentitySessionService } from "../src/modules/identity/sessionRuntime";

async function main() {
  // Allow-list rather than deny-list: an unset or unexpected NODE_ENV must not
  // be enough to mint a session.
  if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
    throw new Error("devSession requires NODE_ENV=development or NODE_ENV=test");
  }
  const phone = process.argv[2];
  const realm = (process.argv[3] ?? "staff") as "staff" | "retailer" | "admin";
  if (!phone) throw new Error("usage: devSession <phone> [staff|retailer]");
  if (!["staff", "retailer", "admin"].includes(realm)) {
    throw new Error("realm must be staff, retailer or admin");
  }

  const subject =
    realm === "retailer"
      ? await prisma.retailer.findFirstOrThrow({
          where: { phone: { in: [phone, `91${phone}`] } },
          select: { id: true, name: true },
        })
      : await prisma.staffUser.findFirstOrThrow({
          where: { phone: { in: [phone, `91${phone}`] } },
          select: { id: true, name: true },
        });

  const session = await lazyIdentitySessionService.createSession({
    realm,
    subjectId: subject.id,
    deviceName: "local-verification",
  });
  console.log(
    JSON.stringify({
      realm,
      subject,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
