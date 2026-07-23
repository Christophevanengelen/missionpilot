export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      agent_runs: {
        Row: {
          correlation_id: string;
          entity_id: string | null;
          entity_type: string | null;
          error_code: string | null;
          error_summary: string | null;
          estimated_cost: number;
          finished_at: string | null;
          id: string;
          started_at: string;
          status: string;
          user_id: string;
          workflow_name: string;
          workflow_version: string;
        };
        Insert: {
          correlation_id: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error_code?: string | null;
          error_summary?: string | null;
          estimated_cost?: number;
          finished_at?: string | null;
          id?: string;
          started_at?: string;
          status?: string;
          user_id: string;
          workflow_name: string;
          workflow_version: string;
        };
        Update: {
          correlation_id?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          error_code?: string | null;
          error_summary?: string | null;
          estimated_cost?: number;
          finished_at?: string | null;
          id?: string;
          started_at?: string;
          status?: string;
          user_id?: string;
          workflow_name?: string;
          workflow_version?: string;
        };
        Relationships: [];
      };
      agent_steps: {
        Row: {
          attempt: number;
          created_at: string;
          error: string | null;
          id: string;
          input_hash: string | null;
          latency_ms: number | null;
          model: string | null;
          output_hash: string | null;
          prompt_version: string | null;
          provider: string | null;
          run_id: string;
          schema_valid: boolean | null;
          status: string;
          step_name: string;
          token_usage: Json | null;
        };
        Insert: {
          attempt?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          input_hash?: string | null;
          latency_ms?: number | null;
          model?: string | null;
          output_hash?: string | null;
          prompt_version?: string | null;
          provider?: string | null;
          run_id: string;
          schema_valid?: boolean | null;
          status?: string;
          step_name: string;
          token_usage?: Json | null;
        };
        Update: {
          attempt?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          input_hash?: string | null;
          latency_ms?: number | null;
          model?: string | null;
          output_hash?: string | null;
          prompt_version?: string | null;
          provider?: string | null;
          run_id?: string;
          schema_valid?: boolean | null;
          status?: string;
          step_name?: string;
          token_usage?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_steps_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "agent_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_profiles: {
        Row: {
          allowed_work_regions: Json;
          base_currency: string | null;
          created_at: string;
          current_version_id: string | null;
          display_name: string | null;
          hard_exclusions: Json;
          id: string;
          languages: Json;
          minimum_day_rate: number | null;
          preferred_engagement_types: Json;
          remote_policy: string | null;
          status: string;
          target_day_rate: number | null;
          target_role_families: Json;
          timezone_overlap: string | null;
          travel_tolerance: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allowed_work_regions?: Json;
          base_currency?: string | null;
          created_at?: string;
          current_version_id?: string | null;
          display_name?: string | null;
          hard_exclusions?: Json;
          id?: string;
          languages?: Json;
          minimum_day_rate?: number | null;
          preferred_engagement_types?: Json;
          remote_policy?: string | null;
          status?: string;
          target_day_rate?: number | null;
          target_role_families?: Json;
          timezone_overlap?: string | null;
          travel_tolerance?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allowed_work_regions?: Json;
          base_currency?: string | null;
          created_at?: string;
          current_version_id?: string | null;
          display_name?: string | null;
          hard_exclusions?: Json;
          id?: string;
          languages?: Json;
          minimum_day_rate?: number | null;
          preferred_engagement_types?: Json;
          remote_policy?: string | null;
          status?: string;
          target_day_rate?: number | null;
          target_role_families?: Json;
          timezone_overlap?: string | null;
          travel_tolerance?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_current_version_same_profile";
            columns: ["id", "current_version_id"];
            isOneToOne: false;
            referencedRelation: "profile_versions";
            referencedColumns: ["profile_id", "id"];
          },
        ];
      };
      claim_evidence_links: {
        Row: {
          claim_id: string;
          created_at: string;
          detach_reason: string | null;
          detached_at: string | null;
          evidence_id: string;
          id: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          detach_reason?: string | null;
          detached_at?: string | null;
          evidence_id: string;
          id?: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          detach_reason?: string | null;
          detached_at?: string | null;
          evidence_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_evidence_links_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "profile_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_evidence_links_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence_items";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence_items: {
        Row: {
          created_at: string;
          end_date: string | null;
          id: string;
          metrics: Json;
          organization: string | null;
          profile_id: string;
          role_played: string | null;
          source_reference: string | null;
          source_type: string;
          start_date: string | null;
          state: string;
          statement: string;
          tags: string[];
          title: string;
          type: string;
          updated_at: string;
          verification_status: string;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          metrics?: Json;
          organization?: string | null;
          profile_id: string;
          role_played?: string | null;
          source_reference?: string | null;
          source_type: string;
          start_date?: string | null;
          state?: string;
          statement: string;
          tags?: string[];
          title: string;
          type: string;
          updated_at?: string;
          verification_status?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          metrics?: Json;
          organization?: string | null;
          profile_id?: string;
          role_played?: string | null;
          source_reference?: string | null;
          source_type?: string;
          start_date?: string | null;
          state?: string;
          statement?: string;
          tags?: string[];
          title?: string;
          type?: string;
          updated_at?: string;
          verification_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_items_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "candidate_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_claims: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          origin: string;
          previous_claim_id: string | null;
          profile_id: string;
          state: string;
          superseded_at: string | null;
          superseded_by_claim_id: string | null;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          origin?: string;
          previous_claim_id?: string | null;
          profile_id: string;
          state?: string;
          superseded_at?: string | null;
          superseded_by_claim_id?: string | null;
          updated_at?: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          origin?: string;
          previous_claim_id?: string | null;
          profile_id?: string;
          state?: string;
          superseded_at?: string | null;
          superseded_by_claim_id?: string | null;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "profile_claims_previous_claim_id_fkey";
            columns: ["previous_claim_id"];
            isOneToOne: false;
            referencedRelation: "profile_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_claims_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "candidate_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_claims_superseded_by_claim_id_fkey";
            columns: ["superseded_by_claim_id"];
            isOneToOne: false;
            referencedRelation: "profile_claims";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_versions: {
        Row: {
          change_summary: string;
          content: Json;
          content_hash: string;
          created_from_version_id: string | null;
          id: string;
          profile_id: string;
          published_at: string;
          version_number: number;
        };
        Insert: {
          change_summary: string;
          content: Json;
          content_hash: string;
          created_from_version_id?: string | null;
          id?: string;
          profile_id: string;
          published_at?: string;
          version_number: number;
        };
        Update: {
          change_summary?: string;
          content?: Json;
          content_hash?: string;
          created_from_version_id?: string | null;
          id?: string;
          profile_id?: string;
          published_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profile_versions_created_from_version_id_fkey";
            columns: ["created_from_version_id"];
            isOneToOne: false;
            referencedRelation: "profile_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_versions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "candidate_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      system_health_results: {
        Row: {
          ai_mock_ok: boolean;
          checked_at: string;
          db_ok: boolean;
          details: Json | null;
          id: string;
          idempotency_key: string;
          run_id: string | null;
          user_id: string;
        };
        Insert: {
          ai_mock_ok: boolean;
          checked_at?: string;
          db_ok: boolean;
          details?: Json | null;
          id?: string;
          idempotency_key: string;
          run_id?: string | null;
          user_id: string;
        };
        Update: {
          ai_mock_ok?: boolean;
          checked_at?: string;
          db_ok?: boolean;
          details?: Json | null;
          id?: string;
          idempotency_key?: string;
          run_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "system_health_results_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "agent_runs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      build_profile_snapshot: { Args: { p_profile_id: string }; Returns: Json };
      publish_profile_version: {
        Args: {
          p_change_summary: string;
          p_created_from_version_id?: string;
          p_profile_id: string;
        };
        Returns: Json;
      };
      replace_profile_claim: {
        Args: {
          p_claim_to_supersede?: string;
          p_kind: string;
          p_origin?: string;
          p_profile_id: string;
          p_value: Json;
        };
        Returns: string;
      };
      restore_profile_version: {
        Args: {
          p_change_summary: string;
          p_profile_id: string;
          p_version_id: string;
        };
        Returns: Json;
      };
      snapshot_content_hash: { Args: { p_content: Json }; Returns: string };
      validate_claim_value: {
        Args: { p_kind: string; p_value: Json };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
