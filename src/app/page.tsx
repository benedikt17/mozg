import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-8">
      <p className="text-sm font-medium tracking-widest text-neutral-500 uppercase">
        Hub foundation
      </p>
      <h1 className="text-4xl font-semibold">Каркас проекта готов</h1>
      <p className="max-w-xl text-neutral-600">
        Минимальный smoke route для проверки Next.js App Router, Tailwind CSS и
        shadcn/ui.
      </p>
      <Button className="w-fit">Smoke UI</Button>
    </main>
  );
}
