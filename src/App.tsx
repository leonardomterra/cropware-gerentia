import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-farm-cream text-farm-green-dark p-8 text-center">
      <h1 className="text-2xl font-semibold m-0">Cropware Farm</h1>
      <p className="m-0 text-sm text-farm-soil">
        Scaffolding inicial - commit 3 (shadcn/ui + Radix)
      </p>
      <div className="flex gap-2 mt-2">
        <Button variant="default">Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    </main>
  );
}
