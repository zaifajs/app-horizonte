"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

// Makes the entire <tr> navigate to `href` on click, while leaving any
// nested button / link / dialog trigger free to handle its own click.

export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={`cursor-pointer ${className ?? ""}`}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest(
            'button, a, [role="dialog"], [role="menu"], input, label, select, textarea, [data-no-navigate]',
          )
        ) {
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
