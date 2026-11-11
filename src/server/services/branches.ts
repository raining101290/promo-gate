import "server-only";

import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

import { Prisma } from "@/generated/prisma/client";
import type { BranchCreateInput, BranchUpdateInput } from "@/lib/schemas/partner";
import { suggestBranchCode, withSuffix } from "@/lib/slug";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { writeAudit } from "@/server/services/audit";

const PIN_BCRYPT_COST = 10;

/** The URL printed on the branch standee QR. */
export function branchRedeemUrl(branchCode: string): string {
  return `${appUrl()}/r/${branchCode}`;
}

/** Repeated (1111) or straight-run (1234, 9876) PINs are the first things anyone tries. */
export function isWeakPin(pin: string): boolean {
  const d = [...pin].map(Number);
  if (d.every((x) => x === d[0])) return true;
  const steps = d.slice(1).map((x, i) => x - d[i]);
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/** Server-generated 4-digit PIN from a CSPRNG, never a weak pattern. */
export function generatePin(): string {
  for (;;) {
    const pin = randomInt(0, 10_000).toString().padStart(4, "0");
    if (!isWeakPin(pin)) return pin;
  }
}

export type CreateBranchResult =
  | { ok: true; branch: { id: string; branchCode: string; name: string }; pin: string }
  | { ok: false; reason: "partner_not_found" | "code_taken" };

/**
 * Creates a branch with a generated PIN. The plaintext PIN is returned ONCE to show the admin;
 * only its bcrypt hash is stored, and it never goes into audit meta or logs.
 * branchCode: the admin's choice (must be free) or generated from partner + branch name with a
 * numeric suffix on collision. Immutable afterwards (it's printed on the standee).
 */
export async function createBranch(partnerId: string, input: BranchCreateInput, staffId: string): Promise<CreateBranchResult> {
  const partner = await db.partner.findUnique({ where: { id: partnerId }, select: { name: true } });
  if (!partner) return { ok: false, reason: "partner_not_found" };

  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, PIN_BCRYPT_COST);
  const { branchCode: requested, ...fields } = input;
  const suggested = suggestBranchCode(partner.name, input.name);

  for (let attempt = 1; attempt <= 20; attempt++) {
    const branchCode = requested ?? (attempt === 1 ? suggested : withSuffix(suggested, attempt));
    try {
      const branch = await db.$transaction(async (tx) => {
        const created = await tx.branch.create({
          data: { ...fields, partnerId, branchCode, pinHash, active: true },
          select: { id: true, branchCode: true, name: true },
        });
        await writeAudit(
          {
            actorType: "STAFF",
            actorId: staffId,
            action: "branch.created",
            entityType: "Branch",
            entityId: created.id,
            meta: { partnerId, branchCode, name: input.name },
          },
          tx,
        );
        return created;
      });
      return { ok: true, branch, pin };
    } catch (err) {
      const unique = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!unique) throw err;
      if (requested) return { ok: false, reason: "code_taken" };
      // Generated code collided: try the next suffix.
    }
  }
  throw new Error("Could not find a free branch code");
}

/** Name/area/address/smsPhone/active. branchCode is not editable by design. */
export async function updateBranch(id: string, input: BranchUpdateInput, staffId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.branch.findUnique({ where: { id } });
    if (!before) return null;
    const branch = await tx.branch.update({ where: { id }, data: input });
    const changed = (Object.keys(input) as (keyof BranchUpdateInput)[]).filter((k) => before[k] !== input[k]);
    const action =
      before.active !== input.active ? (input.active ? "branch.activated" : "branch.deactivated") : "branch.updated";
    await writeAudit({ actorType: "STAFF", actorId: staffId, action, entityType: "Branch", entityId: id, meta: { changed } }, tx);
    return branch;
  });
}

/** Issues a new PIN (returned once) and invalidates the old one immediately. Audited without the PIN. */
export async function resetBranchPin(id: string, staffId: string): Promise<{ pin: string } | null> {
  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, PIN_BCRYPT_COST);
  return db.$transaction(async (tx) => {
    const updated = await tx.branch.updateMany({ where: { id }, data: { pinHash } });
    if (updated.count === 0) return null;
    await writeAudit({ actorType: "STAFF", actorId: staffId, action: "branch.pin_reset", entityType: "Branch", entityId: id }, tx);
    return { pin };
  });
}

export async function setBranchActive(id: string, active: boolean, staffId: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.branch.updateMany({ where: { id, active: !active }, data: { active } });
    const exists = await tx.branch.count({ where: { id } });
    if (!exists) return null;
    if (updated.count === 1) {
      await writeAudit(
        { actorType: "STAFF", actorId: staffId, action: active ? "branch.activated" : "branch.deactivated", entityType: "Branch", entityId: id },
        tx,
      );
    }
    return { id, active };
  });
}

export function deactivateBranch(id: string, staffId: string) {
  return setBranchActive(id, false, staffId);
}

/**
 * Branch eligibility for redemption (to be enforced by the Phase 6 redeem flow): the branch must be
 * active AND its partner's contract ACTIVE. Paused/ended partners and deactivated branches can't redeem.
 */
export async function findRedeemableBranch(branchCode: string) {
  const branch = await db.branch.findUnique({
    where: { branchCode },
    omit: { pinHash: true },
    include: { partner: { select: { id: true, name: true, contractStatus: true } } },
  });
  if (!branch || !branch.active || branch.partner.contractStatus !== "ACTIVE") return null;
  return branch;
}

export async function getBranchForStaff(id: string) {
  return db.branch.findUnique({
    where: { id },
    omit: { pinHash: true },
    include: { partner: { select: { id: true, name: true, contractStatus: true } } },
  });
}
