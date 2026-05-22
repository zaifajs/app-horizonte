"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteTemplateAction,
  resetSystemTemplateAction,
  saveTemplateAction,
} from "@/lib/actions/templates";
import type { ResolvedTemplate, LocalisedField } from "@/lib/messaging/template-store";
import type { Locale } from "@/i18n/routing";
import type { TemplateKey } from "@/lib/messaging/templates";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const LOCALES: { key: Locale; label: string }[] = [
  { key: "pt", label: "PT" },
  { key: "en", label: "EN" },
  { key: "bn", label: "BN" },
  { key: "ur", label: "UR" },
  { key: "hi", label: "HI" },
];

// Variables available to all templates — exposed as chips above each body.
const VARIABLES: { name: string; sample: string }[] = [
  { name: "name", sample: "Aisha" },
  { name: "batch", sample: "M32" },
  { name: "startDate", sample: "2026-05-18" },
  { name: "dueAmount", sample: "€225" },
  { name: "nextSessionDate", sample: "tomorrow" },
  { name: "scheduleUrl", sample: "https://nhorizonte.pt/turma/m32" },
];

function interpolate(body: string): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => {
    const v = VARIABLES.find((x) => x.name === name);
    return v ? v.sample : `{{${name}}}`;
  });
}

type DraftMap = Map<string, ResolvedTemplate>;

function cloneAll(arr: ResolvedTemplate[]): DraftMap {
  return new Map(arr.map((t) => [t.id, { ...t, bodies: { ...t.bodies }, subjects: { ...t.subjects } }]));
}

export function TemplatesEditor({ initial }: { initial: ResolvedTemplate[] }) {
  const router = useRouter();
  const [originalList, setOriginalList] = useState(initial);
  const [drafts, setDrafts] = useState<DraftMap>(() => cloneAll(initial));
  const [locale, setLocale] = useState<Locale>("pt");
  const [selectedId, setSelectedId] = useState<string>(
    initial.find((t) => t.key === "payment_reminder")?.id ?? initial[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ key: string; name: string } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detect unsaved diffs vs original.
  const dirtyIds = useMemo(() => {
    const set = new Set<string>();
    const origById = new Map(originalList.map((t) => [t.id, t]));
    for (const t of drafts.values()) {
      const orig = origById.get(t.id);
      if (!orig) {
        // New / unsaved template id is the same as the draft's id, but
        // brand-new local-only ones live in a separate created queue.
        continue;
      }
      if (
        orig.name !== t.name ||
        JSON.stringify(orig.bodies) !== JSON.stringify(t.bodies) ||
        JSON.stringify(orig.subjects) !== JSON.stringify(t.subjects)
      ) {
        set.add(t.id);
      }
    }
    return set;
  }, [drafts, originalList]);

  function updateBody(id: string, value: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const t = next.get(id);
      if (!t) return next;
      next.set(id, { ...t, bodies: { ...t.bodies, [locale]: value } });
      return next;
    });
  }

  function updateSubject(id: string, value: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const t = next.get(id);
      if (!t) return next;
      next.set(id, { ...t, subjects: { ...t.subjects, [locale]: value } });
      return next;
    });
  }

  function updateName(id: string, value: string) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const t = next.get(id);
      if (!t) return next;
      next.set(id, { ...t, name: value });
      return next;
    });
  }

  function insertVar(id: string, field: "body" | "subject", varName: string) {
    const tokenToInsert = `{{${varName}}}`;
    const t = drafts.get(id);
    if (!t) return;
    if (field === "body") {
      updateBody(id, (t.bodies[locale] ?? "") + tokenToInsert);
    } else {
      updateSubject(id, (t.subjects[locale] ?? "") + tokenToInsert);
    }
  }

  function saveAll() {
    setError(null);
    setSavedAt(null);
    const toSave = Array.from(drafts.values()).filter((t) => dirtyIds.has(t.id));
    if (toSave.length === 0) return;
    startTransition(async () => {
      for (const t of toSave) {
        const res = await saveTemplateAction({
          id: t.isSystem ? undefined : t.id,
          key: t.isSystem ? (t.key ?? undefined) : undefined,
          name: t.name,
          bodies: t.bodies,
          subjects: t.subjects,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  function createTemplate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const empty: LocalisedField = { en: "", pt: "", bn: "", ur: "", hi: "" };
      const res = await saveTemplateAction({
        name: newName.trim(),
        bodies: empty,
        subjects: empty,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Optimistic local insert; router.refresh re-fetches from server.
      const newT: ResolvedTemplate = {
        id: res.id,
        key: null,
        name: newName.trim(),
        hint: null,
        isSystem: false,
        isCustomised: true,
        bodies: empty,
        subjects: empty,
        updatedAt: new Date(),
      };
      setOriginalList((prev) => [...prev, newT]);
      setDrafts((prev) => {
        const next = new Map(prev);
        next.set(res.id, newT);
        return next;
      });
      setSelectedId(res.id);
      setCreating(false);
      setNewName("");
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    startTransition(async () => {
      const res = await deleteTemplateAction({ id });
      if (!res.ok) {
        setError(res.error);
        setDeleteTarget(null);
        return;
      }
      setOriginalList((prev) => prev.filter((t) => t.id !== id));
      setDrafts((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      // Jump back to a safe default after deleting the currently-selected one.
      if (selectedId === id) {
        const fallback =
          originalList.find((t) => t.key === "payment_reminder")?.id ??
          originalList.find((t) => t.id !== id)?.id ??
          "";
        setSelectedId(fallback);
      }
      setDeleteTarget(null);
      router.refresh();
    });
  }

  function confirmReset() {
    if (!resetTarget) return;
    const key = resetTarget.key;
    startTransition(async () => {
      const res = await resetSystemTemplateAction({ key });
      if (!res.ok) {
        setError(res.error);
        setResetTarget(null);
        return;
      }
      setResetTarget(null);
      router.refresh();
    });
  }

  const draftList = Array.from(drafts.values());
  const hasUnsaved = dirtyIds.size > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="text-sm hz-mono uppercase tracking-[.18em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            Messaging
          </div>
          <h1 className="font-display text-4xl font-medium mt-1">Templates</h1>
          <div className="mt-1.5 text-sm hz-mono" style={{ color: "var(--hz-ink-2)" }}>
            {draftList.filter((t) => t.isSystem).length} system ·{" "}
            {draftList.filter((t) => !t.isSystem).length} custom
            {hasUnsaved ? (
              <span className="ml-3 chip chip-warning">{dirtyIds.size} unsaved</span>
            ) : savedAt ? (
              <span className="ml-3 hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
                Saved {savedAt.toLocaleTimeString()}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-ghost"
            disabled={pending}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New template
          </button>
          <button
            type="button"
            onClick={saveAll}
            className="btn-primary"
            disabled={pending || !hasUnsaved}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {pending ? "Saving…" : `Save ${hasUnsaved ? `(${dirtyIds.size})` : ""}`}
          </button>
        </div>
      </section>

      {/* Locale tabs */}
      <div className="flex items-center gap-3">
        <div className="seg">
          {LOCALES.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLocale(l.key)}
              className={locale === l.key ? "on" : ""}
            >
              {l.label}
            </button>
          ))}
        </div>
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          Editing {locale.toUpperCase()} version · switch tab to edit another language
        </span>
      </div>

      {error ? (
        <p className="text-sm" style={{ color: "var(--hz-danger)" }} role="alert">
          {error}
        </p>
      ) : null}

      {/* Template picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="text-xs hz-mono uppercase tracking-[.16em]"
          style={{ color: "var(--hz-ink-3)" }}
        >
          Editing
        </div>
        <div className="relative" style={{ minWidth: 280 }}>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full appearance-none btn-ghost text-left"
            style={{ paddingLeft: 12, paddingRight: 30, height: 38, fontSize: "0.875rem" }}
          >
            <optgroup label="System">
              {draftList.filter((t) => t.isSystem).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {dirtyIds.has(t.id) ? " •" : ""}
                </option>
              ))}
            </optgroup>
            {draftList.some((t) => !t.isSystem) ? (
              <optgroup label="Custom">
                {draftList.filter((t) => !t.isSystem).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {dirtyIds.has(t.id) ? " •" : ""}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--hz-ink-3)",
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <span className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
          Switching templates keeps your unsaved edits — they all get committed when you click Save.
        </span>
      </div>

      {/* Selected template editor */}
      {(() => {
        const t = drafts.get(selectedId);
        if (!t) {
          return (
            <p className="hz-mono text-sm" style={{ color: "var(--hz-ink-3)" }}>
              Pick a template above to start editing.
            </p>
          );
        }
        return (
          <TemplateCard
            template={t}
            locale={locale}
            isDirty={dirtyIds.has(t.id)}
            onUpdateBody={(v) => updateBody(t.id, v)}
            onUpdateSubject={(v) => updateSubject(t.id, v)}
            onUpdateName={(v) => updateName(t.id, v)}
            onInsertVar={(field, name) => insertVar(t.id, field, name)}
            onReset={
              t.isSystem && t.isCustomised
                ? () => setResetTarget({ key: t.key!, name: t.name })
                : null
            }
            onDelete={
              !t.isSystem ? () => setDeleteTarget({ id: t.id, name: t.name }) : null
            }
          />
        );
      })()}

      {/* Create-new dialog */}
      {creating ? (
        <CreateDialog
          name={newName}
          onChangeName={setNewName}
          onCancel={() => {
            setCreating(false);
            setNewName("");
          }}
          onCreate={createTemplate}
          pending={pending}
        />
      ) : null}

      {/* Delete confirm */}
      {deleteTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title={`Delete "${deleteTarget.name}"?`}
          description="This template will be permanently removed. Existing message logs referencing it stay intact."
          confirmLabel="Delete template"
          destructive
          pending={pending}
          onConfirm={confirmDelete}
        />
      ) : null}

      {/* Reset confirm */}
      {resetTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setResetTarget(null)}
          title={`Reset "${resetTarget.name}" to default?`}
          description="Any edits across all languages will be discarded. The hardcoded default in the codebase takes over again."
          confirmLabel="Reset"
          destructive
          pending={pending}
          onConfirm={confirmReset}
        />
      ) : null}

      {/* Where templates are used */}
      <p className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
        System templates power automated flows. Custom templates are available in the{" "}
        <Link href="/admin/students" className="underline">
          students send-message
        </Link>{" "}
        drawer.
      </p>
    </div>
  );
}

function TemplateCard({
  template,
  locale,
  isDirty,
  onUpdateBody,
  onUpdateSubject,
  onUpdateName,
  onInsertVar,
  onReset,
  onDelete,
}: {
  template: ResolvedTemplate;
  locale: Locale;
  isDirty: boolean;
  onUpdateBody: (v: string) => void;
  onUpdateSubject: (v: string) => void;
  onUpdateName: (v: string) => void;
  onInsertVar: (field: "body" | "subject", name: string) => void;
  onReset: null | (() => void);
  onDelete: null | (() => void);
}) {
  const [editingName, setEditingName] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const body = template.bodies[locale] ?? "";
  const subject = template.subjects[locale] ?? "";
  const preview = interpolate(body);

  return (
    <section className="hz-card overflow-hidden" style={{ textAlign: "left" }}>
      <header className="px-4 py-3 hair-b flex items-center gap-2" style={{ background: "var(--hz-surface-2)" }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {template.isSystem || !editingName ? (
              <span className="font-display text-lg font-medium">{template.name}</span>
            ) : (
              <input
                value={template.name}
                onChange={(e) => onUpdateName(e.target.value)}
                onBlur={() => setEditingName(false)}
                autoFocus
                className="font-display text-lg font-medium"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "1px solid var(--hz-primary)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  color: "var(--hz-ink)",
                }}
              />
            )}
            <span
              className={`chip ${template.isSystem ? "chip-info" : "chip-muted"}`}
            >
              {template.isSystem ? "SYSTEM" : "CUSTOM"}
            </span>
            {isDirty ? <span className="chip chip-warning">UNSAVED</span> : null}
            {template.isSystem && template.isCustomised ? (
              <span className="chip chip-primary">EDITED</span>
            ) : null}
          </div>
          {template.hint ? (
            <div className="text-xs hz-mono mt-1" style={{ color: "var(--hz-ink-3)" }}>
              {template.hint}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {!template.isSystem ? (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="btn-ghost text-xs"
              style={{ padding: "4px 9px" }}
            >
              Rename
            </button>
          ) : null}
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="btn-ghost text-xs"
              style={{ padding: "4px 9px" }}
              title="Revert to the hardcoded default"
            >
              Reset
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="btn-ghost text-xs"
              style={{
                padding: "4px 9px",
                color: "var(--hz-danger)",
                borderColor: "rgba(248,113,113,0.3)",
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Subject */}
        <div>
          <label className="field-label">Email subject</label>
          <label className="inp" style={{ height: 42 }}>
            <input
              ref={subjectRef}
              value={subject}
              onChange={(e) => onUpdateSubject(e.target.value)}
              placeholder="(empty)"
            />
          </label>
          <VariableChips
            onPick={(name) => {
              onInsertVar("subject", name);
              subjectRef.current?.focus();
            }}
          />
        </div>

        {/* Body */}
        <div>
          <label className="field-label">Message body</label>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => onUpdateBody(e.target.value)}
            rows={6}
            className="inp"
            style={{
              width: "100%",
              height: "auto",
              padding: "10px 12px",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.5,
              resize: "vertical",
              display: "block",
            }}
            placeholder="Write the message body here. Use {{name}}, {{batch}}, etc. for placeholders."
          />
          <VariableChips
            onPick={(name) => {
              onInsertVar("body", name);
              bodyRef.current?.focus();
            }}
          />
        </div>

        {/* Preview */}
        {body ? (
          <div>
            <div
              className="text-xs hz-mono uppercase tracking-[.14em] mb-1.5"
              style={{ color: "var(--hz-ink-3)" }}
            >
              Preview with sample data
            </div>
            <div
              className="p-3 rounded-md text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: "var(--hz-surface-2)",
                border: "1px solid var(--hz-line)",
                color: "var(--hz-ink)",
              }}
            >
              {preview}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function VariableChips({ onPick }: { onPick: (name: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs hz-mono" style={{ color: "var(--hz-ink-3)" }}>
        Insert:
      </span>
      {VARIABLES.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={() => onPick(v.name)}
          className="quick-amt"
        >
          {`{{${v.name}}}`}
        </button>
      ))}
    </div>
  );
}

function CreateDialog({
  name,
  onChangeName,
  onCancel,
  onCreate,
  pending,
}: {
  name: string;
  onChangeName: (v: string) => void;
  onCancel: () => void;
  onCreate: () => void;
  pending: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,14,20,0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: "100%",
          background: "var(--hz-surface)",
          border: "1px solid var(--hz-line)",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.6)",
          textAlign: "left",
        }}
      >
        <header className="px-5 py-4 hair-b">
          <div
            className="text-xs hz-mono uppercase tracking-[.16em]"
            style={{ color: "var(--hz-ink-3)" }}
          >
            New template
          </div>
          <div className="mt-0.5 font-display text-xl font-medium">
            Create a custom template
          </div>
        </header>
        <div className="px-5 py-5 space-y-3">
          <label className="field-label">Name</label>
          <label className="inp" style={{ height: 42 }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              placeholder="e.g. Holiday wishes"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) onCreate();
              }}
            />
          </label>
          <p className="hz-mono text-xs" style={{ color: "var(--hz-ink-3)" }}>
            You can edit subjects and bodies per language after creating.
          </p>
        </div>
        <footer
          className="hair-t px-5 py-3 flex items-center justify-end gap-2"
          style={{ background: "var(--hz-surface-2)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost"
            style={{ height: 38 }}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="btn-primary"
            style={{ height: 38 }}
            disabled={pending || !name.trim()}
          >
            {pending ? "Creating…" : "Create template"}
          </button>
        </footer>
      </div>
    </div>
  );
}
