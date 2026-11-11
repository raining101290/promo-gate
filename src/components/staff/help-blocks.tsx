import { CopyReply } from "@/components/staff/copy-reply";
import { HelpText } from "@/components/staff/help-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HelpBlock } from "@/lib/help/types";
import { cn } from "@/lib/utils";

export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <HelpBlockView key={i} block={b} />
      ))}
    </div>
  );
}

function HelpBlockView({ block: b }: { block: HelpBlock }) {
  switch (b.kind) {
    case "p":
      return (
        <p className="text-muted-foreground leading-relaxed">
          <HelpText text={b.text} />
        </p>
      );
    case "list":
    case "steps": {
      const Tag = b.kind === "steps" ? "ol" : "ul";
      return (
        <Tag className={cn("text-muted-foreground space-y-2 pl-5 leading-relaxed", b.kind === "steps" ? "list-decimal" : "list-disc")}>
          {b.items.map((t, i) => (
            <li key={i} className="pl-1">
              <HelpText text={t} />
            </li>
          ))}
        </Tag>
      );
    }
    case "fields":
      return (
        <dl className="divide-y rounded-lg border">
          {b.items.map((f) => (
            <div key={f.name} className="grid gap-1 p-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
              <dt className="font-medium">{f.name}</dt>
              <dd className="text-muted-foreground space-y-1 text-sm leading-relaxed">
                <p>
                  <HelpText text={f.why} />
                </p>
                {f.tip && (
                  <p className="text-xs">
                    <span className="text-foreground font-medium">Tip: </span>
                    <HelpText text={f.tip} />
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {b.head.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {b.rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((c, j) => (
                    <TableCell key={j} className={cn("align-top whitespace-normal", j === 0 && "font-medium")}>
                      <HelpText text={c} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    case "note":
      return (
        <p
          role="note"
          className={cn(
            "rounded-lg border p-3 text-sm leading-relaxed",
            b.tone === "warn"
              ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              : "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
          )}
        >
          <HelpText text={b.text} />
        </p>
      );
    case "reply":
      return <CopyReply label={b.label} text={b.text} />;
  }
}
