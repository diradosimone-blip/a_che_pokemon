"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "../lib/supabase";

type PokemonSpecies = {
  name: string;
  url: string;
};

type Pokemon = {
  id: number;
  name: string;
};

function ScegliPokemonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const masterMode =
    searchParams.get("master") ?? "chosen";

  const codiceStanza =
    searchParams.get("codice") ?? "";

  const nomeGiocatore =
    searchParams.get("nome") ?? "";

  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState("");
  const [selezionato, setSelezionato] =
    useState<Pokemon | null>(null);
  const [salvando, setSalvando] = useState(false);

  const sceltaDaPartitaEsistente =
    !!codiceStanza && !!nomeGiocatore;

  useEffect(() => {
    async function caricaPokemon() {
      try {
        setCaricando(true);
        setErrore("");

        const response = await fetch(
          "https://pokeapi.co/api/v2/pokemon-species?limit=2000&offset=0"
        );

        if (!response.ok) {
          throw new Error("Errore caricamento Pokédex");
        }

        const data = await response.json();

        const risultati: PokemonSpecies[] =
          data.results ?? [];

        const lista: Pokemon[] = risultati
          .map((item) => {
            const match = item.url.match(
              /pokemon-species\/(\d+)\/?$/
            );

            if (!match) {
              return null;
            }

            return {
              id: Number(match[1]),
              name: item.name,
            };
          })
          .filter(
            (item): item is Pokemon =>
              item !== null
          )
          .sort((a, b) => a.id - b.id);

        setPokemon(lista);
      } catch (error) {
        console.error(error);

        setErrore(
          "Impossibile caricare il Pokédex. Riprova."
        );
      } finally {
        setCaricando(false);
      }
    }

    caricaPokemon();
  }, []);

  const pokemonFiltrati = useMemo(() => {
    const testo = ricerca.toLowerCase().trim();

    if (!testo) {
      return pokemon;
    }

    return pokemon.filter((p) =>
      p.name.toLowerCase().includes(testo)
    );
  }, [pokemon, ricerca]);

  function immaginePokemon(id: number) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  // ==========================================
  // POKÉMON CASUALE
  // ==========================================

  function pokemonCasuale() {
    if (pokemon.length === 0) {
      return;
    }

    const indiceCasuale = Math.floor(
      Math.random() * pokemon.length
    );

    const casuale = pokemon[indiceCasuale];

    setSelezionato(casuale);

    // Se era presente una ricerca, la puliamo
    // così il Pokémon estratto rimane facilmente
    // individuabile nella griglia.
    setRicerca("");
  }

  async function confermaPokemon() {
    if (!selezionato) {
      alert("Seleziona un Pokémon.");
      return;
    }

    // ==================================================
    // PARTITA GIÀ CREATA - MASTER CASUALE
    // ==================================================

    if (sceltaDaPartitaEsistente) {
      setSalvando(true);

      try {
        // ============================
        // RECUPERIAMO LA STANZA
        // ============================

        const {
          data: room,
          error: roomError,
        } = await supabase
          .from("rooms")
          .select(
            "id, master_player_id, master_mode, status"
          )
          .eq(
            "code",
            codiceStanza.toUpperCase()
          )
          .maybeSingle();

        if (roomError || !room) {
          console.error(roomError);

          alert(
            "Impossibile trovare la stanza."
          );

          setSalvando(false);
          return;
        }

        // ============================
        // TROVIAMO IL GIOCATORE
        // ============================

        const {
          data: player,
          error: playerError,
        } = await supabase
          .from("players")
          .select("id, name")
          .eq("room_id", room.id)
          .eq("name", nomeGiocatore)
          .maybeSingle();

        if (playerError || !player) {
          console.error(playerError);

          alert(
            "Impossibile trovare il tuo giocatore nella stanza."
          );

          setSalvando(false);
          return;
        }

        // ============================
        // VERIFICA MASTER
        // ============================

        if (
          room.master_player_id !==
          player.id
        ) {
          alert(
            "Non sei il Master di questa partita."
          );

          setSalvando(false);
          return;
        }

        // ============================
        // VERIFICA STATO
        // ============================

        if (room.status !== "choosing") {
          alert(
            "La scelta del Pokémon non è più disponibile."
          );

          setSalvando(false);
          return;
        }

        // ============================
        // RECUPERIAMO TUTTI I GIOCATORI
        // ============================

        const {
          data: players,
          error: playersError,
        } = await supabase
          .from("players")
          .select("id, name")
          .eq("room_id", room.id);

        if (
          playersError ||
          !players ||
          players.length < 2
        ) {
          alert(
            "Non ci sono abbastanza giocatori per iniziare."
          );

          setSalvando(false);
          return;
        }

        // ============================
        // PRIMO TURNO
        // ============================

        const giocatoriDisponibili =
          players.filter(
            (p) => p.id !== player.id
          );

        if (
          giocatoriDisponibili.length === 0
        ) {
          alert(
            "Il Master deve avere almeno un altro giocatore."
          );

          setSalvando(false);
          return;
        }

        const primoGiocatore =
          giocatoriDisponibili[0];

        // ============================
        // SALVIAMO POKÉMON E AVVIAMO
        // ============================

        const {
          error: updateError,
        } = await supabase
          .from("rooms")
          .update({
            pokemon: selezionato.name,
            status: "playing",
            current_turn_player_id:
              primoGiocatore.id,
            winner_player_id: null,
            finished_at: null,
          })
          .eq("id", room.id)
          .eq(
            "master_player_id",
            player.id
          )
          .eq("status", "choosing");

        if (updateError) {
          console.error(updateError);

          alert(
            "Errore nel salvataggio del Pokémon."
          );

          setSalvando(false);
          return;
        }

        // ============================
        // CONFERMIAMO IL MASTER
        // ============================

        await supabase
          .from("players")
          .update({
            is_master: false,
          })
          .eq("room_id", room.id);

        const {
          error: masterError,
        } = await supabase
          .from("players")
          .update({
            is_master: true,
          })
          .eq("id", player.id)
          .eq("room_id", room.id);

        if (masterError) {
          console.error(
            "Errore sincronizzazione Master:",
            masterError
          );
        }

        // ============================
        // ACCESSO ALLA PARTITA
        // ============================

        router.push(
          `/partita?codice=${encodeURIComponent(
            codiceStanza
          )}&nome=${encodeURIComponent(
            nomeGiocatore
          )}`
        );

        return;
      } catch (error) {
        console.error(error);

        alert(
          "Si è verificato un errore. Riprova."
        );

        setSalvando(false);
        return;
      }
    }

    // ==================================================
    // NUOVA PARTITA
    // ==================================================

    router.push(
      `/configura-partita?pokemon=${encodeURIComponent(
        selezionato.name
      )}&master=${encodeURIComponent(
        masterMode
      )}`
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8 sm:px-6 sm:py-10">
      <div className="max-w-6xl mx-auto">

        {/* ============================
            HEADER
        ============================ */}

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <span className="text-3xl">
              🎯
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            {sceltaDaPartitaEsistente
              ? "Scegli il Pokémon segreto"
              : "Scegli il Pokémon"}
          </h1>

          <p className="text-zinc-400 max-w-xl mx-auto">
            {sceltaDaPartitaEsistente
              ? "Sei il Master! Scegli il Pokémon che gli altri giocatori dovranno indovinare."
              : "Scegli un Pokémon dal Pokédex."}
          </p>
        </div>

        {/* ============================
            RICERCA + CASUALE
        ============================ */}

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">

            <div className="relative flex-1">
              <input
                type="text"
                value={ricerca}
                onChange={(e) =>
                  setRicerca(e.target.value)
                }
                placeholder="🔎 Cerca Pokémon..."
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/80 px-5 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <button
              onClick={pokemonCasuale}
              disabled={
                caricando ||
                pokemon.length === 0
              }
              className="shrink-0 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-4 font-bold text-purple-300 transition-all hover:border-purple-500/50 hover:bg-purple-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              🎲 Pokémon casuale
            </button>

          </div>

          {!caricando && (
            <p className="mt-2 text-xs text-zinc-600">
              {pokemonFiltrati.length} Pokémon trovati
            </p>
          )}
        </div>

        {/* ============================
            ERRORE
        ============================ */}

        {errore && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-300">
            {errore}
          </div>
        )}

        {/* ============================
            LOADING
        ============================ */}

        {caricando ? (
          <div className="py-20 text-center">
            <div className="mx-auto w-10 h-10 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />

            <p className="mt-5 text-zinc-400">
              Caricamento Pokédex...
            </p>
          </div>
        ) : (
          <>
            {/* ============================
                GRID
            ============================ */}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {pokemonFiltrati.map((p) => {
                const attivo =
                  selezionato?.id === p.id;

                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelezionato(p)
                    }
                    className={`rounded-3xl border p-3 sm:p-4 text-center transition-all duration-200 ${
                      attivo
                        ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.02]"
                        : "border-zinc-800 bg-zinc-900/80 hover:border-blue-500/40 hover:bg-zinc-800/80 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="aspect-square flex items-center justify-center">
                      <img
                        src={immaginePokemon(p.id)}
                        alt={p.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>

                    <p className="mt-2 text-xs text-zinc-600 font-mono">
                      #{String(p.id).padStart(4, "0")}
                    </p>

                    <p className="mt-1 font-bold capitalize truncate">
                      {p.name}
                    </p>
                  </button>
                );
              })}
            </div>

            {pokemonFiltrati.length === 0 && (
              <div className="py-20 text-center">
                <div className="text-5xl mb-4">
                  🔎
                </div>

                <p className="font-semibold text-zinc-300">
                  Nessun Pokémon trovato
                </p>

                <p className="text-sm text-zinc-500 mt-1">
                  Prova con un altro nome.
                </p>
              </div>
            )}
          </>
        )}

        {/* ============================
            SELEZIONE
        ============================ */}

        {selezionato && (
          <div className="sticky bottom-4 mt-6 rounded-3xl border border-blue-500/30 bg-zinc-900/95 backdrop-blur-xl p-4 sm:p-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-center gap-4">

              <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
                <div className="w-16 h-16 shrink-0 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <img
                    src={immaginePokemon(
                      selezionato.id
                    )}
                    alt={selezionato.name}
                    className="w-14 h-14 object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    Pokémon selezionato
                  </p>

                  <p className="text-xl font-black capitalize truncate">
                    {selezionato.name}
                  </p>
                </div>
              </div>

              <button
                onClick={confermaPokemon}
                disabled={salvando}
                className="w-full sm:w-auto rounded-2xl bg-blue-600 px-7 py-4 font-black transition-all hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando
                  ? "⏳ Salvataggio..."
                  : sceltaDaPartitaEsistente
                  ? "🚀 Avvia partita"
                  : "✅ Conferma Pokémon"}
              </button>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}

export default function ScegliPokemon() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-6">
              <span className="text-4xl animate-pulse">
                🎯
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold">
              Caricamento...
            </h1>

            <div className="mt-6 flex justify-center">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          </div>
        </main>
      }
    >
      <ScegliPokemonContent />
    </Suspense>
  );
}