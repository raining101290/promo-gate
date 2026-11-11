import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { approveSettlement } from "@/server/services/settlements";

import { settlementResponse } from "../result";
import { badId, readId } from "@/app/api/id-param";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.manageSettlements, async (staff) => {
    const id = await readId(params);
    if (!id) return badId();
    return settlementResponse(await approveSettlement(id, staff.id));
  });
}
