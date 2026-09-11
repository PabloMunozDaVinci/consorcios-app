-- =============================================================================
-- MIGRACIÓN 003 — Bucket "mantenimiento" privado (Bloque 1, ítem 19)
-- =============================================================================
-- Idempotente. schema.sql creaba el bucket con public=true: las fotos de
-- arreglos quedaban legibles por URL para cualquiera. Lo pasamos a privado y
-- servimos todo por signed URL (ver src/components/UploadImage.tsx).

UPDATE storage.buckets SET public = false WHERE id = 'mantenimiento';

-- Cualquier usuario de `usuarios` activo (gestión de cualquier administradora)
-- puede leer/escribir en el bucket. El scoping por tenant/consorcio de las
-- fotos es tarea de la Fase 2 (reclamos) cuando el bucket tenga una estructura
-- de carpetas real; por ahora esto reemplaza "público para todo internet" por
-- "sólo usuarios autenticados de la app".
DROP POLICY IF EXISTS mantenimiento_usuarios_rw ON storage.objects;
CREATE POLICY mantenimiento_usuarios_rw ON storage.objects FOR ALL
  USING (
    bucket_id = 'mantenimiento'
    AND EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo)
  )
  WITH CHECK (
    bucket_id = 'mantenimiento'
    AND EXISTS (SELECT 1 FROM public.usuarios WHERE auth_user_id = auth.uid() AND activo)
  );
