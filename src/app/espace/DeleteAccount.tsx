"use client";

import { deleteMyAccount } from "./actions";

export function DeleteAccount() {
  return (
    <form
      action={deleteMyAccount}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Supprimer votre espace client ? Votre historique, votre carte de fidélité et vos coordonnées seront effacés. Cette action est définitive.",
          )
        )
          e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-mute underline-offset-4 transition-colors hover:text-red-700 hover:underline"
      >
        Supprimer mon espace et mes données
      </button>
    </form>
  );
}
