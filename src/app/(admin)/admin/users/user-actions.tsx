"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteUserAction,
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
  const [feedback, setFeedback] = useState<string | null>(null);

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

  function remove() {
    if (isSelf) return;
    const ok = confirm(
      `Permanently delete ${user.name}? This removes the login entirely. Use Deactivate if you might want them back.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteUserAction({ userId: user.id });
      if (!result.ok) {
        setFeedback(result.error ?? "Couldn't delete the user.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
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
        <Button
          variant="outline"
          size="sm"
          disabled={isSelf || pending}
          onClick={remove}
          aria-label="Delete user"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {feedback ? (
        <p className="text-xs text-destructive text-right">{feedback}</p>
      ) : null}
    </div>
  );
}
