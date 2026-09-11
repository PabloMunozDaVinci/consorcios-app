export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      administradoras: {
        Row: {
          activa: boolean
          created_at: string
          cuit: string | null
          domicilio: string | null
          email: string | null
          id: string
          logo_url: string | null
          matricula_rpa: string | null
          razon_social: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          cuit?: string | null
          domicilio?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          matricula_rpa?: string | null
          razon_social: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          cuit?: string | null
          domicilio?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          matricula_rpa?: string | null
          razon_social?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string
          id: string
          last_login: string | null
          nombre: string
          permisos: Json | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_login?: string | null
          nombre: string
          permisos?: Json | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_login?: string | null
          nombre?: string
          permisos?: Json | null
        }
        Relationships: []
      }
      arreglos: {
        Row: {
          administradora_id: string
          consorcio_id: string | null
          costo_real: number | null
          created_at: string | null
          descripcion: string | null
          es_area_comun: boolean | null
          estado: Database["public"]["Enums"]["estado_arreglo"] | null
          fecha_aprobacion: string | null
          fecha_completado: string | null
          fecha_inicio: string | null
          fecha_solicitud: string | null
          id: string
          presupuesto: number | null
          prioridad: string | null
          titulo: string
          unidad_id: string | null
          updated_at: string | null
        }
        Insert: {
          administradora_id: string
          consorcio_id?: string | null
          costo_real?: number | null
          created_at?: string | null
          descripcion?: string | null
          es_area_comun?: boolean | null
          estado?: Database["public"]["Enums"]["estado_arreglo"] | null
          fecha_aprobacion?: string | null
          fecha_completado?: string | null
          fecha_inicio?: string | null
          fecha_solicitud?: string | null
          id?: string
          presupuesto?: number | null
          prioridad?: string | null
          titulo: string
          unidad_id?: string | null
          updated_at?: string | null
        }
        Update: {
          administradora_id?: string
          consorcio_id?: string | null
          costo_real?: number | null
          created_at?: string | null
          descripcion?: string | null
          es_area_comun?: boolean | null
          estado?: Database["public"]["Enums"]["estado_arreglo"] | null
          fecha_aprobacion?: string | null
          fecha_completado?: string | null
          fecha_inicio?: string | null
          fecha_solicitud?: string | null
          id?: string
          presupuesto?: number | null
          prioridad?: string | null
          titulo?: string
          unidad_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arreglos_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arreglos_consorcio_id_fkey"
            columns: ["consorcio_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arreglos_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_ips: {
        Row: {
          attempts_count: number | null
          blocked_until: string | null
          country_code: string | null
          created_at: string | null
          id: string
          ip_address: string
          reason: string
        }
        Insert: {
          attempts_count?: number | null
          blocked_until?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          ip_address: string
          reason: string
        }
        Update: {
          attempts_count?: number | null
          blocked_until?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string
          reason?: string
        }
        Relationships: []
      }
      consorcios: {
        Row: {
          administradora_id: string
          ciudad: string | null
          codigo_postal: string | null
          created_at: string | null
          direccion: string
          email_admin: string | null
          id: string
          nombre: string
          provincia: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          administradora_id: string
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion: string
          email_admin?: string | null
          id?: string
          nombre: string
          provincia?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          administradora_id?: string
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion?: string
          email_admin?: string | null
          id?: string
          nombre?: string
          provincia?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcios_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
        ]
      }
      edificios: {
        Row: {
          administradora_id: string
          consortium_id: string
          created_at: string | null
          direccion: string | null
          id: string
          nombre: string | null
          pisos: number | null
          unidades_por_piso: number | null
          updated_at: string | null
        }
        Insert: {
          administradora_id: string
          consortium_id: string
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre?: string | null
          pisos?: number | null
          unidades_por_piso?: number | null
          updated_at?: string | null
        }
        Update: {
          administradora_id?: string
          consortium_id?: string
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre?: string | null
          pisos?: number | null
          unidades_por_piso?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edificios_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edificios_consortium_id_fkey"
            columns: ["consortium_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
        ]
      }
      mora_logs: {
        Row: {
          administradora_id: string
          consorcio_id: string | null
          created_at: string | null
          email_enviado: boolean | null
          estado_anterior: Database["public"]["Enums"]["estado_mora"] | null
          estado_nuevo: Database["public"]["Enums"]["estado_mora"]
          fecha_email: string | null
          id: string
          meses_deuda: number | null
          monto_deuda: number | null
          motivo: string | null
          observaciones: string | null
          propietario_id: string
          unidad_id: string
        }
        Insert: {
          administradora_id: string
          consorcio_id?: string | null
          created_at?: string | null
          email_enviado?: boolean | null
          estado_anterior?: Database["public"]["Enums"]["estado_mora"] | null
          estado_nuevo: Database["public"]["Enums"]["estado_mora"]
          fecha_email?: string | null
          id?: string
          meses_deuda?: number | null
          monto_deuda?: number | null
          motivo?: string | null
          observaciones?: string | null
          propietario_id: string
          unidad_id: string
        }
        Update: {
          administradora_id?: string
          consorcio_id?: string | null
          created_at?: string | null
          email_enviado?: boolean | null
          estado_anterior?: Database["public"]["Enums"]["estado_mora"] | null
          estado_nuevo?: Database["public"]["Enums"]["estado_mora"]
          fecha_email?: string | null
          id?: string
          meses_deuda?: number | null
          monto_deuda?: number | null
          motivo?: string | null
          observaciones?: string | null
          propietario_id?: string
          unidad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mora_logs_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mora_logs_consorcio_id_fkey"
            columns: ["consorcio_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mora_logs_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "propietarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mora_logs_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          administradora_id: string
          consorcio_id: string | null
          created_at: string | null
          estado: string | null
          fecha_pago: string | null
          id: string
          medio_pago: string | null
          mes_pagado: string
          monto: number
          nro_comprobante: string | null
          propietario_id: string
          unidad_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          administradora_id: string
          consorcio_id?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_pago?: string | null
          id?: string
          medio_pago?: string | null
          mes_pagado: string
          monto: number
          nro_comprobante?: string | null
          propietario_id: string
          unidad_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          administradora_id?: string
          consorcio_id?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_pago?: string | null
          id?: string
          medio_pago?: string | null
          mes_pagado?: string
          monto?: number
          nro_comprobante?: string | null
          propietario_id?: string
          unidad_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_consorcio_id_fkey"
            columns: ["consorcio_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "propietarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      propietarios: {
        Row: {
          administradora_id: string
          apellido: string
          auth_user_id: string | null
          celular: string | null
          consorcio_id: string | null
          created_at: string | null
          dni: string
          email: string
          es_dueño_principal: boolean
          id: string
          nombre: string
          porcentaje_propiedad: number
          telefono: string | null
          unidad_id: string | null
          updated_at: string | null
        }
        Insert: {
          administradora_id: string
          apellido: string
          auth_user_id?: string | null
          celular?: string | null
          consorcio_id?: string | null
          created_at?: string | null
          dni: string
          email: string
          es_dueño_principal?: boolean
          id?: string
          nombre: string
          porcentaje_propiedad?: number
          telefono?: string | null
          unidad_id?: string | null
          updated_at?: string | null
        }
        Update: {
          administradora_id?: string
          apellido?: string
          auth_user_id?: string | null
          celular?: string | null
          consorcio_id?: string | null
          created_at?: string | null
          dni?: string
          email?: string
          es_dueño_principal?: boolean
          id?: string
          nombre?: string
          porcentaje_propiedad?: number
          telefono?: string | null
          unidad_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "propietarios_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propietarios_consorcio_id_fkey"
            columns: ["consorcio_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propietarios_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          ip_address: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          ip_address: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          count?: number
          ip_address?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          country_code: string | null
          created_at: string | null
          details: Json | null
          email: string | null
          event_type: string
          id: string
          ip_address: string
          user_agent: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          details?: Json | null
          email?: string | null
          event_type: string
          id?: string
          ip_address: string
          user_agent?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          details?: Json | null
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      unidades: {
        Row: {
          administradora_id: string
          building_id: string
          coeficiente: number | null
          consorcio_id: string
          created_at: string | null
          es_especial: boolean | null
          habitada: boolean | null
          id: string
          metros_cuadrados: number | null
          numero: string
          piso: number
          tipo: Database["public"]["Enums"]["tipo_unidad"]
          updated_at: string | null
        }
        Insert: {
          administradora_id: string
          building_id: string
          coeficiente?: number | null
          consorcio_id: string
          created_at?: string | null
          es_especial?: boolean | null
          habitada?: boolean | null
          id?: string
          metros_cuadrados?: number | null
          numero: string
          piso?: number
          tipo?: Database["public"]["Enums"]["tipo_unidad"]
          updated_at?: string | null
        }
        Update: {
          administradora_id?: string
          building_id?: string
          coeficiente?: number | null
          consorcio_id?: string
          created_at?: string | null
          es_especial?: boolean | null
          habitada?: boolean | null
          id?: string
          metros_cuadrados?: number | null
          numero?: string
          piso?: number
          tipo?: Database["public"]["Enums"]["tipo_unidad"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "edificios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_consorcio_id_fkey"
            columns: ["consorcio_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          administradora_id: string
          auth_user_id: string
          created_at: string
          id: string
          propietario_id: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          administradora_id: string
          auth_user_id: string
          created_at?: string
          id?: string
          propietario_id?: string | null
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          administradora_id?: string
          auth_user_id?: string
          created_at?: string
          id?: string
          propietario_id?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "administradoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "propietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_consorcios: {
        Row: {
          consorcio_id: string
          usuario_id: string
        }
        Insert: {
          consorcio_id: string
          usuario_id: string
        }
        Update: {
          consorcio_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_consorcios_consorcio_id_fkey"
            columns: ["consorcio_id"]
            isOneToOne: false
            referencedRelation: "consorcios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_consorcios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consorcios_asignados: { Args: never; Returns: string[] }
      es_super_admin: { Args: never; Returns: boolean }
      evaluar_y_actualizar_mora: { Args: never; Returns: undefined }
      get_saldo_deudor: {
        Args: { p_unidad_id: string }
        Returns: {
          es_mora: boolean
          meses_atrasados: number
          monto_total: number
          ultimo_mes_pagado: string
        }[]
      }
      mi_administradora_id: { Args: never; Returns: string }
      mi_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      mi_usuario_id: { Args: never; Returns: string }
      puede_consorcio: { Args: { adm: string; cid: string }; Returns: boolean }
      rate_limit_hit: {
        Args: { p_ip: string; p_window_seconds: number }
        Returns: number
      }
      rate_limits_cleanup: { Args: never; Returns: undefined }
    }
    Enums: {
      estado_arreglo:
        | "pendiente"
        | "aprobado"
        | "en_progreso"
        | "completado"
        | "cancelado"
      estado_mora:
        | "al_dia"
        | "deudor"
        | "apto_carta"
        | "inicio_juicio"
        | "juicio_en_curso"
      rol_usuario: "super_admin" | "admin" | "operador" | "propietario"
      tipo_unidad: "depto" | "cochera" | "baulera"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_arreglo: [
        "pendiente",
        "aprobado",
        "en_progreso",
        "completado",
        "cancelado",
      ],
      estado_mora: [
        "al_dia",
        "deudor",
        "apto_carta",
        "inicio_juicio",
        "juicio_en_curso",
      ],
      rol_usuario: ["super_admin", "admin", "operador", "propietario"],
      tipo_unidad: ["depto", "cochera", "baulera"],
    },
  },
} as const
