"use client";

import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { leerFicheroCliente, generarPlantillaEjemplo, descargarBlob } from "@/lib/excel";
import { guardarClienteActivo, leerClienteActivo } from "@/lib/clienteStore";
import { guardarClienteEnLista, leerClientesGuardados, borrarClienteGuardado, ClienteGuardado } from "@/lib/clientesGuardados";
import { ClienteMaestro, ColumnaPlantillaA3, CuentaPlan, FicheroCliente } from "@/lib/types";
import {
  Upload, Download, CheckCircle2, AlertTriangle,
  FileSpreadsheet, User, ListTree, Table2,
  BookmarkPlus, Bookmark, Trash2, ChevronDown, ChevronUp,
  RefreshCw,
} from "lucide-react";

type Tab = "datos" | "plan" | "plantilla";

export default function MaestroPage() {
  const [clienteCargado, setClienteCargado] = useState<FicheroCliente | null>(null);
  const [clientePrevio, setClientePrevio] = useState<FicheroCliente | null>(null); // el que viene de sesión
  const [avisos, setAvisos] = useState<string[]>([]);
  const [archivoNombre, setArchivoNombre] = useState<string>("");
  const [tab, setTab] = useState<Tab>("datos");
  const [clientesGuardados, setClientesGuardados] = useState<ClienteGuardado[]>([]);
  const [mostrarGuardados, setMostrarGuardados] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorLectura, setErrorLectura] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Restaurar cliente activo de la sesión
    const activo = leerClienteActivo();
    if (activo) {
      setClientePrevio(activo);
      setClienteCargado(activo);
      setArchivoNombre(activo.archivo || "(cargado en sesión anterior)");
    }
    setClientesGuardados(leerClientesGuardados());
  }, []);

  async function handleFile(file: File) {
    setErrorLectura("");
    setAvisos([]);
    try {
      const buffer = await file.arrayBuffer();
      const { cliente: c, planCuentas, plantillaA3, avisos: av } = leerFicheroCliente(buffer);

      // Verificar que se leyó algo útil
      if (!c.nombre && !c.cif) {
        setErrorLectura("No se han podido leer los datos del cliente. Comprueba que el fichero tiene la hoja 'Cliente' con el formato correcto y vuelve a subirlo.");
        return;
      }

      const nuevo: FicheroCliente = { cliente: c, planCuentas, plantillaA3, archivo: file.name };
      setClienteCargado(nuevo);
      setArchivoNombre(file.name);
      setAvisos(av);
      setTab("datos");
      setGuardado(false);

      // Guardar en sesión automáticamente si se leyó bien
      guardarClienteActivo(nuevo);
    } catch (err) {
      setErrorLectura(`Error al leer el fichero: ${err instanceof Error ? err.message : "formato no reconocido"}`);
    }
  }

  function cargarClienteGuardado(cg: ClienteGuardado) {
    setClienteCargado(cg.datos);
    setArchivoNombre(`(guardado: ${cg.nombre})`);
    setAvisos([]);
    setErrorLectura("");
    setTab("datos");
    setMostrarGuardados(false);
    setGuardado(true);
    guardarClienteActivo(cg.datos);
  }

  function guardarCliente() {
    if (!clienteCargado) return;
    guardarClienteEnLista(clienteCargado);
    setClientesGuardados(leerClientesGuardados());
    setGuardado(true);
  }

  function borrarCliente(nombre: string) {
    borrarClienteGuardado(nombre);
    setClientesGuardados(leerClientesGuardados());
  }

  function sustituirCliente() {
    setClienteCargado(null);
    setArchivoNombre("");
    setAvisos([]);
    setErrorLectura("");
    setGuardado(false);
    // No limpiamos la sesión hasta que se cargue uno nuevo
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const cliente = clienteCargado?.cliente ?? null;
  const planCuentas = clienteCargado?.planCuentas ?? [];
  const plantilla = clienteCargado?.plantillaA3 ?? [];

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <PageHeader
        index="01"
        title="Fichero del cliente"
        description="Base de todo el proceso. Carga el XLS con tres hojas: Cliente, PlanCuentas y PlantillaA3."
        client={cliente?.nombre || undefined}
      />

      <main className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[320px_1fr] gap-8">
        {/* Columna izquierda */}
        <div className="space-y-4">

          {/* Cliente activo en sesión */}
          {clienteCargado && (
            <div className="border border-[var(--color-brand)] bg-[var(--color-brand-light)] rounded-md p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[var(--color-brand)] shrink-0" />
                  <span className="text-sm font-medium text-[var(--color-brand-dark)]">
                    Cliente activo en sesión
                  </span>
                </div>
                <button
                  onClick={sustituirCliente}
                  className="flex items-center gap-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors shrink-0"
                >
                  <RefreshCw size={12} />
                  Sustituir
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono-tab text-[var(--color-brand-dark)]">
                <FileSpreadsheet size={13} />
                {archivoNombre}
              </div>
              {cliente?.nombre && (
                <p className="text-sm font-medium text-[var(--color-ink)] mt-1">{cliente.nombre}</p>
              )}
            </div>
          )}

          {/* Error de lectura */}
          {errorLectura && (
            <div className="border border-[var(--color-rubber)] bg-[var(--color-rubber-soft)] rounded-md p-4 text-sm text-[var(--color-rubber)]">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{errorLectura}</span>
              </div>
            </div>
          )}

          {/* Zona de carga — siempre visible */}
          {!clienteCargado && (
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-[var(--color-line)] rounded-md p-8 text-center cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-light)] transition-colors bg-[var(--color-surface)]"
            >
              <Upload className="mx-auto mb-3 text-[var(--color-brand)]" size={26} strokeWidth={1.5} />
              <p className="font-serif-display text-lg text-[var(--color-ink)]">
                Arrastra el XLS del cliente
              </p>
              <p className="text-sm text-[var(--color-ink-soft)] mt-1">o haz clic para seleccionar</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {/* Botón sustituir cuando ya hay cliente */}
          {clienteCargado && (
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border border-dashed border-[var(--color-line)] rounded-md p-4 text-center cursor-pointer hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-light)] transition-colors bg-[var(--color-surface)]"
            >
              <p className="text-sm text-[var(--color-ink-soft)] flex items-center justify-center gap-2">
                <Upload size={14} className="text-[var(--color-brand)]" />
                Cargar otro XLS y sustituir el cliente actual
              </p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {/* Clientes guardados */}
          {clientesGuardados.length > 0 && (
            <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
              <button
                onClick={() => setMostrarGuardados(!mostrarGuardados)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-brand-dark)] bg-[var(--color-brand-light)]"
              >
                <span className="flex items-center gap-2">
                  <Bookmark size={15} />
                  Clientes guardados ({clientesGuardados.length})
                </span>
                {mostrarGuardados ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {mostrarGuardados && (
                <div className="divide-y divide-[var(--color-line)]">
                  {clientesGuardados.map((cg) => (
                    <div key={cg.nombre} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <button onClick={() => cargarClienteGuardado(cg)} className="flex-1 text-left">
                        <p className="text-sm font-medium text-[var(--color-ink)]">{cg.nombre}</p>
                        <p className="text-xs text-[var(--color-ink-soft)]">{cg.cif} · {cg.fechaGuardado}</p>
                      </button>
                      <button onClick={() => borrarCliente(cg.nombre)}
                        className="text-[var(--color-ink-soft)] hover:text-[var(--color-rubber)] transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Guardar cliente */}
          {clienteCargado && (
            <button onClick={guardarCliente}
              className={`w-full flex items-center justify-center gap-2 rounded-md py-3 text-sm font-medium transition-colors border ${
                guardado
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              }`}
            >
              {guardado
                ? <><CheckCircle2 size={15} />Cliente guardado</>
                : <><BookmarkPlus size={15} />Guardar este cliente (opcional)</>
              }
            </button>
          )}

          {/* Descargar plantilla */}
          <button
            onClick={() => descargarBlob(generarPlantillaEjemplo(), "plantilla_cliente_ejemplo.xlsx")}
            className="w-full flex items-center justify-center gap-2 border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md py-3 text-sm text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
          >
            <Download size={15} />
            Descargar plantilla de ejemplo
          </button>

          {/* Instrucciones */}
          <div className="border border-[var(--color-line)] bg-[var(--color-surface)] rounded-md p-4 text-sm text-[var(--color-ink-soft)] space-y-2">
            <p className="font-mono-tab text-xs tracking-[0.15em] text-[var(--color-ink)]">ESTRUCTURA DEL XLS</p>
            {[
              ["Cliente", "Datos fiscales y particularidades"],
              ["PlanCuentas", "Subcuentas de A3 para cada concepto"],
              ["PlantillaA3", "Las 9 columnas de tu plantilla de importación"],
            ].map(([hoja, desc]) => (
              <div key={hoja} className="flex gap-2">
                <span className="font-mono-tab text-xs bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] px-1.5 py-0.5 rounded-sm shrink-0">{hoja}</span>
                <span className="text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Columna derecha — datos del cliente */}
        <div>
          {!clienteCargado ? (
            <div className="h-full flex items-center justify-center border border-dashed border-[var(--color-line)] rounded-md p-10 text-center bg-[var(--color-surface)]">
              <div>
                <p className="text-[var(--color-ink-soft)] text-sm max-w-xs mb-3">
                  Carga el XLS del cliente o selecciona uno guardado para ver sus datos aquí.
                </p>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  ¿Primera vez? Descarga la plantilla de ejemplo para ver el formato correcto.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Avisos */}
              {avisos.length > 0 && (
                <div className="border border-[var(--color-amber-stamp)] bg-[var(--color-amber-soft)] rounded-md p-4">
                  <div className="flex items-center gap-2 mb-2 text-[var(--color-amber-stamp)] font-mono-tab text-xs tracking-[0.15em]">
                    <AlertTriangle size={14} />AVISOS DE LECTURA
                  </div>
                  <ul className="text-sm text-[var(--color-ink-soft)] space-y-1 list-disc pl-5">
                    {avisos.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              {avisos.length === 0 && (
                <div className="flex items-center gap-2 text-[var(--color-brand)] text-sm">
                  <CheckCircle2 size={15} />Fichero leído correctamente — datos disponibles para todos los módulos.
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 border-b border-[var(--color-line)]">
                {([
                  { id: "datos", label: "Datos", icon: User },
                  { id: "plan", label: `Plan de cuentas (${planCuentas.length})`, icon: ListTree },
                  { id: "plantilla", label: `Plantilla A3 (${plantilla.length})`, icon: Table2 },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setTab(id as Tab)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      tab === id
                        ? "border-[var(--color-brand)] text-[var(--color-brand-dark)]"
                        : "border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>

              {tab === "datos" && cliente && <FichaDatos cliente={cliente} />}

              {tab === "plan" && (
                <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                  {planCuentas.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--color-ink-soft)]">Sin plan de cuentas. Descarga la plantilla y rellena la hoja PlanCuentas.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-brand)] text-white text-left">
                          <th className="px-4 py-2 font-mono-tab text-xs">Concepto</th>
                          <th className="px-4 py-2 font-mono-tab text-xs w-32">Cuenta</th>
                          <th className="px-4 py-2 font-mono-tab text-xs">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planCuentas.map((c, i) => (
                          <tr key={i} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""} ${!c.cuenta ? "bg-[var(--color-amber-soft)]" : ""}`}>
                            <td className="px-4 py-2">{c.concepto}</td>
                            <td className="px-4 py-2 font-mono-tab text-[var(--color-brand-dark)] font-medium">
                              {c.cuenta || <span className="text-[var(--color-amber-stamp)]">— sin asignar</span>}
                            </td>
                            <td className="px-4 py-2 text-[var(--color-ink-soft)] text-xs">{c.notas ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === "plantilla" && (
                <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
                  {plantilla.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--color-ink-soft)]">Sin plantilla A3 detectada. Se usará el formato estándar de 9 columnas.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-brand)] text-white text-left">
                          <th className="px-4 py-2 font-mono-tab text-xs w-16">Col.</th>
                          <th className="px-4 py-2 font-mono-tab text-xs">Campo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plantilla.map((c, i) => (
                          <tr key={c.letra} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
                            <td className="px-4 py-2 font-mono-tab text-[var(--color-brand-dark)] font-medium">{c.letra}</td>
                            <td className="px-4 py-2">{c.campo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FichaDatos({ cliente }: { cliente: ClienteMaestro }) {
  const rows: [string, string, boolean?][] = [
    ["Nombre", cliente.nombre || "—"],
    ["CIF", cliente.cif || "—"],
    ["Actividad", cliente.actividad || "—"],
    ["Régimen de IVA", cliente.regimenIva],
    ["Retención habitual", cliente.retencion === "ninguna" ? "Sin retención" : `${cliente.retencion}%`],
    ["Prorrata", cliente.prorrata ? `Sí — ${cliente.porcentajeProrrata}% deducible` : "No", cliente.prorrata],
    ["Recargo de equivalencia", cliente.recargoEquivalencia ? "Sí" : "No", cliente.recargoEquivalencia],
    ["Criterio de caja", cliente.criterioCaja ? "Sí" : "No"],
  ];

  return (
    <div className="border border-[var(--color-line)] rounded-md overflow-hidden bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v, destacar], i) => (
            <tr key={k} className={`border-b border-[var(--color-line)] last:border-0 ${i % 2 === 1 ? "bg-[var(--color-brand-light)]" : ""}`}>
              <td className="px-4 py-2.5 text-[var(--color-ink-soft)] w-48">{k}</td>
              <td className={`px-4 py-2.5 font-medium ${destacar ? "text-[var(--color-brand-dark)]" : "text-[var(--color-ink)]"}`}>{v}</td>
            </tr>
          ))}
          {cliente.notas && (
            <tr>
              <td className="px-4 py-2.5 text-[var(--color-ink-soft)] align-top">Notas</td>
              <td className="px-4 py-2.5">{cliente.notas}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
