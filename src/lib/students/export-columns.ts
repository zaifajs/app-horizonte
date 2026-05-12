// Single source of truth for what can land in the CSV export.

export type ExportColumnKey =
  | "batchSeq"
  | "name"
  | "email"
  | "phone"
  | "docType"
  | "docNumber"
  | "dob"
  | "nationality"
  | "nif"
  | "niss"
  | "address"
  | "city"
  | "batch"
  | "status"
  | "fee"
  | "paid"
  | "due"
  | "lastPayment"
  | "registered";

export type ExportColumn = {
  key: ExportColumnKey;
  label: string;
};

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "batchSeq", label: "# in batch" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "docType", label: "Doc type" },
  { key: "docNumber", label: "Doc number" },
  { key: "dob", label: "Date of birth" },
  { key: "nationality", label: "Nationality" },
  { key: "nif", label: "NIF (tax ID)" },
  { key: "niss", label: "NISS" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "batch", label: "Batch" },
  { key: "status", label: "Enrollment status" },
  { key: "fee", label: "Course fee (EUR)" },
  { key: "paid", label: "Paid (EUR)" },
  { key: "due", label: "Due (EUR)" },
  { key: "lastPayment", label: "Last payment date" },
  { key: "registered", label: "Registered" },
];

export const DEFAULT_EXPORT_COLUMNS: ExportColumnKey[] = [
  "batchSeq",
  "name",
  "email",
  "phone",
  "batch",
  "status",
  "fee",
  "paid",
  "due",
  "registered",
];

export function parseColsParam(raw: string | null): ExportColumnKey[] {
  if (!raw) return EXPORT_COLUMNS.map((c) => c.key);
  const valid = new Set<string>(EXPORT_COLUMNS.map((c) => c.key));
  const out: ExportColumnKey[] = [];
  for (const k of raw.split(",")) {
    const trimmed = k.trim();
    if (valid.has(trimmed)) out.push(trimmed as ExportColumnKey);
  }
  return out.length > 0 ? out : EXPORT_COLUMNS.map((c) => c.key);
}
