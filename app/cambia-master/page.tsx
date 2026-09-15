"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";

type Giocatore = {
  id: string;
  name: string;
  is_master: boolean;
};

function CambiaMasterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const codiceStanza = searchParams.get("codice");
  const nomeGiocatore = searchParams.get("nome");

  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [masterAttualeId, setMasterAttualeId] = useState<string | null>(null);
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [caricando, setCaricando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");

  // ==========================================
  // CARICAMENTO DATI
  // ==========================================

  useEffect(() => {
    async function caricaDati() {
      if (!codiceStanza || !nomeGiocatore) {
        setErrore("Informazioni della stanza mancanti.");
        setCaricando(false);
        return;
      }

      const codice = codiceStanza.toUpperCase();

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, master_player_id")
        .eq("code", codice)
        .single();

      if (roomError || !room) {
        console.error("Errore stanza:", roomError);
        setErrore("Stanza non trovata.");
        setCaricando(false);
        return;
      }

      setRoomId(room.id);
      setMasterAttualeId(room.master_player_id);

      const { data: listaGiocatori, error: playersError } =
        await supabase
          .from("players")
          .select("id, name, is_master")
          .eq("room_id", room.id);

      if (playersError || !listaGiocatori) {
        console.error("Errore giocatori:", playersError);
        setErrore("Impossibile recuperare i giocatori.");
        setCaricando(false);
        return;
      }

      setGiocatori(listaGiocatori);

      // Il Master viene determinato ESCLUSIVAMENTE
      // da rooms.master_player_id.
      const giocatoreAttuale = listaGiocatori.find(
        (giocatore) => giocatore.name === nomeGiocatore
      );

      if (
        !giocatoreAttuale ||
        giocatoreAttuale.id !== room.master_player_id
      ) {
        setErrore("Solo il Master attuale può cambiare Master.");
      }

      setCaricando(false);
    }

    caricaDati();
  }, [codiceStanza, nomeGiocatore]);

  // ==========================================
  // CONFERMA NUOVO MASTER
  // ==========================================

  async function confermaNuovoMaster() {
    if (
      !selezionato ||
      !roomId ||
      !codiceStanza ||
      !masterAttualeId
    ) {
      return;
    }

    setSalvando(true);
    setErrore("");

    // ==========================================
    // 1. RILEGGIAMO LA STANZA
    // ==========================================

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, master_player_id")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      console.error("Errore recupero stanza:", roomError);
      setErrore("Impossibile recuperare la stanza.");
      setSalvando(false);
      return;
    }

    // ==========================================
    // 2. VERIFICHIAMO IL MASTER ATTUALE
    // ==========================================

    if (room.master_player_id !== masterAttualeId) {
      setErrore(
        "Il Master è già cambiato. Torna indietro e riprova."
      );
      setSalvando(false);
      return;
    }

    // ==========================================
    // 3. TROVIAMO IL NUOVO MASTER
    // ==========================================

    const nuovoMaster = giocatori.find(
      (giocatore) => giocatore.id === selezionato
    );

    if (!nuovoMaster) {
      setErrore("Giocatore selezionato non trovato.");
      setSalvando(false);
      return;
    }

    if (nuovoMaster.id === masterAttualeId) {
      setErrore("Il nuovo Master deve essere un altro giocatore.");
      setSalvando(false);
      return;
    }

    // ==========================================
    // 4. CAMBIAMO IL MASTER NELLA STANZA
    // ==========================================

    const { data: roomAggiornata, error: roomUpdateError } =
      await supabase
        .from("rooms")
        .update({
          master_player_id: nuovoMaster.id,
          master_name: nuovoMaster.name,
          status: "lobby",
          pokemon: "",
          winner_player_id: null,
          finished_at: null,
          current_turn_player_id: null,
        })
        .eq("id", roomId)
        .eq("master_player_id", masterAttualeId)
        .select("id, master_player_id")
        .single();

    if (roomUpdateError || !roomAggiornata) {
      console.error("Errore cambio Master:", roomUpdateError);

      setErrore(
        "Impossibile cambiare Master. Il Master potrebbe essere già cambiato."
      );

      setSalvando(false);
      return;
    }

    // ==========================================
    // 5. VERIFICA REALE DAL DATABASE
    // ==========================================

    if (roomAggiornata.master_player_id !== nuovoMaster.id) {
      setErrore(
        "Il cambio Master non è stato confermato dal database."
      );

      setSalvando(false);
      return;
    }

    // ==========================================
    // 6. SINCRONIZZIAMO is_master
    //
    // Questo campo NON determina il Master.
    // Serve solamente come informazione derivata.
    // ==========================================

    const { error: resetError } = await supabase
      .from("players")
      .update({
        is_master: false,
      })
      .eq("room_id", roomId);

    if (resetError) {
      console.error("Errore reset is_master:", resetError);
    }

    const { error: nuovoMasterError } = await supabase
      .from("players")
      .update({
        is_master: true,
      })
      .eq("id", nuovoMaster.id)
      .eq("room_id", roomId);

    if (nuovoMasterError) {
      console.error(
        "Errore sincronizzazione nuovo Master:",
        nuovoMasterError
      );
    }

    // ==========================================
    // 7. PORTIAMO IL NUOVO MASTER AL RISULTATO
    // ==========================================

    router.push(
      `/risultato?codice=${encodeURIComponent(
        codiceStanza.toUpperCase()
      )}&nome=${encodeURIComponent(nomeGiocatore || "")}`
    );
  }

  // ==========================================
  // CARICAMENTO
  // ==========================================

  if (caricando) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400">
          Caricamento giocatori...
        </p>
      </main>
    );
  }

  // ==========================================
  // ERRORE BLOCCANTE
  // ==========================================

  if (errore && !giocatori.length) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">
            {errore}
          </p>

          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-zinc-800 px-5 py-3 hover:bg-zinc-700"
          >
            🏠 Torna alla Home
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-xl mx-auto">

        <div className="text-center mb-8">
          <div className="text-5xl mb-4">
            👑
          </div>

          <h1 className="text-3xl font-bold mb-2">
            Scegli il nuovo Master
          </h1>

          <p className="text-zinc-400">
            Seleziona il giocatore che guiderà la prossima partita.
          </p>
        </div>

        {errore && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-center">
            {errore}
          </div>
        )}

        <div className="space-y-3">
          {giocatori
            .filter(
              (giocatore) =>
                giocatore.id !== masterAttualeId
            )
            .map((giocatore) => (
              <button
                key={giocatore.id}
                onClick={() =>
                  setSelezionato(giocatore.id)
                }
                className={`w-full rounded-2xl border p-5 text-left transition ${
                  selezionato === giocatore.id
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">
                      {giocatore.name}
                    </p>

                    <p className="text-sm text-zinc-500">
                      Giocatore
                    </p>
                  </div>

                  <div className="text-2xl">
                    {selezionato === giocatore.id
                      ? "👑"
                      : "👤"}
                  </div>
                </div>
              </button>
            ))}
        </div>

        {giocatori.filter(
          (giocatore) =>
            giocatore.id !== masterAttualeId
        ).length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-zinc-400">
              Non ci sono altri giocatori a cui assegnare
              il ruolo di Master.
            </p>
          </div>
        )}

        {selezionato && (
          <button
            onClick={confermaNuovoMaster}
            disabled={salvando}
            className="w-full mt-6 rounded-xl bg-yellow-500 px-5 py-4 font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {salvando
              ? "Cambio Master..."
              : "👑 Conferma nuovo Master"}
          </button>
        )}

        <button
          onClick={() => router.push("/")}
          className="w-full mt-3 rounded-xl bg-zinc-800 px-5 py-3 text-zinc-300 hover:bg-zinc-700"
        >
          🏠 Annulla
        </button>

      </div>
    </main>
  );
}

export default function CambiaMaster() {
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
      <CambiaMasterContent />
    </Suspense>
  );
}