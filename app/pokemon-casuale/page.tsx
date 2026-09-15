"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type PokemonSpecies = {
  name: string;
  url: string;
};

export default function PokemonCasuale() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const masterMode = searchParams.get("master") ?? "chosen";

  useEffect(() => {
    async function scegliPokemonCasuale() {
      try {
        const response = await fetch(
          "https://pokeapi.co/api/v2/pokemon-species?limit=2000&offset=0"
        );

        if (!response.ok) {
          throw new Error("Errore caricamento Pokédex");
        }

        const data = await response.json();

        const pokemon: PokemonSpecies[] = data.results ?? [];

        if (pokemon.length === 0) {
          throw new Error("Pokédex vuoto");
        }

        const casuale =
          pokemon[Math.floor(Math.random() * pokemon.length)];

        router.replace(
          `/configura-partita?pokemon=${encodeURIComponent(
            casuale.name
          )}&master=${encodeURIComponent(masterMode)}`
        );
      } catch (error) {
        console.error(error);

        alert(
          "Impossibile scegliere un Pokémon casuale. Riprova."
        );

        router.replace(
          `/scegli-pokemon?master=${encodeURIComponent(
            masterMode
          )}`
        );
      }
    }

    scegliPokemonCasuale();
  }, [masterMode, router]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="text-center">

        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-6">
          <span className="text-4xl animate-pulse">
            🎲
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold">
          Scelta casuale
        </h1>

        <p className="mt-3 text-zinc-400">
          Sto scegliendo un Pokémon dal Pokédex...
        </p>

        <div className="mt-6 flex justify-center">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
        </div>

      </div>
    </main>
  );
}