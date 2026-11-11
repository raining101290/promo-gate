import "server-only";

import { readCustomerSession } from "@/server/auth/session";
import { db } from "@/server/db";

/**
 * Customer session validated against the DB: the JWT alone isn't enough, because a customer can be
 * deleted (soft) while a 30-day cookie is still out there. Use this in every customer page and route.
 */
export async function getCustomerSession() {
  const session = await readCustomerSession();
  if (!session) return null;
  const alive = await db.customer.count({ where: { id: session.sub, deletedAt: null } });
  return alive ? session : null;
}
