# Asesoría — Procesador contable para A3

Aplicación con 4 módulos: lector de facturas PDF, fichero del cliente, extractos bancarios y consultas contables. Genera asientos en formato de 9 columnas listo para importar en A3.

## Pasos de instalación

### 1. Sube este código a GitHub

Crea un repositorio nuevo (vacío, sin README) y sube el contenido de esta carpeta. Con GitHub Desktop: *Add local repository* -> selecciona esta carpeta -> primer commit -> *Publish repository*.

### 2. Conecta el repositorio a Vercel

En Vercel -> **Add New Project** -> selecciona el repositorio. Vercel detecta automáticamente que es Next.js, no hace falta tocar configuración de build.

### 3. Configura la API key

Antes o después del primer deploy, ve a **Settings -> Environment Variables** y añade:

```
ANTHROPIC_API_KEY = tu_clave_de_console.anthropic.com
```

Esta clave es necesaria para los módulos 01 (lector de facturas) y 04 (consultas). Sin ella esos dos módulos devuelven un error indicando que falta configurarla.

### 4. Deploy

Pulsa **Deploy**. En 1-2 minutos tendrás tu URL, tipo `tu-proyecto.vercel.app`.

## Uso

1. **Módulo 02** — sube el XLS del cliente (dos hojas: datos del cliente / plantilla A3 de 9 columnas). Puedes descargar una plantilla de ejemplo desde el propio módulo.
2. **Módulo 01** — sube las facturas PDF. Indica el número de asiento por el que empezar (el siguiente libre en A3). Exporta el XLS.
3. **Módulo 03** — sube el extracto bancario. Genera una fila por movimiento con la 572 y la contrapartida marcada para clasificar.
4. **Módulo 04** — chat de consultas contables con el contexto del cliente cargado.

## Pendiente de ajustar

- Tabla completa de códigos de operación (de momento: 01 ventas, 034 compras con IVA, 061 compras sin IVA).
- Probar la extracción de facturas reales y ajustar el prompt si algún campo no se detecta bien.
- Reglas de clasificación automática de movimientos bancarios recurrentes.
