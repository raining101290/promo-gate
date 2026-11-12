import Link from "next/link";

/** Customer-facing top bar. Logout is a plain POST form so it works without client JS. */
export function SiteHeader({ loggedIn, wide = false }: { loggedIn: boolean; wide?: boolean }) {
  return (
    <header className="border-b">
      <div className={`mx-auto flex h-14 w-full items-center justify-between gap-2 px-4 ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <Link href="/" className="truncate font-semibold tracking-tight">
          Hosting.com <span className="text-muted-foreground font-normal">Coffee Campaign</span>
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
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            <Link href="/guide" className="text-muted-foreground hover:bg-accent rounded-md px-3 py-2">
              How it works
            </Link>
            <Link href="/login" className="hover:bg-accent rounded-md px-3 py-2 font-medium">
              Log in
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
