# SETUP.md — Levantar consorcios-app en Ubuntu

> **Nota de honestidad:** el entorno donde se hizo la auditoría no tenía acceso al registry de npm, así que **`npm ci` y `next build` no se ejecutaron**. El schema SQL sí se verificó ejecutándolo contra PostgreSQL 16 real. Los pasos de abajo están armados leyendo `package.json`, `next.config.ts` y `ecosystem.config.js`; si algo falla, está anotado en §6 qué esperar.

---

## 1. Requisitos

| Componente | Versión | Por qué |
|---|---|---|
| Node.js | **≥ 20.9**, recomendado **22 LTS** | Next.js 16 no soporta Node 18 |
| npm | ≥ 10 | viene con Node 22 |
| Cuenta Supabase | free tier alcanza | DB + Auth + Storage |
| Cuenta Resend | opcional | emails de mora (hoy comentados en el código) |

---

## 2. Instalación rápida

```bash
# --- Node 22 vía NodeSource (Ubuntu 22.04 / 24.04) ---
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v      # esperado: v22.x / 10.x

# --- Proyecto ---
git clone https://github.com/PabloMunozDaVinci/consorcios-app.git
cd consorcios-app
npm ci                 # usa package-lock.json; si falla, npm install

# --- Variables de entorno ---
cp .env.example .env.local    # crear el .env.example primero, ver §3
nano .env.local               # completar con tus claves

# --- Levantar en dev ---
npm run dev                   # http://localhost:3000
```

También podés usar `./setup.sh` (en la raíz del repo) que hace lo mismo con verificaciones.

---

## 3. Variables de entorno

Crear `.env.local` en la raíz (está en `.gitignore`, **nunca commitearlo**):

```bash
# --- Supabase ---
# Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...     # ⚠️ secreto, saltea RLS, solo server-side

# --- App ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # en prod: https://tudominio.com

# --- Secreto para crear admins ---
# OBLIGATORIO. Hoy el código tiene un default 'admin-secret-123' que hay que eliminar.
# Generar con: openssl rand -hex 32
ADMIN_CREATE_SECRET=

# --- Email (opcional, el envío está comentado en actions/mora.ts) ---
RESEND_API_KEY=re_xxxxxxxxx

# --- ⚠️ SOLO DESARROLLO ---
# Desactiva TODO el middleware: auth, rate limit, geo-block y security headers.
# NUNCA en producción.
# DISABLE_AUTH=true
```

> **Sobre `DISABLE_AUTH`:** con el código tal como está hoy, la app **no anda sin este flag** — el login guarda la sesión en localStorage y el middleware la busca en una cookie que nunca se escribe (ver `CONTEXT.md` §5). Es un workaround para poder ver la app, no una configuración válida.

---

## 4. Base de datos (Supabase)

### 4.1 Crear el proyecto
1. [supabase.com](https://supabase.com) → New Project (elegir región **South America (São Paulo)** por latencia).
2. Guardar la contraseña de la DB.
3. Project Settings → API → copiar `URL`, `anon key` y `service_role key` al `.env.local`.

### 4.2 Aplicar el schema — **con parches**

`supabase/schema.sql` tal como está **tiene errores que impiden crear usuarios y rompen el cálculo de mora** (verificado contra PG16). Aplicá primero el schema y después estos parches, o corregí el archivo antes de pegarlo.

En **SQL Editor** del dashboard de Supabase:

```sql
-- 1) Pegar el contenido completo de supabase/schema.sql
```

```sql
-- 2) PARCHES MÍNIMOS para que la app funcione
--    (ver CONTEXT.md §7.1, §7.2, §7.4 para el detalle de cada uno)

-- 2.1 Permitir admins (propietario sin unidad asignada)
ALTER TABLE propietarios ALTER COLUMN unidad_id DROP NOT NULL;
ALTER TABLE propietarios DROP CONSTRAINT IF EXISTS unique_propietario_por_unidad;
CREATE UNIQUE INDEX unique_propietario_por_unidad
  ON propietarios (unidad_id) WHERE unidad_id IS NOT NULL;

-- 2.2 Arreglar get_saldo_deudor: MIN(a,b) no existe en Postgres → LEAST,
--     y AGE() ignoraba los años (14 meses de deuda se calculaban como 2)
CREATE OR REPLACE FUNCTION get_saldo_deudor(p_unidad_id UUID)
RETURNS TABLE(
  meses_atrasados INTEGER,
  monto_total DECIMAL(12,2),
  ultimo_mes_pagado DATE,
  es_mora BOOLEAN
) AS $$
DECLARE
  v_meses_atrasados INTEGER := 0;
  v_monto_total DECIMAL(12,2) := 0;
  v_ultimo_mes DATE;
  v_edad INTERVAL;
BEGIN
  SELECT MAX(mes_pagado) INTO v_ultimo_mes
  FROM pagos
  WHERE unidad_id = p_unidad_id AND estado = 'confirmado';

  IF v_ultimo_mes IS NULL THEN
    v_ultimo_mes := CURRENT_DATE - INTERVAL '12 months';
  END IF;

  v_edad := AGE(CURRENT_DATE, v_ultimo_mes);
  v_meses_atrasados := LEAST(
    12,
    GREATEST(0, (EXTRACT(YEAR FROM v_edad) * 12 + EXTRACT(MONTH FROM v_edad))::INTEGER)
  );

  -- TODO: el monto sigue hardcodeado. Debe salir de una tabla de expensas
  -- prorrateada por unidades.coeficiente. Ver CONTEXT.md §7.5.
  v_monto_total := v_meses_atrasados * 150000 * 1.20;

  RETURN QUERY SELECT v_meses_atrasados, v_monto_total, v_ultimo_mes, (v_meses_atrasados >= 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

ALTER FUNCTION evaluar_y_actualizar_mora() SET search_path = public, pg_temp;

-- 2.3 Evitar que el seed duplique consorcios en cada corrida
CREATE UNIQUE INDEX IF NOT EXISTS uq_consorcios_nombre_direccion
  ON consorcios (nombre, direccion);

-- 2.4 Triggers de updated_at (8 tablas los tienen declarados y nunca se actualizan)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['consorcios','edificios','unidades','propietarios','arreglos'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;

-- 2.5 Bucket de mantenimiento en privado (hoy las fotos son públicas por URL)
UPDATE storage.buckets SET public = false WHERE id = 'mantenimiento';
```

**Además hay que tocar el código** (no se arregla desde SQL):
- `src/app/api/auth/create-propietario/route.ts:161` → `.select('id, numero, pisos')` debe ser `piso`.
- `src/actions/mora.ts:690` → `.select('id, numero, edificio_id')` debe ser `building_id`.
- `src/actions/consorcios.ts:584` → `getMoraStats()` consulta `unidades.estado_mora`, columna que no existe.
- `src/actions/mora.ts:634` → typo `aptoo_carta`, debe ser `apto_carta`.

### 4.3 Crear el primer administrador

Con el servidor levantado y `ADMIN_CREATE_SECRET` configurado:

```bash
curl -X POST http://localhost:3000/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu@email.com",
    "nombre": "Pablo",
    "sendInvitation": true,
    "secret": "EL_VALOR_DE_ADMIN_CREATE_SECRET"
  }'
```

Si `sendInvitation` es `false`, la respuesta trae `tempPassword` en texto plano. Si es `true`, llega un mail de Supabase para setear la contraseña.

> Con `DISABLE_AUTH` sin setear, este endpoint pide además un JWT válido de admin (`requiresAdmin` lo incluye) — problema del huevo y la gallina para el primer admin. Workaround para el bootstrap: levantar con `DISABLE_AUTH=true`, crear el admin, apagar el flag.

---

## 5. Producción con PM2

```bash
sudo npm install -g pm2
npm run build
```

Antes de arrancar, editar `ecosystem.config.js`: el `cwd` está hardcodeado a `/home/pablo/consorcios-app`. Cambiarlo por la ruta real (o usar `process.cwd()`).

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # ejecutar el comando que imprime, para arranque automático
pm2 logs consorcios-app
```

**nginx delante** (necesario: el proxy confía en `x-real-ip` — spoofeable si no hay un proxy delante que lo setee él mismo; `CONTEXT.md` §6.7, resuelto en el bloque 2):

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        # sobreescribir, NO agregar: evita que el cliente inyecte su propia IP
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Después: `sudo certbot --nginx -d tudominio.com` para HTTPS (el HSTS del middleware solo se activa con `NODE_ENV=production`).

### Checklist antes de exponer a internet
- [ ] `DISABLE_AUTH` **no está** en el `.env` de producción
- [ ] `ADMIN_CREATE_SECRET` seteado con un valor random de 32+ bytes
- [ ] El default `'admin-secret-123'` eliminado del código (`CONTEXT.md` §6.1)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca en una variable `NEXT_PUBLIC_*`
- [ ] `connect-src` del CSP sin `http://localhost:*` (`middleware.ts`)
- [ ] Los `console.log` del login sacados (imprimen el access token en la consola del browser)
- [ ] HTTPS activo
- [ ] Backups de Supabase configurados

---

## 6. Problemas conocidos al levantar

| Síntoma | Causa | Solución |
|---|---|---|
| Loop de redirect a `/login` después de loguearse bien | El middleware busca la cookie `sb-access-token`, que nunca se escribe (`CONTEXT.md` §5) | Workaround: `DISABLE_AUTH=true`. Fix real: migrar a `@supabase/ssr` |
| `Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno` | `.env.local` incompleto o nombre mal escrito | Revisar §3. Next solo relee el `.env` al reiniciar |
| `/api/auth/create-admin` devuelve 500 con `null value in column "unidad_id"` | Bug §7.2 | Aplicar el parche 2.1 |
| `/api/auth/create-propietario` devuelve `column "pisos" does not exist` | Bug §7.3 | Corregir la línea 161 de esa ruta |
| El botón "Evaluar mora" no hace nada | `get_saldo_deudor` tira `function min(integer, integer) does not exist` | Aplicar el parche 2.2 |
| `node test-api.js` → `Cannot find module 'dotenv'` | `dotenv` no está en `package.json` | `npm i -D dotenv`, o borrar el archivo |
| Warnings de Next 16 sobre APIs deprecadas | El proyecto usa Next 16, que tiene breaking changes | Ver `node_modules/next/dist/docs/` (lo pide `AGENTS.md`) |
