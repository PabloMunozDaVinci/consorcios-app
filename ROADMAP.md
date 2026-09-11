# ROADMAP.md — consorcios-app

> Plan de producto basado en el análisis competitivo y regulatorio de septiembre 2026.
> Complementa `CONTEXT.md` (auditoría técnica). Leer ese primero.

---

## 1. La situación y la estrategia

**Quién sos en esta historia:** propietario en un edificio, con acceso directo a la administradora que lo administra. Ese es tu primer cliente y tu campo de pruebas.

**El problema que eso plantea:** esa administradora ya liquida expensas con algo — un sistema o una planilla. No va a mover toda su cartera al producto de un propietario de uno de sus edificios para probarlo. Pedirle que migre en el paso uno es pedirle lo más difícil primero, y es donde muere la mayoría de estos productos.

**La estrategia:** entrar por lo **aditivo**. Construir primero lo que le suma sin obligarla a dejar nada, ganar el uso real de tus vecinos, y recién cuando el producto ya está adentro y funcionando, ofrecerle reemplazar el núcleo.

**La decisión técnica que lo hace posible:** el corazón del sistema es la **cuenta corriente por unidad**, y se puede alimentar de dos formas —importando la liquidación que la administradora ya emite hoy, o generándola nativamente más adelante. Con eso tenés portal, mora y certificado de deuda **sin haber construido la liquidación todavía**.

### Decisiones tomadas

| Decisión | Valor | Consecuencia |
|---|---|---|
| **Primer cliente** | La administradora de tu propio edificio | Piloto con tus vecinos, sin fricción de venta |
| **Entrada** | Aditiva (importás su liquidación) | No le pedís que migre nada para empezar |
| **Tenancy** | Base compartida con `administradora_id` + RLS | Un deploy, una migración, ~$25/mes sin importar la cantidad de clientes |
| **Núcleo del modelo** | Cuenta corriente por unidad | Fuente única de verdad del saldo; la alimenta la importación o la liquidación nativa |
| **Sueldos SUTERH** | Fuera de alcance | Ver §6 |
| **Cobranzas** | QR + conciliación por importación de extracto | Sin pasarela, sin comisiones, sin webhooks |

---

## 2. Dónde está el valor: las tres capas de brecha

Comparado feature por feature contra KM44, CONSO, Octopus, AdminProp, Adminia Manager y Redconar.

### Capa 1 — Mesa de entrada (todos la tienen)

Liquidación con prorrateo por coeficiente · recibo con QR y matrícula RPA (**obligatorio** por Ley 941 en CABA) · ordinarias vs. extraordinarias · fondo de reserva · intereses sin anatocismo · sueldos SUTERH + F931 · cobranza con link/QR · proveedores · contabilidad y rendición.

No diferencia: habilita. Y es lo que hay que construir **último**, no primero, porque es lo que exige que el cliente abandone su sistema actual.

### Capa 2 — Semi-tapada (todos la tocan, nadie la termina)

**Mora.** Los seis competidores tienen "gestión de morosos": un listado con intereses. Ninguno automatiza el escalamiento legal hasta el final. Vos ya tenés la máquina de estados diseñada. Le falta el remate: **el certificado de deuda**, que convierte una deuda en título ejecutivo y habilita el juicio ejecutivo (arts. 2046-2048 CCyC).

Para una administradora, la morosidad es plata que no entra y horas de perseguir. Es lo que mejor se vende.

### Capa 3 — Destapada (acá está el aire)

**Comunicación documentada.** La propia competencia lo admite en su material: atender a los vecinos *"es la parte que más horas consume y la que menos queda registrada cuando vive en grupos de WhatsApp informales"*. Lo que ofrecen es notificación **saliente** por WhatsApp — broadcast. Nadie tiene reclamos bidireccionales con estado, responsable e historial.

**Y es lo único que podés instalar sin permiso de nadie**: tus vecinos lo empiezan a usar, y la administradora descubre que le bajó el ruido.

**Asambleas.** Las virtuales son válidas (CCyC 2058-2060 + disposiciones 2597, 3534, 4926 y 5313/2020 de CABA) con requisitos concretos. Ningún competidor las integra: te mandan a Zoom y transcribís el acta a mano.

**Cumplimiento Ley 941 como producto.** DDJJ anual, alta de consorcios dentro de los 30 días de la asamblea (Disp. 1129/26), vencimientos de seguros y mantenimientos obligatorios, con sanciones que escalan hasta la baja del registro. Nadie vende "el sistema que te avisa antes de que te multen".

---

## 3. Las fases

El orden está pensado para tu posición: cada fase se puede mostrar y usar antes de pedirle nada a la administradora.

### FASE 0 — Que arranque y sea segura
**Prerequisito absoluto.** Detallada en `PROMPT-claude-code.md` (bloques 0 y 1). Sin RLS funcionando, el multi-tenancy de la Fase 1 es decorativo.

---

### FASE 1 — Multi-tenant + cuenta corriente + importación
**Esfuerzo: medio** · La base de todo, y la que no le pide nada a nadie.

**Alcance:**
- Nivel `administradoras` arriba de `consorcios`, con `administradora_id` desnormalizado en todas las tablas y RLS que lo fuerce
- Tabla `usuarios` con roles reales (`super_admin`, `admin`, `operador`, `propietario`), reemplazando el hack de "sin `unidad_id` = admin"
- **`cuenta_corriente` por unidad**: débitos y créditos, saldo derivado. Fuente única de verdad. Reemplaza el `150000 * 1.20` hardcodeado de hoy
- **Importador de liquidaciones**: subís el CSV/Excel que la administradora ya emite y el sistema genera los débitos por unidad. Mapeo de columnas configurable, previsualización antes de confirmar, y detección de duplicados
- Importación del padrón de unidades y propietarios desde Excel
- Registro de pagos con imputación a la cuenta corriente

**Criterio de aceptación:** importás la liquidación real de tu edificio de tres meses y la cuenta corriente de cada unidad coincide con lo que dice la administradora.

---

### FASE 2 — Portal del propietario + comunicación
**Esfuerzo: medio-bajo** · **Tu caballo de Troya.** Es lo que instalás en tu edificio sin pedir permiso, y lo que ningún competidor tiene.

**Alcance:**
- Portal del propietario de verdad: hoy el login existe pero no muestra nada propio. Que vea su cuenta corriente, sus recibos descargables y sus reclamos. Y **solo los suyos**
- `reclamos`: el propietario abre desde el celular, con foto. Estado (`nuevo` → `asignado` → `en curso` → `resuelto`), responsable, prioridad, historial completo de mensajes
- Vinculación opcional con `arreglos`, que ya existe
- Notificación por email en cada cambio de estado
- Bandeja del administrador: filtros por consorcio, estado y antigüedad, con visibilidad de los que llevan mucho sin respuesta

**Criterio de aceptación:** tus vecinos reportan cosas desde el celular en vez de por WhatsApp, y seis meses después cualquiera reconstruye qué pasó y cuándo.

**Por qué esta fase va segunda:** es la única que podés poner en producción con usuarios reales sin que la administradora cambie nada de lo que hace. Y es la prueba social que te abre la conversación comercial.

---

### FASE 3 — Mora hasta certificado de deuda + cobranzas
**Esfuerzo: medio** · **Tu diferencial**, y el argumento de venta más fuerte con la administradora.

**Alcance:**
- Reescribir el motor de mora para que lea de `cuenta_corriente`
- Intereses sobre el saldo real, con tasa y fundamento registrados (el certificado los exige)
- Máquina de estados con umbrales configurables por consorcio
- Intimaciones con plantillas y registro de envío (fecha, medio, resultado)
- **Generador de certificado de deuda** con los cuatro bloques obligatorios (§5)
- Flujo de aprobación del consejo de propietarios: sin esa firma no es título ejecutivo
- QR interoperable en el recibo + link de pago
- Importación del extracto bancario y matcheo automático de pagos contra unidades

**Criterio de aceptación:** una unidad con 6 meses impagos genera, en un click, un PDF de certificado de deuda que un abogado puede presentar sin retocar.

---

### FASE 4 — Liquidación nativa
**Esfuerzo: alto** · Se construye **cuando la administradora ya está adentro** y quiere dejar su sistema, no antes.

**Alcance:**
- `periodos_liquidacion` (abierto → cerrado → emitido)
- Rubros de gasto, proveedores, comprobantes adjuntos
- **Prorrateo por `unidades.coeficiente`** — la columna ya existe y hoy no se usa en ningún cálculo
- Ordinarias vs. extraordinarias; fondo de reserva
- Recibo en PDF con las 10 secciones obligatorias, matrícula RPA y código QR (§5)
- El importador de la Fase 1 queda como camino de migración y de convivencia

**Criterio de aceptación:** cargás los gastos de un mes, cerrás el período, y el sistema emite un recibo por unidad cuya suma da exactamente el total de gastos prorrateado por coeficiente.

---

### FASE 5 — Asambleas y cumplimiento Ley 941
**Esfuerzo: medio** · Opcional. Alto valor de venta, bajo valor de uso diario.

Convocatorias con orden del día y 10 días de anticipación · registro de asistencia y quórum por coeficiente · votación registrada individualmente + voto de ausentes hasta 15 días después (art. 2060 CCyC) · generación del acta · calendario de vencimientos (DDJJ, altas en RPA, seguros, mantenimientos obligatorios) con alertas anticipadas.

---

## 4. Modelo de datos objetivo

```
administradoras                    ← el tenant
 ├── usuarios (rol, administradora_id, auth_user_id)
 └── consorcios
      ├── edificios ──< unidades ──< propietarios
      ├── cuenta_corriente          ← EL NÚCLEO: débitos y créditos por unidad
      │    ├── alimentada por importaciones (Fase 1)
      │    └── alimentada por liquidación nativa (Fase 4)
      ├── importaciones (archivo, mapeo, estado, log)
      ├── pagos ──> imputación a cuenta_corriente
      ├── mora_logs ──> certificados_deuda
      ├── reclamos (tickets con historial)
      ├── arreglos
      ├── periodos_liquidacion ──< gastos, liquidaciones_unidad   (Fase 4)
      ├── proveedores                                             (Fase 4)
      ├── asambleas                                               (Fase 5)
      └── vencimientos                                            (Fase 5)
```

**Punto técnico que no es obvio:** `administradora_id` va en **todas** las tablas, no solo en `consorcios`. Si vive solo en la raíz, cada policy de RLS sobre `pagos` necesita tres joins hacia arriba — lento e imposible de auditar. Se desnormaliza y se mantiene consistente con un trigger.

**El cambio conceptual más importante:** hoy `pagos` es una lista suelta y la deuda sale de una constante mágica. A partir de la Fase 1 la verdad vive en `cuenta_corriente`. Todo lo demás —mora, certificado, portal— lee de ahí. Eso es lo que permite invertir el orden y dejar la liquidación para el final.

---

## 5. Requisitos legales que el código debe respetar

**Liquidación de expensas — 10 secciones obligatorias:**
período · ingresos del mes anterior · gastos detallados por rubro · saldo del período · saldo bancario a la fecha · listado de unidades en mora con montos · prorrateo unidad por unidad · importe individual · fecha de vencimiento sin recargo · medios de pago disponibles.
Más: **matrícula RPA del administrador** y **código QR** a la documentación del consorcio en cada recibo (Ley 941 CABA).

**Certificado de deuda — cuatro bloques (arts. 2046-2048 CCyC):**
1. *Identificación*: consorcio con nombre, domicilio y CUIT; administrador con matrícula RPA; unidad; propietario con DNI y domicilio
2. *Origen y composición*: período inicial y final, detalle mes a mes separando capital de intereses, tasa aplicada y su fundamento, total reclamado
3. *Firmas*: administrador **y aprobación del consejo de propietarios** si existe — sin esto no es título ejecutivo
4. *Respaldo*: referencia a los recibos impagos, intimaciones previas y su resultado, dónde está la documentación

**Coeficientes:** salen del reglamento de propiedad horizontal y **no se pueden cambiar sin unanimidad en asamblea**. Dato protegido, con auditoría de cambios.

**Intereses:** sin anatocismo. La tasa y su fundamento quedan registrados en cada movimiento porque el certificado los exige.

---

## 6. Qué NO vamos a hacer, y por qué

**Liquidación de sueldos SUTERH.** Es lo que más horas le ahorra al administrador, y por eso duele dejarlo afuera. Pero: escalas del CCT 589/10 que cambian con cada paritaria, categorías por función según servicios centrales, antigüedad, plus de residuos y clasificación, vivienda, horas extra con topes, SAC, vacaciones, aportes a SUTERH/FATERYH/SERACARH, F931 y libro de sueldos digital ante ARCA. Un error de cálculo no es un bug: es un juicio laboral.

En la Fase 4, el costo laboral entra como rubro de gasto para que la liquidación cierre. La administradora sigue liquidando sueldos donde lo hace hoy. Revisar solo si un cliente lo pide como condición de compra.

**Tampoco:** pasarela de pagos con comisiones, app móvil nativa, contabilidad de partida doble completa, IA sobre facturas. Todo eso es Capa 1 tardía o competir de frente con CONSO, y no es donde tenés ventaja.

---

## 7. Fuentes

- [Ley 941 CABA — obligaciones del administrador](https://conso.com.ar/blog/legislacion/ley-941-obligaciones-administrador-caba)
- [Disposición 1129/DGDYPC/26 — altas de consorcios en 30 días](https://ligadelconsorcista.org/caba-administradores-obligaciones-disposicion-1129-2026)
- [Guía de expensas — contenido obligatorio de la liquidación](https://www.ramosestudio.com.ar/guia-expensas/)
- [Certificado de deuda por expensas — requisitos](https://conso.com.ar/blog/guias/certificado-de-deuda-por-expensas)
- [Asambleas virtuales — validez y requisitos](https://www.ramosestudio.com.ar/blog/asambleas-virtuales-consorcios-guia/)
- [KM44 — features y precios](https://expensas.km44.com.ar/)
- [Comparativa de software de administración 2026](https://conso.com.ar/blog/herramientas/mejor-software-administracion-edificios-argentina)
- [Composición del sueldo del encargado (CCT 589/10)](https://consorzi.net/asi-esta-compuesto-el-sueldo-del-encargado-del-edificio/)
