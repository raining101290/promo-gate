import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/safe-redirect";
import { getStaff } from "@/server/auth/require-role";

import { StaffLoginForm } from "./staff-login-form";

export const metadata = { title: "Staff login" };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next, "/admin");
  if (await getStaff()) redirect(nextPath.startsWith("/admin") ? nextPath : "/admin");

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Staff login</CardTitle>
          <CardDescription>Hosting.com Perks administration</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffLoginForm nextPath={nextPath} />
        </CardContent>
      </Card>
    </div>
  );
}
