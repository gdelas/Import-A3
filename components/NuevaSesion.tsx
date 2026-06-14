"use client";

import { useState } from "react";
import { limpiarSesion } from "@/lib/sessionStore";
import { RefreshCw, AlertTriangle } from "lucide-react";

export function NuevaSesion() {
  const [confirmando, setConfirmando] = useState(false);

  function confirmar() {
    limpiarSesion();
    window.location.href = "/";
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-md px-3 py-1.5">
        <AlertTriangle size={13} className="text-white/80 shrink-0" />
        <span className="text-xs text-white/80">¿Borrar sesión?</span>
        <button onClick={confirmar} className="text-xs font-medium text-white underline ml-1">Sí</button>
        <button onClick={() => setConfirmando(false)} className="text-xs text-white/60 ml-1">No</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="flex items-center gap-1.5 border border-white/20 text-white/70 hover:text-white hover:border-white/40 px-3 py-1.5 rounded-sm text-xs font-mono-tab tracking-wide transition-colors"
    >
      <RefreshCw size={13} />
      Nueva sesión
    </button>
  );
}
