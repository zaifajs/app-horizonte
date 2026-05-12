import { format } from "date-fns";
import { prisma } from "@/lib/db";

// Server component that renders the audit-log activity stream for one student.
// Reads directly from the AuditLog table (single source of truth for changes).

type ChangeJson =
  | { from?: unknown; to?: unknown }
  | { [key: string]: unknown };

function isFromTo(v: unknown): v is { from?: unknown; to?: unknown } {
  return typeof v === "object" && v !== null && ("from" in v || "to" in v);
}

function fmtScalar(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    // Try to detect "YYYY-MM-DD" strings and humanize.
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      try {
        return format(new Date(`${v}T00:00:00Z`), "dd MMM yyyy");
      } catch {
        return v;
      }
    }
    return v;
  }
  return JSON.stringify(v);
}

function describe(entry: {
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  changes: ChangeJson | null;
}): { headline: string; details: string[] } {
  const { action, entityType, changes } = entry;
  const ch = (changes ?? {}) as Record<string, unknown>;

  // Headlines per entity + action.
  let headline: string;
  switch (entityType) {
    case "Student":
      headline = action === "CREATE" ? "Student created" : `Student ${action.toLowerCase()}d`;
      break;
    case "Enrollment":
      headline =
        action === "UPDATE" && isFromTo(ch.status)
          ? `Enrollment ${String(ch.status.to ?? "").toLowerCase()}`
          : `Enrollment ${action.toLowerCase()}d`;
      break;
    case "Payment":
      if (action === "CREATE") {
        const amt = typeof ch.amountCents === "number" ? `€${(ch.amountCents / 100).toFixed(2)}` : "";
        const method =
          typeof ch.method === "string" ? ch.method.toLowerCase() : "";
        headline = `Payment recorded — ${amt}${method ? ` · ${method}` : ""}`;
      } else if (action === "DELETE") {
        const amt = typeof ch.amountCents === "number" ? `€${(ch.amountCents / 100).toFixed(2)}` : "";
        headline = `Payment deleted${amt ? ` — ${amt}` : ""}`;
      } else {
        headline = `Payment ${action.toLowerCase()}d`;
      }
      break;
    case "PaymentReceipt":
      // Legacy entries from the receipts era — keep showing them
      if (action === "CREATE") {
        const amt = typeof ch.amountCents === "number" ? `€${(ch.amountCents / 100).toFixed(2)}` : "";
        headline = `Payment receipt recorded — ${amt}`;
      } else {
        headline = `Payment receipt ${action.toLowerCase()}d`;
      }
      break;
    case "BatchSession":
      headline = `Session ${action.toLowerCase()}d`;
      break;
    case "Batch":
      headline = `Batch ${action.toLowerCase()}d`;
      break;
    default:
      headline = `${entityType} ${action.toLowerCase()}d`;
  }

  // Details list: surface every field-level change.
  const details: string[] = [];
  for (const [k, v] of Object.entries(ch)) {
    if (k === "amountCents" || k === "method" || k === "paidAt") continue; // already in headline
    if (isFromTo(v)) {
      const from = fmtScalar(v.from);
      const to = fmtScalar(v.to);
      details.push(`${k}: ${from} → ${to}`);
    } else if (typeof v === "object" && v !== null) {
      // skip nested objects we didn't classify
    } else {
      details.push(`${k}: ${fmtScalar(v)}`);
    }
  }
  return { headline, details };
}

export async function ActivityStream({ studentId }: { studentId: string }) {
  const entries = await prisma.auditLog.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { name: true, role: true } },
    },
  });

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const { headline, details } = describe({
          action: e.action,
          entityType: e.entityType,
          changes: e.changes as ChangeJson | null,
        });
        const who = e.actor
          ? `${e.actor.name} (${e.actor.role.toLowerCase()})`
          : "public form";
        return (
          <li key={e.id} className="flex gap-3 text-sm">
            <div className="mt-1 h-2 w-2 rounded-full bg-zinc-300 shrink-0" />
            <div className="flex-1 space-y-0.5">
              <div className="font-medium">{headline}</div>
              {details.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              ) : null}
              <div className="text-xs text-muted-foreground">
                {who} · {format(e.createdAt, "dd MMM yyyy, HH:mm")}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
