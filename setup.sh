#!/usr/bin/env bash
# =============================================================================
# setup.sh — Prepara consorcios-app en Ubuntu
# =============================================================================
# Uso:  chmod +x setup.sh && ./setup.sh
# No instala nada sin preguntar salvo las dependencias npm del proyecto.
# =============================================================================
set -euo pipefail

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YEL=$'\033[1;33m'; BLU=$'\033[0;34m'; NC=$'\033[0m'
ok()   { echo "${GRN}✓${NC} $*"; }
warn() { echo "${YEL}!${NC} $*"; }
err()  { echo "${RED}✗${NC} $*" >&2; }
step() { echo; echo "${BLU}▸ $*${NC}"; }

cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
step "1/5 · Verificando Node.js"
# ---------------------------------------------------------------------------
NEED_NODE=20
if ! command -v node >/dev/null 2>&1; then
  err "Node.js no está instalado."
  echo "   Instalalo con:"
  echo "     curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "     sudo apt-get install -y nodejs"
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt "$NEED_NODE" ]; then
  err "Node $(node -v) es muy viejo. Next.js 16 necesita Node >= ${NEED_NODE} (recomendado 22 LTS)."
  echo "     curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "     sudo apt-get install -y nodejs"
  exit 1
fi
ok "Node $(node -v) · npm $(npm -v)"

# ---------------------------------------------------------------------------
step "2/5 · Instalando dependencias"
# ---------------------------------------------------------------------------
if [ -f package-lock.json ]; then
  npm ci || { warn "npm ci falló, reintentando con npm install"; npm install; }
else
  npm install
fi
ok "Dependencias instaladas ($(ls node_modules | wc -l) paquetes)"

# ---------------------------------------------------------------------------
step "3/5 · Configurando variables de entorno"
# ---------------------------------------------------------------------------
if [ ! -f .env.example ]; then
  cat > .env.example <<'EOF'
# --- Supabase (Dashboard → Project Settings → API) ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# --- App ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# --- Secreto para crear administradores (OBLIGATORIO) ---
# Generar con: openssl rand -hex 32
ADMIN_CREATE_SECRET=

# --- Email (opcional) ---
RESEND_API_KEY=

# --- SOLO DESARROLLO: desactiva TODO el middleware de seguridad ---
# DISABLE_AUTH=true
EOF
  ok ".env.example creado"
fi

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
    sed -i "s|^ADMIN_CREATE_SECRET=.*|ADMIN_CREATE_SECRET=${SECRET}|" .env.local
    ok "ADMIN_CREATE_SECRET generado automáticamente"
  fi
  warn ".env.local creado — falta completar las claves de Supabase antes de seguir"
  MISSING_ENV=1
else
  ok ".env.local ya existe"
  MISSING_ENV=0
  for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ADMIN_CREATE_SECRET; do
    if ! grep -qE "^${v}=.+" .env.local; then
      warn "Falta o está vacía: ${v}"
      MISSING_ENV=1
    fi
  done
  if grep -qE "^DISABLE_AUTH=true" .env.local; then
    warn "DISABLE_AUTH=true está activo — el middleware de seguridad queda DESACTIVADO. Nunca usar en producción."
  fi
fi

# ---------------------------------------------------------------------------
step "4/5 · Chequeos de calidad"
# ---------------------------------------------------------------------------
if npx --no-install tsc --noEmit 2>&1 | tail -20; then
  ok "TypeScript sin errores"
else
  warn "TypeScript reportó errores (ver arriba)"
fi

npm run lint 2>&1 | tail -20 || warn "ESLint reportó problemas"

# ---------------------------------------------------------------------------
step "5/5 · Listo"
# ---------------------------------------------------------------------------
echo
if [ "${MISSING_ENV:-0}" -eq 1 ]; then
  echo "${YEL}Antes de arrancar:${NC}"
  echo "  1. Completá .env.local con tus claves de Supabase"
  echo "  2. Aplicá supabase/schema.sql + los parches de SETUP.md §4.2 en el SQL Editor"
  echo "  3. npm run dev"
else
  echo "${GRN}Todo listo.${NC} Arrancá con:  npm run dev    →  http://localhost:3000"
  echo
  echo "Si el login entra en loop de redirect, es el bug conocido de CONTEXT.md §5."
  echo "Workaround temporal para desarrollo: agregar DISABLE_AUTH=true a .env.local"
fi
echo
echo "Documentación:  CONTEXT.md (auditoría y arquitectura) · SETUP.md (setup detallado)"
