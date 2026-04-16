---
name: consorcios-auth
description: >
  Security-hardened authentication and authorization for Consorcios App.
  Trigger: When implementing login, register, protected routes, or auth APIs.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

## When to Use

- Creating login/register pages and APIs
- Protecting routes that require authentication
- Fetching the current user from Supabase Auth
- Linking propietario to auth_user_id
- Any operation that needs user session validation

## Critical Patterns

### 1. Authentication Flow

```
User Login (email/password)
  → Supabase Auth API → JWT Token
  → Client stores token in cookie/localStorage
  → All authenticated requests include JWT in Authorization header
```

### 2. User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Email admin de consorcio | CRUD total, todas las unidades |
| `propietario` | Dueño registrado | Solo su unidad |
| `inquilino` | Inquilino registrado | Solo su unidad (ver pagos) |

### 3. Protected Route Pattern

```typescript
// middleware.ts - ALWAYS validate token
import { createSupabaseClient } from '@/lib/supabase';

export async function middleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Pass user to next middleware
  request.headers.set('x-user-id', data.user.id);
}
```

### 4. Link Auth to Propietario

```typescript
// On login, get propietario from auth_user_id
const { data: propietario } = await supabase
  .from('propietarios')
  .select('*, unidades(*, edificios(*))')
  .eq('auth_user_id', user.id)
  .single();
```

### 5. Secure API Handler Template

```typescript
// api/example/route.ts
export async function POST(request: Request) {
  // 1. Extract and validate token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return Response.json({ error: 'Token requerido' }, { status: 401 });
  }

  // 2. Verify with Supabase
  const supabase = createSupabaseAdmin();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: 'Token inválido' }, { status: 401 });
  }

  // 3. Get propietario linked to this user
  const { data: propietario } = await supabase
    .from('propietarios')
    .select('*, unidades(*)')
    .eq('auth_user_id', user.id)
    .single();

  if (!propietario) {
    return Response.json({ error: 'Usuario no registrado como propietario' }, { status: 403 });
  }

  // 4. Now you have the user - proceed with logic
}
```

### 6. Hardening Rules

| Rule | Why | Implementation |
|------|-----|--------------|
| **Never trust client input** | Injection attacks | Validate on server, not just form |
| **JWT only** | Session hijacking | Use Supabase JWT, not custom tokens |
| **Rate limit** | Brute force | Limit login attempts per IP |
| **HTTPS only** | MITM | Force SSL in prod |
| **No token in URL** | Token leakage | Use header, not query params |

## Code Examples

### Login Page

```typescript
// app/login/page.tsx
'use client';
import { createBrowserClient } from '@/lib/supabase';

export default function LoginPage() {
  const supabase = createBrowserClient();

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    // Redirect based on role
    router.push('/dashboard');
  }
}
```

### Register + Link to Propietario

```typescript
// API: Register new propietario and link to auth user
export async function POST(request: Request) {
  const { email, password, unidad_id, nombre, apellido, dni, telefono } = await request.json();

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password,
  });

  if (authError || !authData.user) {
    return Response.json({ error: authError.message }, { status: 400 });
  }

  // 2. Create propietario linked to auth user
  const { error: propError } = await supabase
    .from('propietarios')
    .insert({
      auth_user_id: authData.user.id,
      unidad_id,
      nombre, apellido, dni,
      email,
      telefono,
    });

  if (propError) {
    // Rollback auth user on failure
    await supabase.auth.admin.deleteUser(authData.user.id);
    return Response.json({ error: propError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

### Get Current User (Client)

```typescript
// hooks/useUser.ts
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export function useUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
```

### Middleware for Routes

```typescript
// middleware.ts
import { createSupabaseClient } from '@/lib/supabase';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip public routes
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/login') || pathname === '/') {
    return;
  }

  // Check auth cookie
  const authCookie = request.cookies.get('sb-auth-token');
  if (!authCookie) {
    return Response.redirect(new URL('/login', request.url));
  }

  // Validate token
  const supabase = createSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(
    JSON.parse(authCookie.value).access_token
  );

  if (error || !user) {
    return Response.redirect(new URL('/login', request.url));
  }

  // Allow request
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/pagos/:path*', '/consorcios/:path*'],
};
```

## Commands

```bash
# Login as admin (for testing)
curl -X POST https://jbikxksdignshfgnbipi.supabase.co/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}'

# Get user info from token
curl https://jbikxksdignshfgnbipi.supabase.co/auth/v1/user \
  -H "Authorization: Bearer <TOKEN>"
```

## Resources

- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **RLS Policies**: See [supabase/schema.sql](../supabase/schema.sql)
- **Client**: See [src/lib/supabase.ts](../src/lib/supabase.ts)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/login/page.tsx` | Create - login form |
| `src/app/register/page.tsx` | Create - register form |
| `src/app/api/auth/login/route.ts` | Create - handle login |
| `src/app/api/auth/register/route.ts` | Create - handle register |
| `src/middleware.ts` | Modify - protect routes |
| `src/lib/supabase.ts` | Modify - add auth helpers |
| `src/hooks/useUser.ts` | Create - user state hook |
| `supabase/schema.sql` | Modify - ensure auth_user_id exists |

## Hardening Checklist

- [ ] Passwords hashed by Supabase (no custom hashing)
- [ ] CSRF protection via Supabase
- [ ] Rate limiting on login endpoint
- [ ] JWT expiry set (default 1 hour)
- [ ] Refresh token rotation enabled
- [ ] Email confirm disabled for admin (optional)
- [ ] RLS policies for propietarios table
- [ ] No sensitive data in client logs