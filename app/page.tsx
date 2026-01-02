import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 gap-6">
      <h1 className="text-4xl font-bold">
        Benvenuto nel Video Analyzer di Luca
      </h1>

      <p className="text-lg text-gray-600 text-center max-w-xl">
        Qui potrai caricare un video e farlo analizzare dall’intelligenza artificiale.
      </p>

      <div className="flex flex-col gap-4">
        <Link
          href="/upload"
          className="px-6 py-3 bg-black text-white rounded-lg text-lg hover:bg-gray-800 transition text-center"
        >
          Vai alla pagina Upload
        </Link>

        <Link
          href="/pricing"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg hover:bg-blue-700 transition text-center"
        >
          Vai ai pacchetti
        </Link>
      </div>
    </main>
  );
}
