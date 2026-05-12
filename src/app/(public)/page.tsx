import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 flex flex-col items-start gap-6">
      <h1 className="text-4xl font-semibold tracking-tight">
        Português Língua de Acolhimento
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl">
        Aulas A1 e A2 · 6 módulos · 150 horas. Inscrições abertas para as
        próximas turmas em Porto.
      </p>
      <div className="flex gap-3">
        <Link href="/register">
          <Button>Inscrever-me</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">Entrar</Button>
        </Link>
      </div>
    </section>
  );
}
