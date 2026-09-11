'use client';

// =============================================================================
// COMPONENT: UploadImage - Upload con Compresión WebP
// =============================================================================
'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UploadImageProps {
  bucket: string;
  path: string;
  onUploadComplete?: (url: string) => void;
  maxSizeMB?: number;
  accept?: string;
  className?: string;
}

export function UploadImage({
  bucket,
  path,
  onUploadComplete,
  maxSizeMB = 2,
  accept = 'image/jpeg,image/png,image/webp',
  className = '',
}: UploadImageProps) {
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------------------
  // Compress Image to WebP
  // ----------------------------------------------------------------
  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        let { width, height } = img;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim);
            width = maxDim;
          } else {
            width = Math.round((width / height) * maxDim);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo crear el contexto de canvas'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('No se pudo convertir a WebP'));
          },
          'image/webp',
          0.8
        );
      };
      
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = URL.createObjectURL(file);
    });
  }

  // ----------------------------------------------------------------
  // Handle File Select
  // ----------------------------------------------------------------
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadedUrl(null);

    if (!accept.split(',').some((type) => file.type.includes(type.split('/')[1]))) {
      setError('Tipo de archivo no válido');
      return;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError(`El archivo excede ${maxSizeMB}MB`);
      return;
    }

    try {
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      setIsCompressing(true);
      setProgress(10);
      
      const compressedBlob = await compressImage(file);
      setProgress(50);

      setIsCompressing(false);
      setIsUploading(true);
      setProgress(60);

      const supabase = createClient();
      if (!supabase) {
        setError('Supabase no configurado');
        return;
      }
      
      const fileName = `${path}/${Date.now()}.webp`;
      
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, compressedBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/webp',
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      // El bucket es privado: sin signed URL no hay forma de ver el archivo.
      // OJO al wirear esto: no persistas esta URL, expira. Guardá `fileName`
      // (el path) y generá una signed URL nueva cada vez que se muestre.
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 60 * 60); // 1 hora

      if (signedError || !signedData) throw signedError ?? new Error('No se pudo generar la URL');

      setProgress(100);
      setUploadedUrl(signedData.signedUrl);
      onUploadComplete?.(signedData.signedUrl);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
    }
  }

  // ----------------------------------------------------------------
  // Handle Click / Remove
  // ----------------------------------------------------------------
  function handleClick() {
    inputRef.current?.click();
  }

  function handleRemove() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setUploadedUrl(null);
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploadedUrl ? (
        <div className="relative rounded-lg overflow-hidden bg-green-50 border border-green-200">
          <img src={uploadedUrl} alt="Uploaded" className="w-full h-40 object-cover" />
          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          {onUploadComplete && (
            <button
              onClick={handleRemove}
              className="absolute top-2 left-2 p-1 bg-white/90 rounded-full hover:bg-white"
              type="button"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed transition-colors
            ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
            ${isUploading || isCompressing ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          {preview && (
            <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
          )}

          {!preview && (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              {isCompressing ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm text-gray-500">Comprimiendo imagen...</p>
                </>
              ) : isUploading ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <p className="text-sm text-gray-500">Subiendo {progress}%...</p>
                  <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">Click para subir imagen</p>
                  <p className="text-xs text-gray-400 mt-1">WebP • Máx {maxSizeMB}MB</p>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-xs py-2 px-3">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HOOK: useImageCompressor
// =============================================================================

export function useImageCompressor() {
  const [isCompressing, setIsCompressing] = useState(false);

  async function compress(
    file: File,
    options?: { maxDimension?: number; quality?: number }
  ): Promise<Blob> {
    setIsCompressing(true);
    const maxDim = options?.maxDimension || 1920;
    const quality = options?.quality || 0.8;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim);
            width = maxDim;
          } else {
            width = Math.round((width / height) * maxDim);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsCompressing(false); reject(new Error('No se pudo crear el contexto')); return; }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            setIsCompressing(false);
            if (blob) resolve(blob);
            else reject(new Error('No se pudo convertir a WebP'));
          },
          'image/webp',
          quality
        );
      };
      
      img.onerror = () => { setIsCompressing(false); reject(new Error('Error al cargar la imagen')); };
      img.src = URL.createObjectURL(file);
    });
  }

  return { compress, isCompressing };
}