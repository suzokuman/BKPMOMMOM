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
      daily_reports: {
        Row: {
          created_at: string
          email_sent_at: string | null
          id: string
          payload: Json
          report_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          payload: Json
          report_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_sent_at?: string | null
          id?: string
          payload?: Json
          report_date?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_checks: {
        Row: {
          checked_at: string
          date: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          date: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          checked_at?: string
          date?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_checks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_template_items: {
        Row: {
          carbs_g: number
          created_at: string
          fat_g: number
          fiber_g: number
          id: string
          kcal: number
          name: string
          protein_g: number
          qty: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          kcal?: number
          name: string
          protein_g?: number
          qty?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          kcal?: number
          name?: string
          protein_g?: number
          qty?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          alert_time: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_time?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_time?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_checks: {
        Row: {
          id: string
          scheduled_at: string
          taken: boolean
          taken_at: string | null
          template_id: string
          user_id: string
        }
        Insert: {
          id?: string
          scheduled_at: string
          taken?: boolean
          taken_at?: string | null
          template_id: string
          user_id: string
        }
        Update: {
          id?: string
          scheduled_at?: string
          taken?: boolean
          taken_at?: string | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_checks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "medication_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_templates: {
        Row: {
          active: boolean
          created_at: string
          custom_at: string | null
          dose_mg: number | null
          dose_text: string | null
          frequency: string
          id: string
          name: string
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_at?: string | null
          dose_mg?: number | null
          dose_text?: string | null
          frequency?: string
          id?: string
          name: string
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_at?: string | null
          dose_mg?: number | null
          dose_text?: string | null
          frequency?: string
          id?: string
          name?: string
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          id: string
          kind: string
          ref_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          ref_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          ref_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          daily_report_email: boolean
          enabled: boolean
          goal_alerts: boolean
          protein_reminder_times: string[]
          report_email: string | null
          summary_morning_time: string | null
          summary_night_time: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_report_email?: boolean
          enabled?: boolean
          goal_alerts?: boolean
          protein_reminder_times?: string[]
          report_email?: string | null
          summary_morning_time?: string | null
          summary_night_time?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_report_email?: boolean
          enabled?: boolean
          goal_alerts?: boolean
          protein_reminder_times?: string[]
          report_email?: string | null
          summary_morning_time?: string | null
          summary_night_time?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_goals: {
        Row: {
          created_at: string
          target_carbs_g: number | null
          target_fat_g: number | null
          target_fiber_g: number | null
          target_kcal: number | null
          target_protein_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          target_kcal?: number | null
          target_protein_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          target_kcal?: number | null
          target_protein_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          height_cm: number | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          height_cm?: number | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          height_cm?: number | null
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          mp_preapproval_id: string | null
          plan_period_months: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          mp_preapproval_id?: string | null
          plan_period_months?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          mp_preapproval_id?: string | null
          plan_period_months?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_diary: {
        Row: {
          arm_cm: number | null
          created_at: string
          id: string
          imc: number | null
          notes: string | null
          thigh_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          week_start: string
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          created_at?: string
          id?: string
          imc?: number | null
          notes?: string | null
          thigh_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          week_start: string
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          created_at?: string
          id?: string
          imc?: number | null
          notes?: string | null
          thigh_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          week_start?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      weekly_diary_photos: {
        Row: {
          created_at: string
          diary_id: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diary_id: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          diary_id?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_diary_photos_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "weekly_diary"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
