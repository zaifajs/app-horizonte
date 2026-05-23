"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// Client wrapper that pops the Sheet open by default; closing it routes back
// to /admin/students (or wherever the user came from).

export function StudentDrawerShell({
  title,
  children,
}: {
  title: string;
  studentId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      router.back();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-full sm:!max-w-none md:!w-1/2 overflow-y-auto p-6"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Student detail</SheetDescription>
        </SheetHeader>
        <div className="space-y-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
