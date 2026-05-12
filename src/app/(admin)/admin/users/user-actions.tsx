"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setUserActiveAction,
  setUserRoleAction,
} from "@/lib/actions/users";

type Role = "ADMIN" | "STAFF" | "TEACHER" | "STUDENT";

export function UserActions({
  user,
  isSelf,
}: {
  user: { id: string; name: string; role: Role; isActive: boolean };
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeRole(role: Role) {
    if (role === user.role) return;
    startTransition(async () => {
      await setUserRoleAction({ userId: user.id, role });
      router.refresh();
    });
  }

  function toggle() {
    if (isSelf) return;
    if (
      user.isActive &&
      !confirm(`Deactivate ${user.name}? They won't be able to sign in.`)
    ) {
      return;
    }
    startTransition(async () => {
      await setUserActiveAction({ userId: user.id, isActive: !user.isActive });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        value={user.role}
        onValueChange={(v) => v && changeRole(v as Role)}
        disabled={isSelf || pending}
      >
        <SelectTrigger className="h-8 text-xs w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="STAFF">Staff</SelectItem>
          <SelectItem value="TEACHER">Teacher</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        disabled={isSelf || pending}
        onClick={toggle}
      >
        {user.isActive ? "Deactivate" : "Reactivate"}
      </Button>
    </div>
  );
}
