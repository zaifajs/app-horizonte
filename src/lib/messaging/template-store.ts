// Resolves message templates by merging hardcoded defaults (templates.ts)
// with DB overrides + user-created templates. Server-only.

import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/routing";
import {
  TEMPLATES,
  EMAIL_SUBJECTS,
  TEMPLATE_META,
  type TemplateKey,
} from "./templates";

export const SYSTEM_TEMPLATE_KEYS: TemplateKey[] = [
  "welcome",
  "payment_reminder",
  "class_reminder",
  "cronograma",
];

export type LocalisedField = Record<Locale, string>;

export type ResolvedTemplate = {
  // Stable identifier: for system templates this is the key
  // (e.g. "payment_reminder"); for custom templates this is the DB row id.
  id: string;
  // Null for custom templates. Set for system templates so automated flows
  // can resolve them.
  key: TemplateKey | null;
  name: string;
  hint: string | null;
  isSystem: boolean;
  // Whether the body/subject for this template was loaded from the DB
  // (i.e. has been edited away from the hardcoded default).
  isCustomised: boolean;
  bodies: LocalisedField;
  subjects: LocalisedField;
  updatedAt: Date | null;
};

const EMPTY_BODIES: LocalisedField = { en: "", pt: "", bn: "", ur: "", hi: "" };

function fromHardcoded(key: TemplateKey): {
  bodies: LocalisedField;
  subjects: LocalisedField;
} {
  return {
    bodies: { ...TEMPLATES[key] },
    subjects: { ...EMAIL_SUBJECTS[key] },
  };
}

function asLocalised(
  raw: unknown,
  fallback: LocalisedField,
): LocalisedField {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const next: LocalisedField = { ...fallback };
  for (const k of ["en", "pt", "bn", "ur", "hi"] as Locale[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === "string" && v.length > 0) next[k] = v;
  }
  return next;
}

/**
 * Load every template (system + custom) merged with hardcoded defaults.
 * Used by the templates admin page and as the source-of-truth feed for
 * the compose UI.
 */
export async function listAllTemplates(): Promise<ResolvedTemplate[]> {
  const dbRows = await prisma.messageTemplate.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  const byKey = new Map<string, (typeof dbRows)[number]>();
  for (const r of dbRows) if (r.key) byKey.set(r.key, r);

  const system: ResolvedTemplate[] = SYSTEM_TEMPLATE_KEYS.map((key) => {
    const meta = TEMPLATE_META[key];
    const db = byKey.get(key);
    const defaults = fromHardcoded(key);
    return {
      id: db?.id ?? key,
      key,
      name: meta.label,
      hint: meta.hint ?? null,
      isSystem: true,
      isCustomised: Boolean(db),
      bodies: db ? asLocalised(db.bodies, defaults.bodies) : defaults.bodies,
      subjects: db ? asLocalised(db.subjects, defaults.subjects) : defaults.subjects,
      updatedAt: db?.updatedAt ?? null,
    };
  });

  const custom: ResolvedTemplate[] = dbRows
    .filter((r) => !r.isSystem)
    .map((r) => ({
      id: r.id,
      key: null,
      name: r.name,
      hint: null,
      isSystem: false,
      isCustomised: true,
      bodies: asLocalised(r.bodies, EMPTY_BODIES),
      subjects: asLocalised(r.subjects, EMPTY_BODIES),
      updatedAt: r.updatedAt,
    }));

  return [...system, ...custom];
}

/**
 * Resolve the (subject, body) for a single template + locale pair.
 * Falls back to hardcoded defaults for system templates if no DB row
 * exists. Returns null if the template can't be found at all.
 */
export async function resolveTemplate({
  id,
  locale,
}: {
  id: string;
  locale: Locale;
}): Promise<{ subject: string; body: string; key: TemplateKey | null; name: string } | null> {
  // System templates use the key as their stable id.
  if ((SYSTEM_TEMPLATE_KEYS as string[]).includes(id)) {
    const key = id as TemplateKey;
    const db = await prisma.messageTemplate.findUnique({ where: { key } });
    const defaults = fromHardcoded(key);
    const bodies = db ? asLocalised(db.bodies, defaults.bodies) : defaults.bodies;
    const subjects = db ? asLocalised(db.subjects, defaults.subjects) : defaults.subjects;
    return {
      key,
      name: TEMPLATE_META[key].label,
      body: bodies[locale] || bodies.en,
      subject: subjects[locale] || subjects.en,
    };
  }
  // Custom — UUID lookup.
  const db = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!db) return null;
  const bodies = asLocalised(db.bodies, EMPTY_BODIES);
  const subjects = asLocalised(db.subjects, EMPTY_BODIES);
  return {
    key: null,
    name: db.name,
    body: bodies[locale] || bodies.en || "",
    subject: subjects[locale] || subjects.en || "",
  };
}
