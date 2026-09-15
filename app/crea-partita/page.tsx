"use client";

import { useRouter } from "next/navigation";

export default function CreaPartita() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8 sm:px-6 sm:py-10 flex items-center justify-center">
      <div className="w-full max-w-3xl">

        {/* ============================
            HEADER
        ============================ */}

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <span className="text-3xl">
              🎮
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Crea una partita
          </h1>

          <p className="text-zinc-400 max-w-xl mx-auto">
            Scegli come verrà determinato il Master della partita.
          </p>
        </div>

        {/* ============================
            SCELTA MASTER
        ============================ */}

        <div className="grid gap-5">

          {/* MASTER SCELTO */}

          <button
            onClick={() =>
              router.push("/scegli-pokemon?master=chosen")
            }
            className="w-full rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 text-left transition-all duration-200 hover:border-purple-500/40 hover:bg-zinc-800/80 hover:-translate-y-0.5"
          >
            <div className="flex items-start gap-4">

              <div className="shrink-0 w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <span className="text-3xl">
                  👑
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  Master scelto
                </h2>

                <p className="mt-2 text-sm sm:text-base text-zinc-400">
                  Tu crei la stanza, scegli il Pokémon e rimani il
                  Master per tutta la partita.
                </p>

                <div className="mt-4 inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-400">
                  👑 Master fisso
                </div>
              </div>

            </div>
          </button>

          {/* MASTER CASUALE */}

          <button
            onClick={() =>
              router.push("/configura-partita?master=random")
            }
            className="w-full rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-7 text-left transition-all duration-200 hover:border-blue-500/40 hover:bg-zinc-800/80 hover:-translate-y-0.5"
          >
            <div className="flex items-start gap-4">

              <div className="shrink-0 w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <span className="text-3xl">
                  🎲
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  Master casuale
                </h2>

                <p className="mt-2 text-sm sm:text-base text-zinc-400">
                  Crea la stanza senza scegliere il Pokémon.
                  Il Master verrà estratto tra i giocatori presenti
                  nella lobby.
                </p>

                <div className="mt-4 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400">
                  🎲 Master e Pokémon scelti dopo
                </div>
              </div>

            </div>
          </button>

        </div>

      </div>
    </main>
  );
}