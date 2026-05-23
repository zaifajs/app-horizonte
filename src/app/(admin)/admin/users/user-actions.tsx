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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteUserAction,
  setUserActiveAction,
  setUserRoleAction,
} from "@/lib/actions/users";

type Role = "ADMIN" | "STAFF" | "TEACHER" | "STUDENT";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

type PendingConfirm =
  | { kind: "deactivate" }
  | { kind: "delete" }
  | { kind: "role"; nextRole: Role }
  | null;

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
  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  function requestRoleChange(role: Role) {
    if (role === user.role || isSelf) return;
    setConfirm({ kind: "role", nextRole: role });
  }

  function requestToggle() {
    if (isSelf) return;
    if (user.isActive) {
      setConfirm({ kind: "deactivate" });
    } else {
      // Reactivation is not destructive — fire immediately.
      startTransition(async () => {
        await setUserActiveAction({ userId: user.id, isActive: true });
        router.refresh();
      });
    }
  }

  function requestDelete() {
    if (isSelf) return;
    setConfirm({ kind: "delete" });
  }

  function runConfirmed() {
    if (!confirm) return;
    const c = confirm;
    startTransition(async () => {
      if (c.kind === "role") {
        await setUserRoleAction({ userId: user.id, role: c.nextRole });
      } else if (c.kind === "deactivate") {
        await setUserActiveAction({ userId: user.id, isActive: false });
      } else if (c.kind === "delete") {
        const result = await deleteUserAction({ userId: user.id });
        if (!result.ok) {
          setFeedback(result.error ?? "Couldn't delete the user.");
          setConfirm(null);
          return;
        }
      }
      setConfirm(null);
      router.refresh();
    });
  }

  const dialogProps = (() => {
    if (!confirm) return null;
    if (confirm.kind === "deactivate") {
      return {
        title: `Deactivate ${user.name}?`,
        description: "They won't be able to sign in. You can reactivate them later.",
        confirmLabel: "Deactivate",
        destructive: true,
      };
    }
    if (confirm.kind === "delete") {
      return {
        title: `Permanently delete ${user.name}?`,
        description:
          "This removes the login entirely. Use Deactivate if you might want them back.",
        confirmLabel: "Delete",
        destructive: true,
      };
    }
    return {
      title: `Change role to ${ROLE_LABEL[confirm.nextRole]}?`,
      description: `${user.name} will lose access to anything tied to the ${ROLE_LABEL[user.role]} role.`,
      confirmLabel: "Change role",
      destructive: false,
    };
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-2">
        <Select
          value={user.role}
          onValueChange={(v) => v && requestRoleChange(v as Role)}
          disabled={isSelf || pending}
        >
          <SelectTrigger className="h-8 text-xs w-[110px]">
            <SelectValue>
              {(v: string) =>
                v === "ADMIN"
                  ? "Admin"
                  : v === "STAFF"
                  ? "Staff"
                  : v === "TEACHER"
                  ? "Teacher"
                  : ""
              }
            </SelectValue>
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
          onClick={requestToggle}
        >
          {user.isActive ? "Deactivate" : "Reactivate"}
        </Button>
        {/* Delete is only available for deactivated users — collapses the
            previously confusing "Deactivate AND trash" pair into a
            progressive disclosure. Forces the safer path first. */}
        {!user.isActive ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isSelf || pending}
            onClick={requestDelete}
            aria-label="Delete user"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {feedback ? (
        <p className="text-xs text-destructive text-right">{feedback}</p>
      ) : null}
      {dialogProps ? (
        <ConfirmDialog
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          pending={pending}
          onConfirm={runConfirmed}
          {...dialogProps}
        />
      ) : null}
    </div>
  );
}
