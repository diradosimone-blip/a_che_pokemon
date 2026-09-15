"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Room = {
  id: string;
  pokemon: string;
  winner_player_id: string | null;
  finished_at: string | null;
  master_player_id: string | null;
  status: string;
};

type Player = {
  id: string;
  name: string;
};

type PokemonData = {
  sprites?: {
    front_default: string | null;
    other?: {
      ["official-artwork"]?: {
        front_default: string | null;
      };
    };
  };
};

function codiceStanzaSeguro(codice: string | null) {
  return codice ? codice.toUpperCase() : "";
}

export default function Risultato() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const codiceStanza = searchParams.get("codice");
  const nomeGiocatore = searchParams.get("nome");

  const [room, setRoom] = useState<Room | null>(null);
  const [nomeMaster, setNomeMaster] = useState("");
  const [nomeVincitore, setNomeVincitore] = useState("");
  const [isMaster, setIsMaster] = useState(false);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState("");
  const [rivincita, setRivincita] = useState(false);
  const [pokemonData, setPokemonData] =
    useState<PokemonData | null>(null);

  const codice = codiceStanzaSeguro(codiceStanza);

  useEffect(() => {
    async function caricaRisultato() {
      if (!codice || !nomeGiocatore) {
        setErrore("Informazioni della partita mancanti.");
        setCaricando(false);
        return;
      }

      const { data: roomData, error: roomError } =
        await supabase
          .from("rooms")
          .select(
            "id, pokemon, winner_player_id, finished_at, master_player_id, status"
          )
          .eq("code", codice)
          .single();

      if (roomError || !roomData) {
        console.error(roomError);
        setErrore("Stanza non trovata.");
        setCaricando(false);
        return;
      }

      setRoom(roomData);

      const { data: players, error: playersError } =
        await supabase
          .from("players")
          .select("id, name")
          .eq("room_id", roomData.id);

      if (playersError) {
        console.error(playersError);
      }

      if (!players) {
        setErrore("Impossibile recuperare i giocatori.");
        setCaricando(false);
        return;
      }

      const mioGiocatore = players.find(
        (player) => player.name === nomeGiocatore
      );

      if (!mioGiocatore) {
        setErrore("Giocatore non trovato nella stanza.");
        setCaricando(false);
        return;
      }

      // ==========================================
      // CONTROLLO STANZA GIÀ IN LOBBY
      // ==========================================

      if (
        roomData.status === "lobby" &&
        roomData.master_player_id
      ) {
        if (
          mioGiocatore.id === roomData.master_player_id
        ) {
          router.push(
            `/scegli-pokemon?codice=${encodeURIComponent(
              codice
            )}&nome=${encodeURIComponent(
              nomeGiocatore
            )}`
          );
        } else {
          router.push(
            `/lobby?codice=${encodeURIComponent(
              codice
            )}&nome=${encodeURIComponent(
              nomeGiocatore
            )}`
          );
        }

        return;
      }

      // ==========================================
      // MASTER CASUALE — FASE DI SCELTA
      // ==========================================

      if (
        roomData.status === "choosing" &&
        roomData.master_player_id
      ) {
        if (
          mioGiocatore.id === roomData.master_player_id
        ) {
          router.push(
            `/scegli-pokemon?codice=${encodeURIComponent(
              codice
            )}&nome=${encodeURIComponent(
              nomeGiocatore
            )}&master=random`
          );
        } else {
          router.push(
            `/lobby?codice=${encodeURIComponent(
              codice
            )}&nome=${encodeURIComponent(
              nomeGiocatore
            )}`
          );
        }

        return;
      }

      // ==========================================
      // DETERMINIAMO IL MASTER
      // ==========================================

      if (roomData.master_player_id) {
        const masterData = players.find(
          (player) =>
            player.id === roomData.master_player_id
        );

        if (masterData) {
          setNomeMaster(masterData.name);

          // IMPORTANTE:
          // rooms.master_player_id è l'unica fonte
          // autorevole per determinare il Master.
          setIsMaster(
            mioGiocatore.id === roomData.master_player_id
          );
        }
      } else {
        setIsMaster(false);
      }

      // ==========================================
      // RECUPERIAMO IL VINCITORE
      // ==========================================

      if (roomData.winner_player_id) {
        const winnerData = players.find(
          (player) =>
            player.id === roomData.winner_player_id
        );

        if (winnerData) {
          setNomeVincitore(winnerData.name);
        }
      }

      // ==========================================
      // CARICHIAMO L'IMMAGINE DEL POKÉMON
      // ==========================================

      if (roomData.pokemon) {
        try {
          const response = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${roomData.pokemon.toLowerCase()}`
          );

          if (response.ok) {
            const data = await response.json();
            setPokemonData(data);
          }
        } catch (error) {
          console.error(
            "Errore caricamento Pokémon:",
            error
          );
        }
      }

      setCaricando(false);
    }

    caricaRisultato();
  }, [codice, nomeGiocatore, router]);

  // ==========================================
  // REALTIME
  // ==========================================

  useEffect(() => {
    if (!room?.id || !codice || !nomeGiocatore) {
      return;
    }

    const channel = supabase
      .channel(`risultato-${codice}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        async (payload) => {
          const nuovaRoom = payload.new as Room;

          setRoom(nuovaRoom);

          const { data: giocatori, error } =
            await supabase
              .from("players")
              .select("id, name")
              .eq("room_id", nuovaRoom.id);

          if (error || !giocatori) {
            console.error(error);
            return;
          }

          const mioGiocatore = giocatori.find(
            (giocatore) =>
              giocatore.name === nomeGiocatore
          );

          if (!mioGiocatore) {
            return;
          }

          // ==========================================
          // LOBBY
          // ==========================================

          if (
            nuovaRoom.status === "lobby" &&
            nuovaRoom.master_player_id
          ) {
            if (
              mioGiocatore.id ===
              nuovaRoom.master_player_id
            ) {
              router.push(
                `/scegli-pokemon?codice=${encodeURIComponent(
                  codice
                )}&nome=${encodeURIComponent(
                  nomeGiocatore
                )}`
              );

              return;
            }

            router.push(
              `/lobby?codice=${encodeURIComponent(
                codice
              )}&nome=${encodeURIComponent(
                nomeGiocatore
              )}`
            );

            return;
          }

          // ==========================================
          // MASTER CASUALE — FASE DI SCELTA
          // ==========================================

          if (
            nuovaRoom.status === "choosing" &&
            nuovaRoom.master_player_id
          ) {
            if (
              mioGiocatore.id ===
              nuovaRoom.master_player_id
            ) {
              router.push(
                `/scegli-pokemon?codice=${encodeURIComponent(
                  codice
                )}&nome=${encodeURIComponent(
                  nomeGiocatore
                )}&master=random`
              );

              return;
            }

            router.push(
              `/lobby?codice=${encodeURIComponent(
                codice
              )}&nome=${encodeURIComponent(
                nomeGiocatore
              )}`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, codice, nomeGiocatore, router]);

  // ==========================================
  // RIVINCITA — STESSO MASTER
  // ==========================================

  async function rivincitaStessoMaster() {
    if (!room?.id || !room.master_player_id) {
      return;
    }

    setRivincita(true);

    const { data: roomAggiornata, error } =
      await supabase
        .from("rooms")
        .update({
          status: "lobby",
          pokemon: "",
          winner_player_id: null,
          finished_at: null,
          current_turn_player_id: null,
          master_player_id: room.master_player_id,
        })
        .eq("id", room.id)
        .eq(
          "master_player_id",
          room.master_player_id
        )
        .select("id, master_player_id")
        .maybeSingle();

    if (error || !roomAggiornata) {
      console.error(error);
      alert("Impossibile avviare la rivincita.");
      setRivincita(false);
      return;
    }

    router.push(
      `/scegli-pokemon?codice=${encodeURIComponent(
        codice
      )}&master=${encodeURIComponent(
        room.master_player_id
      )}&nome=${encodeURIComponent(
        nomeGiocatore || ""
      )}`
    );
  }

  // ==========================================
  // RIVINCITA — MASTER CASUALE
  // ==========================================

  async function rivincitaMasterCasuale() {
    if (!room?.id || !room.master_player_id) {
      return;
    }

    if (!isMaster) {
      return;
    }

    setRivincita(true);

    // ==========================================
    // VERIFICA MASTER ATTUALE
    // ==========================================

    const { data: roomAttuale, error: roomError } =
      await supabase
        .from("rooms")
        .select("master_player_id, status")
        .eq("id", room.id)
        .maybeSingle();

    if (
      roomError ||
      !roomAttuale ||
      roomAttuale.master_player_id !==
        room.master_player_id
    ) {
      console.error(roomError);
      alert(
        "Il Master della partita è cambiato. Ricarica la pagina."
      );
      setRivincita(false);
      return;
    }

    // ==========================================
    // RECUPERIAMO TUTTI I GIOCATORI
    // ==========================================

    const { data: players, error: playersError } =
      await supabase
        .from("players")
        .select("id, name")
        .eq("room_id", room.id);

    if (
      playersError ||
      !players ||
      players.length < 2
    ) {
      console.error(playersError);
      alert(
        "Servono almeno 2 giocatori per estrarre un nuovo Master."
      );
      setRivincita(false);
      return;
    }

    // ==========================================
    // ESTRAZIONE
    // ==========================================

    const indiceCasuale = Math.floor(
      Math.random() * players.length
    );

    const nuovoMaster = players[indiceCasuale];

    // ==========================================
    // CAMBIAMO MASTER IN MODO CONDIZIONATO
    //
    // Solo il Master attuale può effettuare
    // questa transizione.
    // ==========================================

    const { data: roomAggiornata, error: updateError } =
      await supabase
        .from("rooms")
        .update({
          master_player_id: nuovoMaster.id,
          master_name: nuovoMaster.name,
          status: "choosing",
          pokemon: "",
          current_turn_player_id: null,
          winner_player_id: null,
          finished_at: null,
        })
        .eq("id", room.id)
        .eq(
          "master_player_id",
          room.master_player_id
        )
        .select(
          "id, master_player_id, status"
        )
        .maybeSingle();

    if (
      updateError ||
      !roomAggiornata
    ) {
      console.error(updateError);

      alert(
        "Impossibile estrarre il nuovo Master."
      );

      setRivincita(false);
      return;
    }

    // ==========================================
    // is_master
    //
    // NON viene usato per decidere chi è Master.
    // Lo sincronizziamo soltanto come informazione
    // secondaria.
    // ==========================================

    const { error: resetMasterError } =
      await supabase
        .from("players")
        .update({
          is_master: false,
        })
        .eq("room_id", room.id);

    if (resetMasterError) {
      console.error(
        "Errore reset is_master:",
        resetMasterError
      );
    }

    const { error: setMasterError } =
      await supabase
        .from("players")
        .update({
          is_master: true,
        })
        .eq("id", nuovoMaster.id)
        .eq("room_id", room.id);

    if (setMasterError) {
      console.error(
        "Errore impostazione is_master:",
        setMasterError
      );
    }

    // ==========================================
    // ROUTING LOCALE
    //
    // Non aspettiamo il realtime per il giocatore
    // che ha effettuato l'estrazione.
    // ==========================================

    if (nuovoMaster.id ===
        players.find(
          (player) => player.name === nomeGiocatore
        )?.id) {
      router.push(
        `/scegli-pokemon?codice=${encodeURIComponent(
          codice
        )}&nome=${encodeURIComponent(
          nomeGiocatore || ""
        )}&master=random`
      );

      return;
    }

    router.push(
      `/lobby?codice=${encodeURIComponent(
        codice
      )}&nome=${encodeURIComponent(
        nomeGiocatore || ""
      )}`
    );
  }

  function cambiaMaster() {
    router.push(
      `/cambia-master?codice=${encodeURIComponent(
        codice
      )}&nome=${encodeURIComponent(
        nomeGiocatore || ""
      )}`
    );
  }

  function tornaHome() {
    router.push("/");
  }

  const spritePokemon =
    pokemonData?.sprites?.other?.["official-artwork"]
      ?.front_default ??
    pokemonData?.sprites?.front_default;

  if (caricando) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400">
          Caricamento risultato...
        </p>
      </main>
    );
  }

  if (errore || !room) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">
            {errore || "Risultato non disponibile."}
          </p>

          <button
            onClick={tornaHome}
            className="rounded-xl bg-zinc-800 px-5 py-3 hover:bg-zinc-700"
          >
            🏠 Torna alla Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-xl mx-auto text-center">

        <div className="text-6xl mb-5">🏆</div>

        <h1 className="text-4xl font-bold mb-3">
          Partita terminata!
        </h1>

        <p className="text-zinc-400 mb-8">
          Il Pokémon era...
        </p>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 mb-6">

          {spritePokemon ? (
            <img
              src={spritePokemon}
              alt={room.pokemon}
              className="mx-auto mb-4 h-64 w-64 object-contain"
            />
          ) : (
            <div className="text-6xl mb-4">
              🎯
            </div>
          )}

          <p className="text-3xl font-bold capitalize">
            {room.pokemon}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 mb-8">
          <p className="text-sm text-zinc-500 mb-2">
            Vincitore
          </p>

          <p className="text-2xl font-bold">
            🥇 {nomeVincitore || "Nessun vincitore"}
          </p>

          {nomeMaster && (
            <p className="text-sm text-zinc-500 mt-3">
              Master: {nomeMaster}
            </p>
          )}
        </div>

        {isMaster ? (
          <div className="space-y-3">

            <button
              onClick={rivincitaStessoMaster}
              disabled={rivincita}
              className="w-full rounded-xl bg-blue-600 px-5 py-4 font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              {rivincita
                ? "Avvio rivincita..."
                : "🔄 Rivincita — stesso Master"}
            </button>

            <button
              onClick={rivincitaMasterCasuale}
              disabled={rivincita}
              className="w-full rounded-xl bg-purple-600 px-5 py-4 font-bold hover:bg-purple-500 disabled:opacity-50"
            >
              {rivincita
                ? "Estrazione Master..."
                : "🎲 Rivincita — Master casuale"}
            </button>

            <button
              onClick={cambiaMaster}
              className="w-full rounded-xl bg-yellow-500 px-5 py-4 font-bold text-black hover:bg-yellow-400"
            >
              👑 Cambia Master
            </button>

            <button
              onClick={tornaHome}
              className="w-full rounded-xl bg-zinc-800 px-5 py-3 text-zinc-300 hover:bg-zinc-700"
            >
              🏠 Torna alla Home
            </button>

          </div>
        ) : (
          <div className="space-y-4">

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-zinc-400">
                Il Master può avviare una nuova partita.
              </p>

              <p className="text-zinc-500 text-sm mt-2">
                Aspetta che venga scelta la prossima partita.
              </p>
            </div>

            <button
              onClick={tornaHome}
              className="w-full rounded-xl bg-zinc-800 px-5 py-3 text-zinc-300 hover:bg-zinc-700"
            >
              🏠 Torna alla Home
            </button>

          </div>
        )}

      </div>
    </main>
  );
}