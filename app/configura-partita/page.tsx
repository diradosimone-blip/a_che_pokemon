"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function ConfiguraPartita() {
  const [nome, setNome] = useState("");

  const searchParams = useSearchParams();

  const pokemon = searchParams.get("pokemon") ?? "";
  const masterMode = searchParams.get("master") ?? "chosen";

  const router = useRouter();

  const masterCasuale = masterMode === "random";

  async function creaPartita() {
    const nomePulito = nome.trim();

    if (!nomePulito) {
      alert("Inserisci il tuo nome.");
      return;
    }

    // In modalità Master scelto il Pokémon è obbligatorio.
    // In modalità casuale NON deve essere ancora scelto.
    if (!masterCasuale && !pokemon) {
      alert("Nessun Pokémon selezionato.");
      return;
    }

    const codice = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    // ============================
    // CREIAMO LA STANZA
    // ============================

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code: codice,
        master_name: nomePulito,
        pokemon: masterCasuale ? "" : pokemon,
        status: "lobby",
        master_mode: masterCasuale ? "random" : "chosen",
      })
      .select()
      .single();

    if (roomError || !room) {
      console.error(roomError);
      alert("Errore nella creazione della stanza.");
      return;
    }

    // ============================
    // CREIAMO IL CREATOR
    // ============================

    const { data: master, error: playerError } = await supabase
      .from("players")
      .insert({
        room_id: room.id,
        name: nomePulito,
        is_master: true,
      })
      .select("id")
      .single();

    if (playerError || !master) {
      console.error(playerError);
      alert("Stanza creata, ma errore nell'aggiunta del giocatore.");
      return;
    }

    // ============================
    // SALVIAMO IL CONTROLLER
    // ============================

    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        master_player_id: master.id,
        master_name: nomePulito,
      })
      .eq("id", room.id);

    if (updateError) {
      console.error(updateError);
      alert("Stanza creata, ma errore nella configurazione della stanza.");
      return;
    }

    // ============================
    // LOBBY
    // ============================

    router.push(
      `/lobby?codice=${encodeURIComponent(
        codice
      )}&nome=${encodeURIComponent(
        nomePulito
      )}&pokemon=${encodeURIComponent(
        masterCasuale ? "" : pokemon
      )}`
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8 sm:px-6 sm:py-10 flex items-center justify-center">
      <div className="w-full max-w-2xl">

        {/* ============================
            HEADER
        ============================ */}

        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <span className="text-3xl">
              ⚙️
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Configura la partita
          </h1>

          <p className="text-zinc-400 max-w-xl mx-auto">
            Imposta i dati della partita prima di invitare gli altri giocatori.
          </p>
        </div>

        {/* ============================
            CONFIGURAZIONE
        ============================ */}

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">

          {/* MODALITÀ MASTER */}

          <div className="px-5 py-5 border-b border-zinc-800">
            <p className="text-sm font-semibold text-zinc-300">
              Modalità Master
            </p>

            <div
              className={`mt-3 rounded-2xl border px-4 py-4 ${
                masterCasuale
                  ? "border-blue-500/30 bg-blue-500/10"
                  : "border-purple-500/30 bg-purple-500/10"
              }`}
            >
              <div className="flex items-center gap-3">

                <div className="text-2xl">
                  {masterCasuale ? "🎲" : "👑"}
                </div>

                <div>
                  <p
                    className={`font-bold ${
                      masterCasuale
                        ? "text-blue-400"
                        : "text-purple-400"
                    }`}
                  >
                    {masterCasuale
                      ? "Master casuale"
                      : "Master scelto"}
                  </p>

                  <p className="text-xs text-zinc-500 mt-1">
                    {masterCasuale
                      ? "Il Master verrà estratto tra i giocatori della lobby."
                      : "Tu sarai il Master della partita."}
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* NOME */}

          <div className="p-5 sm:p-6">

            <label className="block text-sm font-medium text-zinc-300">
              {masterCasuale
                ? "Il tuo nome"
                : "Nome del Master"}
            </label>

            <input
              type="text"
              placeholder="Es. Zanzour"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />

            {/* POKÉMON */}

            {!masterCasuale && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <p className="text-sm text-zinc-400">
                  Pokémon scelto
                </p>

                <div className="flex items-center justify-between gap-4">
                  <p className="mt-1 font-bold capitalize text-lg">
                    {pokemon || "Nessun Pokémon selezionato"}
                  </p>

                  <span className="text-2xl">
                    🎯
                  </span>
                </div>
              </div>
            )}

            {/* INFO MASTER CASUALE */}

            {masterCasuale && (
              <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-4">
                <p className="text-sm text-blue-300">
                  🎲 <span className="font-semibold">Master casuale:</span>{" "}
                  non devi scegliere il Pokémon.
                  Prima verrà estratto il Master e sarà lui a scegliere
                  il Pokémon segreto.
                </p>
              </div>
            )}

            {/* CREA */}

            <button
              onClick={creaPartita}
              disabled={!nome.trim() || (!masterCasuale && !pokemon)}
              className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition-all hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              🚀 Crea stanza
            </button>

          </div>
        </div>

      </div>
    </main>
  );
}