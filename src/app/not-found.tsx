import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        404 - Page Not Found
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        The requested resource could not be found.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
      >
        Return Home
      </Link>
    </div>
  );
}
