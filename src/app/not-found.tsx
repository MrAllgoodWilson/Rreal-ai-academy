import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <p className="font-display text-8xl font-bold heading-gradient">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold">This page took a wrong turn</h1>
        <p className="mt-2 text-muted">Even good AI hallucinates sometimes.</p>
        <Link href="/" className="btn-primary mt-6">Go home</Link>
      </div>
    </div>
  );
}
