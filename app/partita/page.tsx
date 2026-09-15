"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Player = {
  id: string;
  name: string;
  is_master: boolean;
};

type Question = {
  id: string;
  question: string;
  answer: boolean | null;
  player_id: string;
  created_at: string;
};

type PokemonData = {
  name: string;
  sprites?: {
    front_default: string | null;
    other?: {
      ["official-artwork"]?: {
        front_default: string | null;
      };
    };
  };
};

export default function Partita() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const codiceStanza = searchParams.get("codice") ?? "";
  const nome = searchParams.get("nome") ?? "";

  const [isMaster, setIsMaster] = useState(false);
  const [masterPlayerId, setMasterPlayerId] =
    useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [pokemon, setPokemon] = useState("");
  const [domanda, setDomanda] = useState("");
  const [tentativo, setTentativo] = useState("");
  const [erroreTentativo, setErroreTentativo] = useState("");
  const [domande, setDomande] = useState<Question[]>([]);
  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [pokemonData, setPokemonData] =
    useState<PokemonData | null>(null);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] =
    useState<string | null>(null);

  const richiestaCorrente = useRef(0);

  async function caricaPartita() {
    if (!codiceStanza) return;

    const numeroRichiesta =
      ++richiestaCorrente.current;

    const { data: room, error: roomError } =
      await supabase
        .from("rooms")
        .select(
          "id, pokemon, master_player_id, current_turn_player_id, winner_player_id, finished_at"
        )
        .eq("code", codiceStanza.toUpperCase())
        .single();

    if (
      numeroRichiesta !== richiestaCorrente.current
    ) {
      return;
    }

    if (roomError || !room) {
      console.error("Errore stanza:", roomError);
      return;
    }

    if (room.winner_player_id) {
      router.push(
        `/risultato?codice=${encodeURIComponent(
          codiceStanza
        )}&nome=${encodeURIComponent(nome)}`
      );
      return;
    }

    setRoomId(room.id);
    setPokemon(room.pokemon);
    setMasterPlayerId(room.master_player_id);
    setCurrentTurnPlayerId(
      room.current_turn_player_id
    );

    const {
      data: players,
      error: playersError,
    } = await supabase
      .from("players")
      .select("id, name, is_master")
      .eq("room_id", room.id);

    if (
      numeroRichiesta !== richiestaCorrente.current
    ) {
      return;
    }

    if (playersError) {
      console.error(
        "Errore giocatori:",
        playersError
      );
      return;
    }

    const listaGiocatori = players ?? [];

    setGiocatori(listaGiocatori);

    /*
     * Il ruolo viene deciso ESCLUSIVAMENTE da:
     *
     * rooms.master_player_id
     *
     * players.is_master NON viene usato per decidere
     * chi è il Master.
     */
    const mioGiocatore = listaGiocatori.find(
      (player) => player.name === nome
    );

    const sonoMaster =
      !!mioGiocatore &&
      !!room.master_player_id &&
      mioGiocatore.id === room.master_player_id;

    setIsMaster(sonoMaster);

    const {
      data: questions,
      error: questionsError,
    } = await supabase
      .from("questions")
      .select(
        "id, question, answer, player_id, created_at"
      )
      .eq("room_id", room.id)
      .order("created_at", {
        ascending: true,
      });

    if (
      numeroRichiesta !== richiestaCorrente.current
    ) {
      return;
    }

    if (questionsError) {
      console.error(
        "Errore domande:",
        questionsError
      );
      return;
    }

    setDomande(questions ?? []);

    if (room.pokemon) {
      try {
        const response = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${room.pokemon.toLowerCase()}`
        );

        if (
          numeroRichiesta !==
          richiestaCorrente.current
        ) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setPokemonData(data);
        } else {
          setPokemonData(null);
        }
      } catch (error) {
        console.error(
          "Errore caricamento Pokémon:",
          error
        );
        setPokemonData(null);
      }
    } else {
      setPokemonData(null);
    }
  }

  useEffect(() => {
    caricaPartita();
  }, [codiceStanza, nome]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`partita-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          caricaPartita();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          caricaPartita();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function inviaDomanda(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!domanda.trim()) return;

    const giocatore = giocatori.find(
      (player) => player.name === nome
    );

    if (!giocatore) {
      alert("Giocatore non trovato.");
      return;
    }

    if (isMaster) {
      return;
    }

    if (currentTurnPlayerId !== giocatore.id) {
      alert("Non è il tuo turno.");
      return;
    }

    const { data: room } = await supabase
      .from("rooms")
      .select(
        "id, current_turn_player_id, winner_player_id, master_player_id"
      )
      .eq("code", codiceStanza.toUpperCase())
      .single();

    if (!room) {
      alert("Stanza non trovata.");
      return;
    }

    if (room.winner_player_id) {
      await caricaPartita();
      return;
    }

    if (room.master_player_id === giocatore.id) {
      return;
    }

    if (
      room.current_turn_player_id !==
      giocatore.id
    ) {
      alert("Non è più il tuo turno.");
      await caricaPartita();
      return;
    }

    const { error } = await supabase
      .from("questions")
      .insert({
        room_id: room.id,
        player_id: giocatore.id,
        question: domanda.trim(),
      });

    if (error) {
      console.error(error);
      alert("Errore nell'invio della domanda.");
      return;
    }

    setDomanda("");
    await caricaPartita();
  }

  async function rispondiDomanda(
    questionId: string,
    risposta: boolean
  ) {
    if (!isMaster) return;

    const { data: room, error: roomError } =
      await supabase
        .from("rooms")
        .select(
          "id, master_player_id, current_turn_player_id, winner_player_id"
        )
        .eq("code", codiceStanza.toUpperCase())
        .single();

    if (roomError || !room) {
      console.error(
        "Errore verifica stanza:",
        roomError
      );
      return;
    }

    const mioGiocatore = giocatori.find(
      (player) => player.name === nome
    );

    if (!mioGiocatore) {
      return;
    }

    if (
      room.master_player_id !== mioGiocatore.id
    ) {
      setIsMaster(false);
      setMasterPlayerId(room.master_player_id);
      await caricaPartita();
      return;
    }

    if (room.winner_player_id) {
      await caricaPartita();
      return;
    }

    const {
      data: question,
      error: questionError,
    } = await supabase
      .from("questions")
      .select("player_id, answer")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      console.error(questionError);
      return;
    }

    if (question.answer !== null) {
      return;
    }

    const { error: answerError } =
      await supabase
        .from("questions")
        .update({
          answer: risposta,
        })
        .eq("id", questionId);

    if (answerError) {
      console.error(answerError);
      alert(
        "Errore nel salvataggio della risposta."
      );
      return;
    }

    const giocatoriNormali =
      giocatori.filter(
        (player) =>
          player.id !== room.master_player_id
      );

    if (giocatoriNormali.length === 0) {
      await caricaPartita();
      return;
    }

    const indiceAttuale =
      giocatoriNormali.findIndex(
        (player) =>
          player.id === question.player_id
      );

    let prossimoIndice = indiceAttuale + 1;

    if (
      prossimoIndice >=
        giocatoriNormali.length ||
      indiceAttuale === -1
    ) {
      prossimoIndice = 0;
    }

    const prossimoGiocatore =
      giocatoriNormali[prossimoIndice];

    if (!prossimoGiocatore) {
      await caricaPartita();
      return;
    }

    const { error: turnError } =
      await supabase
        .from("rooms")
        .update({
          current_turn_player_id:
            prossimoGiocatore.id,
        })
        .eq("id", room.id)
        .eq(
          "master_player_id",
          room.master_player_id
        );

    if (turnError) {
      console.error(
        "Errore cambio turno:",
        turnError
      );
      alert("Errore nel cambio turno.");
      return;
    }

    await caricaPartita();
  }

  async function indovinaPokemon(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!tentativo.trim()) return;

    setErroreTentativo("");

    const giocatore = giocatori.find(
      (player) => player.name === nome
    );

    if (!giocatore) {
      setErroreTentativo(
        "Giocatore non trovato."
      );
      return;
    }

    if (isMaster) {
      return;
    }

    const {
      data: room,
      error: roomError,
    } = await supabase
      .from("rooms")
      .select(
        "id, pokemon, winner_player_id, master_player_id"
      )
      .eq("code", codiceStanza.toUpperCase())
      .single();

    if (roomError || !room) {
      setErroreTentativo(
        "Stanza non trovata."
      );
      return;
    }

    if (room.master_player_id === giocatore.id) {
      return;
    }

    if (room.winner_player_id) {
      await caricaPartita();
      return;
    }

    const risposta =
      tentativo.trim().toLowerCase();
    const soluzione =
      room.pokemon.trim().toLowerCase();

    if (risposta !== soluzione) {
      setErroreTentativo(
        "❌ Pokémon sbagliato! Puoi continuare a giocare."
      );
      setTentativo("");
      return;
    }

    const { error: updateError } =
      await supabase
        .from("rooms")
        .update({
          winner_player_id: giocatore.id,
          finished_at:
            new Date().toISOString(),
        })
        .eq("id", room.id)
        .is("winner_player_id", null);

    if (updateError) {
      console.error(updateError);
      setErroreTentativo(
        "Errore nel salvataggio della vittoria."
      );
      return;
    }

    setTentativo("");

    router.push(
      `/risultato?codice=${encodeURIComponent(
        codiceStanza
      )}&nome=${encodeURIComponent(nome)}`
    );
  }

  const giocatoreDiTurno =
    giocatori.find(
      (player) =>
        player.id === currentTurnPlayerId
    );

  const mioGiocatore = giocatori.find(
    (player) => player.name === nome
  );

  const mioTurno =
    !isMaster &&
    mioGiocatore?.id === currentTurnPlayerId;

  const spritePokemon =
    pokemonData?.sprites?.other?.[
      "official-artwork"
    ]?.front_default ??
    pokemonData?.sprites?.front_default;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">

        {/* HEADER */}

        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
            <span className="text-3xl">
              🎮
            </span>
          </div>

          <h1 className="text-3xl font-bold sm:text-4xl">
            A che Pokémon sto pensando?
          </h1>

          <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-400">
              Stanza{" "}
              <span className="font-bold text-white">
                {codiceStanza}
              </span>
            </span>

            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-400">
              👤{" "}
              <span className="font-semibold text-white">
                {nome}
              </span>
            </span>

            {isMaster && (
              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 font-bold text-purple-400">
                👑 Master
              </span>
            )}
          </div>
        </div>

        {/* TURNO */}

        <div
          className={`mb-6 overflow-hidden rounded-3xl border shadow-xl ${
            mioTurno
              ? "border-green-500/40 bg-green-500/5"
              : "border-zinc-800 bg-zinc-900/80"
          }`}
        >
          <div className="p-6 text-center sm:p-7">
            {mioTurno ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10">
                  <span className="text-3xl">
                    🎯
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-black text-green-400">
                  È il tuo turno!
                </h2>

                <p className="mt-2 text-zinc-400">
                  Fai una domanda al Master.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-bold text-green-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  Tocca a te
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
                  <span className="text-2xl">
                    ⏳
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-bold">
                  Turno di{" "}
                  <span className="text-blue-400">
                    {giocatoreDiTurno?.name ??
                      "nessuno"}
                  </span>
                </h2>

                <p className="mt-2 text-zinc-500">
                  Attendi il tuo turno.
                </p>
              </>
            )}
          </div>
        </div>

        {/* MASTER: POKÉMON SEGRETO */}

        {isMaster && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-purple-500/30 bg-purple-500/5 shadow-xl">
            <div className="border-b border-purple-500/20 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10">
                  <span className="text-xl">
                    👑
                  </span>
                </div>

                <div>
                  <h2 className="font-bold">
                    Il tuo Pokémon segreto
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Solo tu puoi vedere la soluzione
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 text-center">
              {spritePokemon && (
                <div className="mx-auto flex h-64 w-64 items-center justify-center">
                  <img
                    src={spritePokemon}
                    alt={pokemon}
                    className="h-full w-full object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.55)]"
                  />
                </div>
              )}

              <p className="mt-2 text-3xl font-black capitalize text-purple-400">
                {pokemon}
              </p>

              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-400">
                🔒 Pokémon segreto
              </div>
            </div>
          </div>
        )}

        {/* GIOCATORE: POKÉMON MISTERIOSO */}

        {!isMaster && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/80 shadow-xl">
            <div className="p-8 text-center sm:p-10">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-950/70">
                <span className="text-5xl opacity-50">
                  ❓
                </span>
              </div>

              <h2 className="mt-5 text-xl font-bold">
                Pokémon misterioso
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Fai domande al Master per scoprire
                quale Pokémon si nasconde.
              </p>
            </div>
          </div>
        )}

        {/* INDOVINA POKÉMON */}

        {!isMaster && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-yellow-500/30 bg-yellow-500/5 shadow-xl">
            <div className="border-b border-yellow-500/20 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10">
                  <span className="text-xl">
                    🏆
                  </span>
                </div>

                <div>
                  <h2 className="font-bold">
                    Hai capito il Pokémon?
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Puoi tentare la soluzione in qualsiasi momento
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <form onSubmit={indovinaPokemon}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={tentativo}
                    onChange={(e) =>
                      setTentativo(e.target.value)
                    }
                    placeholder="Es. Pikachu"
                    className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white placeholder:text-zinc-600 outline-none transition-all focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                  />

                  <button
                    type="submit"
                    disabled={!tentativo.trim()}
                    className="rounded-2xl bg-yellow-600 px-6 py-4 font-bold text-white transition-all hover:bg-yellow-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    🏆 Indovina
                  </button>
                </div>
              </form>

              {erroreTentativo && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                  {erroreTentativo}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FAI UNA DOMANDA */}

        {!isMaster && (
          <div
            className={`mb-6 overflow-hidden rounded-3xl border shadow-xl ${
              mioTurno
                ? "border-blue-500/30 bg-blue-500/5"
                : "border-zinc-800 bg-zinc-900/80"
            }`}
          >
            <div className="border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                  <span className="text-xl">
                    💬
                  </span>
                </div>

                <div>
                  <h2 className="font-bold">
                    Fai una domanda
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Le domande devono avere risposta SÌ o NO
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <form onSubmit={inviaDomanda}>
                <input
                  type="text"
                  value={domanda}
                  onChange={(e) =>
                    setDomanda(e.target.value)
                  }
                  disabled={!mioTurno}
                  placeholder={
                    mioTurno
                      ? "Es. È di colore rosso?"
                      : "Attendi il tuo turno..."
                  }
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white placeholder:text-zinc-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                />

                <button
                  type="submit"
                  disabled={
                    !mioTurno ||
                    !domanda.trim()
                  }
                  className="mt-3 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold transition-all hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  📤 Invia domanda
                </button>
              </form>
            </div>
          </div>
        )}

        {/* STORICO DOMANDE */}

        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/80 shadow-xl">
          <div className="border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">
                  💬 Domande
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  Cronologia della partita
                </p>
              </div>

              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-400">
                {domande.length}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {domande.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mb-3 text-4xl">
                  💬
                </div>

                <p className="font-semibold text-zinc-300">
                  Nessuna domanda ancora
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  La prima domanda della partita apparirà qui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {domande.map((d, index) => {
                  const giocatore =
                    giocatori.find(
                      (player) =>
                        player.id === d.player_id
                    );

                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-xs font-black text-blue-400">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                            {giocatore?.name ??
                              "Giocatore"}
                          </p>

                          <p className="mt-1 text-base font-semibold text-white">
                            {d.question}
                          </p>
                        </div>
                      </div>

                      {isMaster &&
                        d.answer === null && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <button
                              onClick={() =>
                                rispondiDomanda(
                                  d.id,
                                  true
                                )
                              }
                              className="rounded-2xl bg-green-600 px-4 py-3 font-black transition-all hover:bg-green-500 active:scale-[0.98]"
                            >
                              ✅ SÌ
                            </button>

                            <button
                              onClick={() =>
                                rispondiDomanda(
                                  d.id,
                                  false
                                )
                              }
                              className="rounded-2xl bg-red-600 px-4 py-3 font-black transition-all hover:bg-red-500 active:scale-[0.98]"
                            >
                              ❌ NO
                            </button>
                          </div>
                        )}

                      {d.answer !== null && (
                        <div
                          className={`mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 ${
                            d.answer
                              ? "border-green-500/20 bg-green-500/10"
                              : "border-red-500/20 bg-red-500/10"
                          }`}
                        >
                          <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                            Risposta
                          </span>

                          <span
                            className={`font-black ${
                              d.answer
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {d.answer
                              ? "✅ SÌ"
                              : "❌ NO"}
                          </span>
                        </div>
                      )}

                      {d.answer === null &&
                        !isMaster && (
                          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
                            <span className="animate-pulse">
                              ⏳
                            </span>

                            <span>
                              In attesa della risposta del Master...
                            </span>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}