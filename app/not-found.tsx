import { ButtonLink, Card } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <Card className="px-6 py-12">
        <p className="text-sm font-semibold text-teal-700">404</p>
        <h1 className="mt-2 text-2xl font-bold text-navy-900">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
          <ButtonLink href="/dashboard">Dashboard</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
