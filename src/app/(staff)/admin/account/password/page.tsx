import { ALL_STAFF, requireStaffPage } from "@/server/auth/require-role";

import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const me = await requireStaffPage(ALL_STAFF, "/admin/account/password", { allowPendingPasswordChange: true });
  return (
    <div className="max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{me.mustChangePassword ? "Choose your password" : "Change password"}</h1>
        <p className="text-muted-foreground text-sm">
          {me.mustChangePassword
            ? "You signed in with a temporary password. Set your own to continue."
            : "Changing your password signs you out on your other devices."}
        </p>
      </div>
      <ChangePasswordForm forced={me.mustChangePassword} />
    </div>
  );
}
