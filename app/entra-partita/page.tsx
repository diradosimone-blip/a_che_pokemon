"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function EntraPartita() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");

  async function entraNellaStanza() {
    const nomePulito = nome.trim();
    const codicePulito = codice.trim().toUpperCase();

    if (!nomePulito || !codicePulito) {
      return;
    }

    // Cerchiamo la stanza tramite il codice
    const { data: room, error } = await supabase
      .from("rooms")
      .select("id, code, status")
      .eq("code", codicePulito)
      .single();

    if (error || !room) {
      console.error(error);
      alert("Stanza non trovata.");
      return;
    }

    // Inseriamo il giocatore nella stanza
    const { error: playerError } = await supabase
      .from("players")
      .insert({
        room_id: room.id,
        name: nomePulito,
        is_master: false,
      });

    if (playerError) {
      console.error(playerError);
      alert("Errore nell'ingresso nella stanza.");
      return;
    }

    // Andiamo alla lobby
    router.push(
      `/lobby?codice=${encodeURIComponent(
        room.code
      )}&nome=${encodeURIComponent(nomePulito)}`
    );
  }

  const nomeValido = nome.trim().length > 0;
  const codiceValido = codice.trim().length === 6;
  const pronto = nomeValido && codiceValido;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 text-5xl">🚪</div>

            <h1 className="text-4xl font-bold tracking-tight">
              Entra in partita
            </h1>

            <p className="mt-3 text-zinc-400">
              Inserisci il tuo nome e il codice della stanza.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl sm:p-8">
            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-zinc-300">
                Il tuo nome
              </label>

              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pronto) {
                    entraNellaStanza();
                  }
                }}
                placeholder="Es. Marco"
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Codice */}
            <div className="mt-5">
              <label className="block text-sm font-semibold text-zinc-300">
                Codice stanza
              </label>

              <input
                type="text"
                value={codice}
                onChange={(e) =>
                  setCodice(e.target.value.toUpperCase())
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pronto) {
                    entraNellaStanza();
                  }
                }}
                maxLength={6}
                placeholder="Es. ABC123"
                className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3.5 text-center text-lg font-bold uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-600 placeholder:tracking-[0.2em] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />

              <p className="mt-2 text-xs text-zinc-500">
                Il codice è composto da 6 caratteri.
              </p>
            </div>

            {/* Pulsante */}
            <button
              onClick={entraNellaStanza}
              disabled={!pronto}
              className="mt-7 w-full rounded-2xl bg-yellow-400 px-6 py-4 font-bold text-zinc-950 transition hover:bg-yellow-300 hover:shadow-lg hover:shadow-yellow-400/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-yellow-400 disabled:hover:shadow-none"
            >
              🎮 Entra nella stanza
            </button>
          </div>

          {/* Hint */}
          <p className="mt-5 text-center text-xs text-zinc-600">
            Hai ricevuto un codice? Inseriscilo qui per unirti alla partita.
          </p>
        </div>
      </div>
    </main>
  );
}