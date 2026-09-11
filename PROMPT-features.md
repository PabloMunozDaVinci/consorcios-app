# One-shot prompt — Fases 1 a 3 (features)

> **Usar DESPUÉS de terminar los bloques 0 y 1 de `PROMPT-claude-code.md`.**
> Sin RLS funcionando y sin `service_role` sacado de las rutas, el multi-tenancy de la Fase 1 es decorativo y una fuga entre administradoras es cuestión de tiempo.

Copiá todo lo que está debajo de la línea y pegalo en Claude Code, parado en la raíz de `consorcios-app`.

---

Sos un ingeniero senior full-stack trabajando sobre `consorcios-app`: Next.js 16 (App Router) + Supabase, para administración de consorcios de propiedad horizontal en Argentina.

Leé `CONTEXT.md` (auditoría técnica), `ROADMAP.md` (plan de producto y requisitos legales) y `AGENTS.md` antes de escribir código. `AGENTS.md` avisa que Next.js 16 tiene breaking changes: consultá `node_modules/next/dist/docs/` antes de usar cualquier API de Next, no asumas patrones de Next 14/15.

## Contexto de producto que explica el orden de las fases

El primer cliente es la administradora del edificio donde vive el dueño del producto. Esa administradora **ya liquida expensas con otro sistema** y no lo va a abandonar para probar esto. Por eso el orden está invertido respecto de lo que parecería natural: primero lo que se puede usar **sin pedirle que cambie nada** (importar lo que ya emite), después lo que la enamora (portal y reclamos), después lo que le hace ganar plata (mora y certificado de deuda), y la liquidación nativa recién al final.

La decisión de diseño que hace posible ese orden: **la cuenta corriente por unidad es el núcleo del sistema**, y se alimenta de dos fuentes intercambiables — la importación (Fase 1) o la liquidación nativa (Fase 4, fuera de este prompt). Todo lo demás lee de ahí.

Si en algún momento te parece que una fase necesita la liquidación nativa para funcionar, **pará y decímelo** — probablemente sea señal de que hay que ajustar el diseño de la cuenta corriente, no de que haya que adelantar la Fase 4.

## Reglas de trabajo

- Una rama por fase: `feat/fase-1-cuenta-corriente`, `feat/fase-2-portal`, `feat/fase-3-mora`. Commits en español, formato convencional.
- **No avances de fase sin que la anterior compile y pase su criterio de aceptación.** Después de cada fase: `npx tsc --noEmit && npm run lint && npm run build && npm test`.
- Cambios de schema en `supabase/migrations/NNN_descripcion.sql`, idempotentes. No edites `supabase/schema.sql` en su lugar.
- **Toda tabla nueva nace con RLS habilitada y con sus policies escritas en la misma migración.** Una tabla con RLS y cero policies es un bug, no un estado intermedio.
- Validá toda entrada con zod en las API routes (los schemas viven en `src/lib/sanitize.ts`, hoy sin usar).
- Escribí tests de la lógica de cálculo a medida que la escribís, no al final.
- Al terminar cada fase, actualizá `ROADMAP.md` marcando lo hecho.

## Antes de escribir código

Hacé un plan de la Fase 1 con el DDL de las tablas nuevas, las policies RLS y los archivos que vas a tocar. **Mostrámelo y esperá mi aprobación.** El modelo de la cuenta corriente condiciona todo lo demás; si le erramos acá, lo pagamos tres veces.

---

# FASE 1 — Multi-tenant + cuenta corriente + importación

## 1.1 Multi-tenancy

Hoy la jerarquía arranca en `consorcios` y cualquier usuario autenticado ve los datos de todos. Agregá el nivel de arriba:

- Tabla `administradoras`: razón social, CUIT, **matrícula RPA**, domicilio, logo, datos de contacto. La matrícula es obligatoria en cada recibo y en el certificado de deuda, así que no es opcional.
- **`administradora_id` en todas las tablas**, no solo en `consorcios`. Desnormalizado a propósito: si vive solo en la raíz, cada policy sobre `pagos` necesita tres joins hacia arriba, se vuelve lento e imposible de auditar. Mantené la consistencia con un trigger que lo derive del padre en el INSERT.
- Tabla `usuarios`: `auth_user_id`, `administradora_id`, `rol` (`super_admin`, `admin`, `operador`, `propietario`), `activo`. **Reemplaza el hack actual** de "propietario sin `unidad_id` = admin", que hoy está implementado de forma distinta en `lib/auth.ts`, `AuthGuard.tsx` y `hooks/useUser.ts` — y en este último cualquier usuario cuya fila no sea visible queda marcado como admin.
- Función `auth.administradora_id()` que lee de `usuarios` a partir de `auth.uid()`, y policies RLS que la usen en todas las tablas. `super_admin` cruza tenants; nadie más.
- Un `operador` puede tener acceso limitado a ciertos consorcios: tabla `usuarios_consorcios` para eso.

**Escribí un test que verifique que un usuario de la administradora A no puede leer ni escribir nada de la B.** Es el test más importante de todo el proyecto.

## 1.2 Cuenta corriente — el núcleo

- Tabla `cuenta_corriente`: unidad, fecha, tipo (`debito` / `credito`), concepto, importe, período al que corresponde, origen (`importacion` / `liquidacion` / `pago` / `ajuste`), referencia al documento que lo generó.
- El saldo de una unidad **se deriva de los movimientos**, no se guarda desnormalizado. Si por performance hiciera falta un saldo materializado, que sea una vista o una columna mantenida por trigger, nunca un campo que se actualice desde la aplicación.
- Todo movimiento es inmutable: un error se corrige con un contraasiento, no editando la fila. Es plata de terceros y tiene que ser auditable.
- Los intereses por mora se registran como movimientos propios, con la tasa aplicada y su fundamento guardados en la fila. El certificado de deuda de la Fase 3 los exige y no se pueden recalcular hacia atrás.
- **Sin anatocismo**: no capitalices intereses sobre intereses.
- Eliminá `get_saldo_deudor()` tal como está: el `150000 * 1.20` hardcodeado desaparece. Reescribila leyendo de esta tabla.

## 1.3 Importador

Esta es la pieza que permite entrar sin pedirle nada al cliente. Tratala como feature de primera clase, no como script.

- Tabla `importaciones`: archivo original, tipo, mapeo de columnas usado, estado, log de resultados, quién y cuándo.
- **Importación del padrón**: unidades y propietarios desde Excel/CSV. Debe poder correr sobre un consorcio ya cargado sin duplicar.
- **Importación de la liquidación mensual**: CSV/Excel con una fila por unidad y su importe del período. Genera los débitos correspondientes en `cuenta_corriente`.
- **Mapeo de columnas configurable y recordado por consorcio**: cada administradora exporta con encabezados distintos. La primera vez el usuario mapea; las siguientes el sistema propone el mapeo anterior.
- **Previsualización obligatoria antes de confirmar**: mostrar cuántas filas se van a importar, cuáles no matchean con ninguna unidad, y el total. Nada se escribe hasta que el usuario confirma.
- **Detección de duplicados**: importar dos veces el mismo período no puede duplicar la deuda. Detectalo y ofrecé reemplazar o cancelar.
- Toda importación es reversible: guardá el vínculo entre la importación y los movimientos que generó, para poder revertirla entera.

## 1.4 Pagos

- Registro de pago con imputación a `cuenta_corriente` como crédito.
- Imputación configurable: por período específico o al saldo más antiguo.

**Criterio de aceptación de la Fase 1:** importás la liquidación real de un edificio de tres meses consecutivos y la cuenta corriente de cada unidad coincide, peso por peso, con lo que dice la administradora. Reimportar un período no duplica nada.

---

# FASE 2 — Portal del propietario + comunicación

El dolor #1 en horas del administrador, el hueco más grande del mercado, y lo único que se puede poner en producción con usuarios reales sin que la administradora cambie nada.

## 2.1 Portal del propietario

Hoy el login existe pero no muestra nada propio. Que el propietario vea:
- Su cuenta corriente: movimientos, saldo, historial
- Sus recibos y liquidaciones, descargables
- Sus reclamos

**Y solo los suyos.** Es el segundo test de aislamiento más importante después del de multi-tenancy: escribilo.

Diseñá esta parte pensando en el celular primero. El propietario entra desde el teléfono, parado en el palier.

## 2.2 Reclamos

- `reclamos`: consorcio, unidad, quién lo abre, título, descripción, fotos, prioridad, estado (`nuevo` → `asignado` → `en curso` → `resuelto`), responsable, y fecha de cada transición.
- Historial de mensajes dentro del reclamo, entre propietario y administrador. Que quede todo, para que dentro de seis meses se pueda reconstruir qué se dijo.
- Vinculación opcional con `arreglos`, que ya existe: un reclamo puede derivar en una orden de trabajo.
- Notificación por email al propietario en cada cambio de estado (Resend ya está como dependencia).
- Bandeja del administrador: filtros por consorcio, estado y antigüedad, con los que llevan mucho sin respuesta visibles arriba.

**Criterio de aceptación:** un propietario reporta una filtración desde el celular con foto, el administrador se la asigna a un plomero, y seis meses después cualquiera reconstruye qué pasó y cuándo sin buscar en WhatsApp.

---

# FASE 3 — Mora hasta certificado de deuda + cobranzas

El diferencial del producto: ninguno de los seis competidores relevados automatiza el escalamiento legal hasta el final.

## 3.1 Motor de mora conectado a la cuenta corriente

- Reescribí la evaluación de mora para que lea de `cuenta_corriente`.
- Recordá el bug ya identificado: `EXTRACT(MONTH FROM AGE(...))` ignora los años, así que una deuda de 14 meses se calcula como 2. Si el Bloque 0 no lo arregló, arreglalo acá.
- Máquina de estados: al día → deudor → apto carta → inicio juicio → juicio en curso. **Umbrales configurables por consorcio**, no hardcodeados.
- Cada transición queda en `mora_logs` con el saldo y la tasa del momento.
- Corregí el typo `aptoo_carta` de `actions/mora.ts` si sigue ahí: hoy hace que el template de carta documento nunca se seleccione.

## 3.2 Intimaciones

- Plantillas por estado, editables por el administrador.
- Registro de cada envío: fecha, medio, destinatario, resultado. El certificado de deuda tiene que referenciar las intimaciones previas, así que sin este registro no se puede emitir.
- Activá el envío por Resend, hoy comentado en `actions/mora.ts`. **Ojo:** el contador `emailsEnviados++` está fuera del bloque comentado, así que hoy reporta envíos que no ocurren.
- **Ninguna intimación sale sin confirmación explícita de un admin.** Son cartas de contenido legal: nada de disparos automáticos desde un Server Action sin control de acceso, que es exactamente lo que hoy hace `admin/mora/page.tsx`.

## 3.3 Certificado de deuda

El entregable más valioso de todo el roadmap. Requisitos completos en `ROADMAP.md` §5 — los cuatro bloques son obligatorios (arts. 2046-2048 CCyC).

- Generador del PDF con: identificación completa (consorcio con CUIT, administrador con matrícula RPA, unidad, propietario con DNI y domicilio), composición mes a mes separando capital de intereses con la tasa y su fundamento, y referencia a los recibos impagos e intimaciones previas.
- **Flujo de aprobación del consejo de propietarios**: sin esa firma no es título ejecutivo cuando el consorcio tiene consejo. Modelá el estado (`borrador` → `pendiente de aprobación` → `aprobado`) y no permitas exportar el PDF definitivo sin la aprobación registrada.
- Numeración correlativa y registro de cada certificado emitido.
- Los importes tienen que salir de los movimientos de `cuenta_corriente` tal como quedaron registrados, no recalculados al momento de emitir.

**Criterio de aceptación:** una unidad con 6 meses impagos genera, en un click, un PDF que un abogado puede presentar sin retocar.

## 3.4 Cobranzas

- **QR interoperable** + link de pago. La plata va directo a la cuenta del consorcio; el sistema solo registra. Sin pasarela ni comisiones.
- **Importación del extracto bancario** (CSV/Excel) con matcheo automático contra unidades por importe, fecha y referencia. Los que no matchean quedan en una bandeja para imputar a mano. Es lo que más tiempo ahorra de todo el módulo.
- Todo pago imputado genera su crédito en `cuenta_corriente`.

---

# Fuera de alcance (no lo implementes)

- **Liquidación nativa de expensas.** Es la Fase 4 y va después de que la administradora ya esté usando el producto. El importador de la Fase 1 la cubre mientras tanto.
- **Liquidación de sueldos SUTERH.** El motivo está en `ROADMAP.md` §6.
- Pasarela de pagos con comisiones, app móvil nativa, contabilidad de partida doble completa, IA sobre facturas.
- Asambleas y calendario de cumplimiento Ley 941: es la Fase 5.

Si creés que algo de esta lista es necesario para cumplir un criterio de aceptación, **pará y decímelo** en vez de implementarlo por las tuyas.
