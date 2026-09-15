"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Player = {
  id: string;
  name: string;
  is_master: boolean;
};

type Room = {
  id: string;
  status: string;
  master_player_id: string | null;
  master_mode?: string;
};

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const codiceStanza = searchParams.get("codice") ?? "";
  const nome = searchParams.get("nome") ?? "";
  const pokemon = searchParams.get("pokemon") ?? "";

  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [masterPlayerId, setMasterPlayerId] =
    useState<string | null>(null);
  const [masterMode, setMasterMode] = useState("chosen");
  const [roomStatus, setRoomStatus] = useState("lobby");
  const [isMaster, setIsMaster] = useState(false);
  const [errore, setErrore] = useState("");
  const [copiato, setCopiato] = useState(false);
  const [avviando, setAvviando] = useState(false);

  async function caricaGiocatori() {
    if (!codiceStanza || !nome) {
      return;
    }

    // ============================
    // CARICHIAMO LA STANZA
    // ============================

    const { data: room, error: roomError } =
      await supabase
        .from("rooms")
        .select(
          "id, status, master_player_id, master_mode"
        )
        .eq(
          "code",
          codiceStanza.toUpperCase()
        )
        .maybeSingle();

    if (roomError || !room) {
      console.error(
        "Errore stanza:",
        roomError
      );
      setErrore(
        "Impossibile trovare la stanza."
      );
      return;
    }

    const roomCompleta = room as Room;

    setRoomId(roomCompleta.id);
    setMasterPlayerId(
      roomCompleta.master_player_id
    );
    setMasterMode(
      roomCompleta.master_mode ?? "chosen"
    );
    setRoomStatus(roomCompleta.status);

    // ============================
    // CARICHIAMO I GIOCATORI
    // ============================

    const {
      data: players,
      error: playersError,
    } = await supabase
      .from("players")
      .select(
        "id, name, is_master"
      )
      .eq(
        "room_id",
        roomCompleta.id
      )
      .order("id");

    if (playersError) {
      console.error(
        "Errore giocatori:",
        playersError
      );
      setErrore(
        playersError.message
      );
      return;
    }

    const listaGiocatori =
      players ?? [];

    setGiocatori(
      listaGiocatori
    );

    // ============================
    // GIOCATORE ATTUALE
    // ============================

    const giocatoreAttuale =
      listaGiocatori.find(
        (player) =>
          player.name === nome
      );

    // ==========================================
    // IMPORTANTE:
    // IL MASTER È DETERMINATO ESCLUSIVAMENTE
    // DA rooms.master_player_id
    // ==========================================

    const masterAttuale =
      !!giocatoreAttuale &&
      giocatoreAttuale.id ===
        roomCompleta.master_player_id;

    setIsMaster(
      masterAttuale
    );

    // ============================
    // MASTER CASUALE:
    // IL NUOVO MASTER DEVE
    // SCEGLIERE IL POKÉMON
    // ============================

    if (
      roomCompleta.status ===
        "choosing" &&
      roomCompleta.master_mode ===
        "random"
    ) {
      if (masterAttuale) {
        router.push(
          `/scegli-pokemon?codice=${encodeURIComponent(
            codiceStanza
          )}&nome=${encodeURIComponent(
            nome
          )}&master=random`
        );
      }

      return;
    }

    // ============================
    // PARTITA GIÀ IN CORSO
    // ============================

    if (
      roomCompleta.status ===
      "playing"
    ) {
      router.push(
        `/partita?codice=${encodeURIComponent(
          codiceStanza
        )}&nome=${encodeURIComponent(
          nome
        )}`
      );
    }
  }

  // ==========================================
  // CARICAMENTO INIZIALE
  // ==========================================

  useEffect(() => {
    caricaGiocatori();
  }, [
    codiceStanza,
    nome,
  ]);

  // ==========================================
  // REALTIME
  // ==========================================

  useEffect(() => {
    if (!roomId) {
      return;
    }

    console.log(
      "Attivo realtime lobby:",
      roomId
    );

    const channel = supabase
      .channel(
        `lobby-${roomId}`
      )

      // NUOVO GIOCATORE
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          caricaGiocatori();
        }
      )

      // GIOCATORE AGGIORNATO
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          caricaGiocatori();
        }
      )

      // GIOCATORE RIMOSSO
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "players",
        },
        () => {
          caricaGiocatori();
        }
      )

      // STANZA AGGIORNATA
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
          console.log(
            "Stanza aggiornata:",
            payload
          );

          const nuovaRoom =
            payload.new as Room;

          // ==========================================
          // AGGIORNIAMO SUBITO LO STATO LOCALE
          // ==========================================

          setMasterPlayerId(
            nuovaRoom.master_player_id
          );

          setMasterMode(
            nuovaRoom.master_mode ??
              "chosen"
          );

          setRoomStatus(
            nuovaRoom.status
          );

          // ==========================================
          // RECUPERIAMO IL GIOCATORE ATTUALE
          // ==========================================

          const {
            data: players,
            error,
          } = await supabase
            .from("players")
            .select(
              "id, name, is_master"
            )
            .eq(
              "room_id",
              roomId
            );

          if (
            error ||
            !players
          ) {
            console.error(error);
            return;
          }

          setGiocatori(players);

          const giocatoreAttuale =
            players.find(
              (player) =>
                player.name ===
                nome
            );

          if (
            !giocatoreAttuale
          ) {
            return;
          }

          // ==========================================
          // FONTE DI VERITÀ:
          // rooms.master_player_id
          // ==========================================

          const nuovoIsMaster =
            giocatoreAttuale.id ===
            nuovaRoom.master_player_id;

          setIsMaster(
            nuovoIsMaster
          );

          // ==========================================
          // MASTER CASUALE
          // ==========================================

          if (
            nuovaRoom.status ===
              "choosing" &&
            nuovaRoom.master_mode ===
              "random" &&
            nuovaRoom.master_player_id
          ) {
            if (
              nuovoIsMaster
            ) {
              router.push(
                `/scegli-pokemon?codice=${encodeURIComponent(
                  codiceStanza
                )}&nome=${encodeURIComponent(
                  nome
                )}&master=random`
              );
            }

            return;
          }

          // ==========================================
          // PARTITA
          // ==========================================

          if (
            nuovaRoom.status ===
            "playing"
          ) {
            router.push(
              `/partita?codice=${encodeURIComponent(
                codiceStanza
              )}&nome=${encodeURIComponent(
                nome
              )}`
            );

            return;
          }
        }
      )

      .subscribe(
        (status) => {
          console.log(
            "Stato realtime lobby:",
            status
          );
        }
      );

    return () => {
      console.log(
        "Disattivo realtime lobby:",
        roomId
      );

      supabase.removeChannel(
        channel
      );
    };
  }, [
    roomId,
    codiceStanza,
    nome,
  ]);

  // ==========================================
  // AVVIO PARTITA
  // ==========================================

  async function iniziaPartita() {
    if (
      !isMaster ||
      !roomId ||
      !masterPlayerId
    ) {
      return;
    }

    setAvviando(true);

    // ============================
    // RECUPERIAMO I GIOCATORI
    // ============================

    const {
      data: players,
      error: playersError,
    } = await supabase
      .from("players")
      .select(
        "id, name"
      )
      .eq(
        "room_id",
        roomId
      );

    if (
      playersError ||
      !players
    ) {
      console.error(
        "Errore recupero giocatori:",
        playersError
      );

      alert(
        "Impossibile recuperare i giocatori."
      );

      setAvviando(false);
      return;
    }

    // ============================
    // CONTROLLO NUMERO GIOCATORI
    // ============================

    if (
      players.length < 2
    ) {
      alert(
        "Servono almeno 2 giocatori per iniziare la partita."
      );

      setAvviando(false);
      return;
    }

    // ============================
    // VERIFICA MASTER ATTUALE
    // ============================

    const {
      data: roomAttuale,
      error: roomError,
    } = await supabase
      .from("rooms")
      .select(
        "master_player_id, master_mode, pokemon, status"
      )
      .eq(
        "id",
        roomId
      )
      .maybeSingle();

    if (
      roomError ||
      !roomAttuale ||
      roomAttuale.master_player_id !==
        masterPlayerId
    ) {
      alert(
        "Il Master è cambiato. Aggiorna la lobby prima di iniziare."
      );

      setAvviando(false);
      await caricaGiocatori();
      return;
    }

    // ==========================================
    // MASTER CASUALE
    // ==========================================

    if (
      roomAttuale.master_mode ===
      "random"
    ) {
      // ==========================================
      // SICUREZZA:
      // L'estrazione può avvenire solo mentre
      // siamo realmente in lobby.
      // ==========================================

      if (
        roomAttuale.status !==
        "lobby"
      ) {
        setAvviando(false);
        await caricaGiocatori();
        return;
      }

      // ==========================================
      // ESTRAZIONE CASUALE
      // ==========================================

      const indiceCasuale =
        Math.floor(
          Math.random() *
            players.length
        );

      const masterCasuale =
        players[
          indiceCasuale
        ];

      // ==========================================
      // CAMBIAMO MASTER
      // ==========================================

      const {
        data: roomAggiornata,
        error: randomError,
      } = await supabase
        .from("rooms")
        .update({
          master_player_id:
            masterCasuale.id,
          master_name:
            masterCasuale.name,
          pokemon: "",
          status:
            "choosing",
          current_turn_player_id:
            null,
          winner_player_id:
            null,
          finished_at:
            null,
        })
        .eq(
          "id",
          roomId
        )
        .eq(
          "master_player_id",
          masterPlayerId
        )
        .eq(
          "status",
          "lobby"
        )
        .select(
          "id, master_player_id, status"
        )
        .maybeSingle();

      if (
        randomError ||
        !roomAggiornata
      ) {
        console.error(
          "Errore estrazione Master:",
          randomError
        );

        alert(
          "Errore durante l'estrazione del Master."
        );

        setAvviando(false);
        return;
      }

      // ==========================================
      // SINCRONIZZIAMO is_master
      //
      // È SOLO UN DATO SECONDARIO.
      // ==========================================

      const {
        error:
          resetMasterError,
      } = await supabase
        .from("players")
        .update({
          is_master:
            false,
        })
        .eq(
          "room_id",
          roomId
        );

      if (
        resetMasterError
      ) {
        console.error(
          "Errore reset Master:",
          resetMasterError
        );
      }

      const {
        error:
          masterSyncError,
      } = await supabase
        .from("players")
        .update({
          is_master:
            true,
        })
        .eq(
          "id",
          masterCasuale.id
        )
        .eq(
          "room_id",
          roomId
        );

      if (
        masterSyncError
      ) {
        console.error(
          "Errore sincronizzazione Master:",
          masterSyncError
        );
      }

      setAvviando(false);

      // ==========================================
      // SOLO IL MASTER ESTRATTO VA A
      // SCEGLI-POKÉMON
      // ==========================================

      if (
        masterCasuale.id ===
        players.find(
          (player) =>
            player.name ===
            nome
        )?.id
      ) {
        router.push(
          `/scegli-pokemon?codice=${encodeURIComponent(
            codiceStanza
          )}&nome=${encodeURIComponent(
            nome
          )}&master=random`
        );
      }

      return;
    }

    // ==========================================
    // MASTER SCELTO
    // ==========================================

    const giocatoriDisponibili =
      players.filter(
        (giocatore) =>
          giocatore.id !==
          masterPlayerId
      );

    if (
      giocatoriDisponibili.length ===
      0
    ) {
      alert(
        "Il Master deve avere almeno un altro giocatore."
      );

      setAvviando(false);
      return;
    }

    const primoGiocatore =
      giocatoriDisponibili[0];

    // ============================
    // AGGIORNIAMO LA STANZA
    // ============================

    const {
      data: roomAggiornata,
      error: updateError,
    } = await supabase
      .from("rooms")
      .update({
        master_player_id:
          masterPlayerId,
        status:
          "playing",
        current_turn_player_id:
          primoGiocatore.id,
      })
      .eq(
        "id",
        roomId
      )
      .eq(
        "master_player_id",
        masterPlayerId
      )
      .eq(
        "status",
        "lobby"
      )
      .select(
        "id, master_player_id"
      )
      .maybeSingle();

    if (
      updateError ||
      !roomAggiornata
    ) {
      console.error(
        "Errore avvio partita:",
        updateError
      );

      alert(
        "Errore nell'avvio della partita."
      );

      setAvviando(false);
      return;
    }

    // ============================
    // SINCRONIZZIAMO is_master
    // ============================

    await supabase
      .from("players")
      .update({
        is_master:
          false,
      })
      .eq(
        "room_id",
        roomId
      );

    const {
      error:
        masterSyncError,
    } = await supabase
      .from("players")
      .update({
        is_master:
          true,
      })
      .eq(
        "id",
        masterPlayerId
      )
      .eq(
        "room_id",
        roomId
      );

    if (
      masterSyncError
    ) {
      console.error(
        "Errore sincronizzazione Master:",
        masterSyncError
      );
    }

    // ============================
    // ACCESSO ALLA PARTITA
    // ============================

    router.push(
      `/partita?codice=${encodeURIComponent(
        codiceStanza
      )}&nome=${encodeURIComponent(
        nome
      )}`
    );
  }

  // ==========================================
  // COPIA CODICE
  // ==========================================

  async function copiaCodice() {
    await navigator.clipboard.writeText(
      codiceStanza
    );

    setCopiato(true);

    setTimeout(() => {
      setCopiato(false);
    }, 2000);
  }

  // ==========================================
  // UI
  // ==========================================

  const faseSceltaPokemon =
    roomStatus ===
      "choosing" &&
    masterMode ===
      "random";

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-4 py-8 sm:px-6 sm:py-10">
      <div className="max-w-3xl mx-auto">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <span className="text-3xl">
              🎮
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Lobby
          </h1>

          <p className="text-zinc-400 max-w-xl mx-auto">
            {faseSceltaPokemon
              ? "Il Master sta scegliendo il Pokémon segreto..."
              : "In attesa che tutti i giocatori si uniscano"}
          </p>
        </div>

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-zinc-800 text-center">
            <p className="text-sm font-semibold text-zinc-300">
              Codice della stanza
            </p>

            <p className="text-xs text-zinc-500 mt-1">
              Condividilo con gli altri giocatori
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-5 text-center">
                <span className="text-3xl sm:text-4xl font-black tracking-[0.3em] pl-[0.3em]">
                  {codiceStanza}
                </span>
              </div>

              <button
                onClick={copiaCodice}
                className="w-full sm:w-auto rounded-2xl border border-blue-500/30 bg-blue-600 px-6 py-5 font-bold transition-all hover:bg-blue-500 active:scale-[0.98]"
              >
                {copiato
                  ? "✅ Copiato!"
                  : "📋 Copia"}
              </button>
            </div>

            {errore && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-300">
                {errore}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">
          <div className="p-5 flex items-center gap-4">

            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                masterMode === "random"
                  ? "bg-blue-500/10 border-blue-500/20"
                  : "bg-purple-500/10 border-purple-500/20"
              }`}
            >
              <span className="text-2xl">
                {masterMode ===
                "random"
                  ? "🎲"
                  : "👑"}
              </span>
            </div>

            <div>
              <p className="font-bold">
                {masterMode ===
                "random"
                  ? "Master casuale"
                  : "Master scelto"}
              </p>

              <p className="text-sm text-zinc-500 mt-1">
                {masterMode ===
                "random"
                  ? faseSceltaPokemon
                    ? "Master estratto. Scelta del Pokémon in corso."
                    : "Il Master verrà estratto all'avvio."
                  : "Il Master sei tu."}
              </p>
            </div>

          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                👥 Giocatori
              </h2>

              <p className="text-xs text-zinc-500 mt-1">
                {giocatori.length}{" "}
                {giocatori.length ===
                1
                  ? "giocatore nella stanza"
                  : "giocatori nella stanza"}
              </p>
            </div>

            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-lg">
                {giocatori.length}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {giocatori.length >
            0 ? (
              <div className="space-y-3">
                {giocatori.map(
                  (giocatore) => {
                    // ==========================================
                    // IMPORTANTE:
                    // NON USIAMO giocatore.is_master
                    // ==========================================

                    const giocatoreIsMaster =
                      giocatore.id ===
                      masterPlayerId;

                    const giocatoreAttuale =
                      giocatore.name ===
                      nome;

                    return (
                      <div
                        key={
                          giocatore.id
                        }
                        className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
                          giocatoreIsMaster
                            ? "border-purple-500/30 bg-purple-500/10"
                            : "border-zinc-800 bg-zinc-950/60"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">

                          <div
                            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-lg ${
                              giocatoreIsMaster
                                ? "bg-purple-500/15 border border-purple-500/20"
                                : "bg-blue-500/10 border border-blue-500/20"
                            }`}
                          >
                            {giocatoreIsMaster
                              ? "👑"
                              : "🎮"}
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {
                                giocatore.name
                              }
                            </p>

                            {giocatoreAttuale && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Sei tu
                              </p>
                            )}
                          </div>

                        </div>

                        {giocatoreIsMaster ? (
                          <span className="shrink-0 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-400">
                            👑 Master
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400">
                            🎮 Giocatore
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="text-4xl mb-3">
                  ⏳
                </div>

                <p className="font-semibold text-zinc-300">
                  In attesa dei giocatori...
                </p>

                <p className="text-sm text-zinc-500 mt-1">
                  Condividi il codice della stanza per farli entrare.
                </p>
              </div>
            )}
          </div>
        </div>

        {faseSceltaPokemon &&
          !isMaster && (
            <div className="mb-6 rounded-3xl border border-blue-500/30 bg-blue-500/5 overflow-hidden shadow-xl">
              <div className="p-6 sm:p-8 text-center">

                <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-3xl animate-pulse">
                    🎲
                  </span>
                </div>

                <h2 className="mt-5 text-xl font-bold">
                  Master estratto!
                </h2>

                <p className="mt-2 text-sm sm:text-base text-zinc-400 max-w-md mx-auto">
                  Il Master sta scegliendo il Pokémon segreto.
                  La partita inizierà automaticamente quando avrà terminato.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  In attesa del Master
                </div>

              </div>
            </div>
          )}

        {isMaster &&
          roomStatus ===
            "lobby" && (
            <div className="mb-6 rounded-3xl border border-purple-500/30 bg-purple-500/5 overflow-hidden shadow-xl">

              <div className="px-5 py-4 border-b border-purple-500/20">
                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <span className="text-xl">
                      {masterMode ===
                      "random"
                        ? "🎲"
                        : "👑"}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-bold">
                      {masterMode ===
                      "random"
                        ? "Organizzatore"
                        : "Sei il Master"}
                    </h2>

                    <p className="text-xs text-zinc-500 mt-1">
                      {masterMode ===
                      "random"
                        ? "Potrai avviare l'estrazione quando tutti saranno pronti."
                        : "Sei tu a scegliere il Pokémon segreto."}
                    </p>
                  </div>

                </div>
              </div>

              <div className="p-5 sm:p-6 text-center">

                {masterMode ===
                  "chosen" && (
                  <>
                    <p className="text-sm text-zinc-500">
                      Pokémon scelto
                    </p>

                    <p className="mt-2 text-2xl sm:text-3xl font-black capitalize text-purple-400">
                      {pokemon ||
                        "—"}
                    </p>
                  </>
                )}

                {masterMode ===
                  "random" && (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-4 text-left">
                    <p className="text-sm text-blue-300">
                      🎲 Il Master verrà estratto casualmente tra{" "}
                      <span className="font-bold">
                        {
                          giocatori.length
                        }
                      </span>{" "}
                      giocatori.
                    </p>

                    <p className="text-xs text-zinc-500 mt-2">
                      Dopo l'estrazione, il giocatore selezionato
                      sceglierà il Pokémon segreto.
                    </p>
                  </div>
                )}

                <button
                  onClick={
                    iniziaPartita
                  }
                  disabled={
                    avviando ||
                    giocatori.length <
                      2
                  }
                  className="mt-6 w-full rounded-2xl bg-green-600 px-6 py-4 text-lg font-black transition-all hover:bg-green-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {avviando
                    ? "⏳ Avvio..."
                    : masterMode ===
                      "random"
                    ? "🎲 Estrai il Master"
                    : "🚀 Inizia partita"}
                </button>

              </div>
            </div>
          )}

        {!isMaster &&
          roomStatus ===
            "lobby" && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-xl">
              <div className="p-6 sm:p-8 text-center">

                <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <span className="text-3xl animate-pulse">
                    ⏳
                  </span>
                </div>

                <h2 className="mt-5 text-xl font-bold">
                  {masterMode ===
                  "random"
                    ? "In attesa dell'estrazione"
                    : "In attesa del Master"}
                </h2>

                <p className="mt-2 text-sm sm:text-base text-zinc-400 max-w-md mx-auto">
                  {masterMode ===
                  "random"
                    ? "L'organizzatore estrarrà casualmente il Master quando tutti saranno pronti."
                    : "La partita inizierà quando il Master sarà pronto."}
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Connessione attiva
                </div>

              </div>
            </div>
          )}

      </div>
    </main>
  );
}

export default function Lobby() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <p className="text-zinc-400">
            Caricamento...
          </p>
        </main>
      }
    >
      <LobbyContent />
    </Suspense>
  );
}