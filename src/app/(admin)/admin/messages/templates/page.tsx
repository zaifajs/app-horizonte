import { listAllTemplates } from "@/lib/messaging/template-store";
import { TemplatesEditor } from "./templates-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Message templates · Horizonte CRM" };

export default async function TemplatesPage() {
  const templates = await listAllTemplates();
  return <TemplatesEditor initial={templates} />;
}
