import Link from "next/link";

/** Customer-facing top bar. Logout is a plain POST form so it works without client JS. */
export function SiteHeader({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-2 px-4">
        <Link href="/" className="truncate font-semibold tracking-tight">
          Hosting.com <span className="text-muted-foreground font-normal">Perks</span>
        </Link>
        {loggedIn ? (
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <Link href="/dashboard" className="hover:bg-accent rounded-md px-3 py-2 font-medium">
              My vouchers
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-muted-foreground hover:bg-accent rounded-md px-3 py-2">
                Log out
              </button>
            </form>
          </nav>
        ) : (
          <Link href="/login" className="hover:bg-accent shrink-0 rounded-md px-3 py-2 text-sm font-medium">
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
