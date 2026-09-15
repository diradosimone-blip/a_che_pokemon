"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl font-bold">
          🎮 A che Pokémon sto pensando?
        </h1>

        <p className="mt-4 text-lg text-slate-400">
          Un giocatore pensa a un Pokémon.
          <br />
          Gli altri devono scoprirlo facendo domande a cui si può rispondere
          solo SÌ o NO.
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-4">
          <button
            onClick={() => router.push("/crea-partita")}
            className="rounded-xl bg-yellow-400 px-6 py-4 text-lg font-bold text-slate-950 transition hover:bg-yellow-300"
          >
            🎮 Crea una partita
          </button>

          <button
            onClick={() => router.push("/entra-partita")}
            className="rounded-xl bg-slate-800 px-6 py-4 text-lg font-bold text-white transition hover:bg-slate-700"
          >
            🚪 Entra in una partita
          </button>
        </div>
      </div>
    </main>
  );
}