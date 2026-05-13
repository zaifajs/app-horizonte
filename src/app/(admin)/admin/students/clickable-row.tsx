"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

export function ClickableRow({
  href,
  onRowClick,
  className,
  children,
}: {
  href?: string;
  onRowClick?: () => void;
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
        if (onRowClick) {
          onRowClick();
        } else if (href) {
          router.push(href);
        }
      }}
    >
      {children}
    </TableRow>
  );
}
