import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EditStudentForm } from "./edit-student-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit student · Horizonte CRM" };

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit {student.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Updating personal info. Changes are audit-logged.
          </p>
        </div>
        <Link href={`/admin/students/${id}`}>
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <EditStudentForm
        initial={{
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          phone: student.phone,
          docType: student.docType,
          docNumber: student.docNumber,
          dob: student.dob.toISOString().slice(0, 10),
          docExpiry: student.docExpiry.toISOString().slice(0, 10),
          nationality: student.nationality,
          nif: student.nif,
          niss: student.niss ?? "",
          address: student.address,
          city: student.city,
          notes: student.notes ?? "",
        }}
      />
    </div>
  );
}
