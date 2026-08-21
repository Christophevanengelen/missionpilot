export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          correlation_id: string
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          error_summary: string | null
          estimated_cost: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
          user_id: string
          workflow_name: string
          workflow_version: string
        }
        Insert: {
          correlation_id: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_summary?: string | null
          estimated_cost?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id: string
          workflow_name: string
          workflow_version: string
        }
        Update: {
          correlation_id?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_summary?: string | null
          estimated_cost?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          user_id?: string
          workflow_name?: string
          workflow_version?: string
        }
        Relationships: []
      }
      agent_steps: {
        Row: {
          attempt: number
          created_at: string
          error: string | null
          id: string
          input_hash: string | null
          latency_ms: number | null
          model: string | null
          output_hash: string | null
          prompt_version: string | null
          provider: string | null
          run_id: string
          schema_valid: boolean | null
          status: string
          step_name: string
          token_usage: Json | null
        }
        Insert: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          input_hash?: string | null
          latency_ms?: number | null
          model?: string | null
          output_hash?: string | null
          prompt_version?: string | null
          provider?: string | null
          run_id: string
          schema_valid?: boolean | null
          status?: string
          step_name: string
          token_usage?: Json | null
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          input_hash?: string | null
          latency_ms?: number | null
          model?: string | null
          output_hash?: string | null
          prompt_version?: string | null
          provider?: string | null
          run_id?: string
          schema_valid?: boolean | null
          status?: string
          step_name?: string
          token_usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_application_drafts: {
        Row: {
          cover_letter: string
          created_at: string
          cv_variant_id: string | null
          cv_variant_rationale: string | null
          highlights: Json
          id: string
          input_hash: string
          model: string
          needs_review: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
        }
        Insert: {
          cover_letter: string
          created_at?: string
          cv_variant_id?: string | null
          cv_variant_rationale?: string | null
          highlights?: Json
          id?: string
          input_hash: string
          model: string
          needs_review?: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
        }
        Update: {
          cover_letter?: string
          created_at?: string
          cv_variant_id?: string | null
          cv_variant_rationale?: string | null
          highlights?: Json
          id?: string
          input_hash?: string
          model?: string
          needs_review?: boolean
          opportunity_id?: string
          profile_id?: string
          prompt_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_application_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_application_drafts_profile_id_opportunity_id_fkey"
            columns: ["profile_id", "opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["profile_id", "id"]
          },
          {
            foreignKeyName: "ai_application_drafts_variant_same_profile"
            columns: ["profile_id", "cv_variant_id"]
            isOneToOne: false
            referencedRelation: "cv_variants"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      ai_interview_briefs: {
        Row: {
          created_at: string
          id: string
          input_hash: string
          model: string
          needs_review: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
          questions: Json
          talking_points: Json
        }
        Insert: {
          created_at?: string
          id?: string
          input_hash: string
          model: string
          needs_review?: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
          questions?: Json
          talking_points?: Json
        }
        Update: {
          created_at?: string
          id?: string
          input_hash?: string
          model?: string
          needs_review?: boolean
          opportunity_id?: string
          profile_id?: string
          prompt_version?: string
          questions?: Json
          talking_points?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_interview_briefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interview_briefs_profile_id_opportunity_id_fkey"
            columns: ["profile_id", "opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      ai_match_breakdowns: {
        Row: {
          created_at: string
          id: string
          input_hash: string
          model: string
          needs_review: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
          requirements: Json
          summary: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_hash: string
          model: string
          needs_review?: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
          requirements?: Json
          summary: string
        }
        Update: {
          created_at?: string
          id?: string
          input_hash?: string
          model?: string
          needs_review?: boolean
          opportunity_id?: string
          profile_id?: string
          prompt_version?: string
          requirements?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_match_breakdowns_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_breakdowns_profile_id_opportunity_id_fkey"
            columns: ["profile_id", "opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      ai_match_insights: {
        Row: {
          created_at: string
          fit: string
          gaps: Json
          id: string
          input_hash: string
          model: string
          needs_review: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
          rationale: string
          strengths: Json
        }
        Insert: {
          created_at?: string
          fit: string
          gaps?: Json
          id?: string
          input_hash: string
          model: string
          needs_review?: boolean
          opportunity_id: string
          profile_id: string
          prompt_version: string
          rationale: string
          strengths?: Json
        }
        Update: {
          created_at?: string
          fit?: string
          gaps?: Json
          id?: string
          input_hash?: string
          model?: string
          needs_review?: boolean
          opportunity_id?: string
          profile_id?: string
          prompt_version?: string
          rationale?: string
          strengths?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_match_insights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_insights_profile_id_opportunity_id_fkey"
            columns: ["profile_id", "opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_id: string
          event_timestamp: string
          event_type: string
          id: string
          payload: Json
          source: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_timestamp: string
          event_type: string
          id?: string
          payload: Json
          source: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_timestamp?: string
          event_type?: string
          id?: string
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      candidate_profiles: {
        Row: {
          allowed_work_regions: Json
          art9_consent_at: string | null
          base_currency: string | null
          created_at: string
          current_version_id: string | null
          display_name: string | null
          hard_exclusions: Json
          id: string
          languages: Json
          minimum_day_rate: number | null
          preferred_engagement_types: Json
          remote_policy: string | null
          status: string
          target_day_rate: number | null
          target_role_families: Json
          timezone_overlap: string | null
          travel_tolerance: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_work_regions?: Json
          art9_consent_at?: string | null
          base_currency?: string | null
          created_at?: string
          current_version_id?: string | null
          display_name?: string | null
          hard_exclusions?: Json
          id?: string
          languages?: Json
          minimum_day_rate?: number | null
          preferred_engagement_types?: Json
          remote_policy?: string | null
          status?: string
          target_day_rate?: number | null
          target_role_families?: Json
          timezone_overlap?: string | null
          travel_tolerance?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_work_regions?: Json
          art9_consent_at?: string | null
          base_currency?: string | null
          created_at?: string
          current_version_id?: string | null
          display_name?: string | null
          hard_exclusions?: Json
          id?: string
          languages?: Json
          minimum_day_rate?: number | null
          preferred_engagement_types?: Json
          remote_policy?: string | null
          status?: string
          target_day_rate?: number | null
          target_role_families?: Json
          timezone_overlap?: string | null
          travel_tolerance?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_current_version_same_profile"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "profile_versions"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      claim_evidence_links: {
        Row: {
          claim_id: string
          created_at: string
          detach_reason: string | null
          detached_at: string | null
          evidence_id: string
          id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          detach_reason?: string | null
          detached_at?: string | null
          evidence_id: string
          id?: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          detach_reason?: string | null
          detached_at?: string | null
          evidence_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_evidence_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "profile_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_evidence_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_variants: {
        Row: {
          created_at: string
          file_name: string
          headline: string
          id: string
          language: string
          name: string
          profile_id: string
          use_when: string
        }
        Insert: {
          created_at?: string
          file_name: string
          headline: string
          id?: string
          language?: string
          name: string
          profile_id: string
          use_when: string
        }
        Update: {
          created_at?: string
          file_name?: string
          headline?: string
          id?: string
          language?: string
          name?: string
          profile_id?: string
          use_when?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_variants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_subscriptions: {
        Row: {
          created_at: string
          last_sent_at: string | null
          opted_in: boolean
          profile_id: string
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_sent_at?: string | null
          opted_in?: boolean
          profile_id: string
          unsubscribe_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_sent_at?: string | null
          opted_in?: boolean
          profile_id?: string
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_items: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          metrics: Json
          organization: string | null
          profile_id: string
          role_played: string | null
          source_reference: string | null
          source_type: string
          start_date: string | null
          state: string
          statement: string
          tags: string[]
          title: string
          type: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          metrics?: Json
          organization?: string | null
          profile_id: string
          role_played?: string | null
          source_reference?: string | null
          source_type: string
          start_date?: string | null
          state?: string
          statement: string
          tags?: string[]
          title: string
          type: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          metrics?: Json
          organization?: string | null
          profile_id?: string
          role_played?: string | null
          source_reference?: string | null
          source_type?: string
          start_date?: string | null
          state?: string
          statement?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_dismissals: {
        Row: {
          count: number
          profile_id: string
          reason: string
        }
        Insert: {
          count?: number
          profile_id: string
          reason: string
        }
        Update: {
          count?: number
          profile_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_dismissals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          canonical_fingerprint: string
          compensation_currency: string | null
          compensation_max: number | null
          compensation_min: number | null
          compensation_period: string | null
          created_at: string
          description: string | null
          engagement_type: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          location_text: string | null
          organization: string | null
          profile_id: string
          remote_type: string | null
          requirements: Json
          responsibilities: Json
          seniority: string | null
          skills: Json
          source_name: string | null
          source_url: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          canonical_fingerprint: string
          compensation_currency?: string | null
          compensation_max?: number | null
          compensation_min?: number | null
          compensation_period?: string | null
          created_at?: string
          description?: string | null
          engagement_type?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          location_text?: string | null
          organization?: string | null
          profile_id: string
          remote_type?: string | null
          requirements?: Json
          responsibilities?: Json
          seniority?: string | null
          skills?: Json
          source_name?: string | null
          source_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_fingerprint?: string
          compensation_currency?: string | null
          compensation_max?: number | null
          compensation_min?: number | null
          compensation_period?: string | null
          created_at?: string
          description?: string | null
          engagement_type?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          location_text?: string | null
          organization?: string | null
          profile_id?: string
          remote_type?: string | null
          requirements?: Json
          responsibilities?: Json
          seniority?: string | null
          skills?: Json
          source_name?: string | null
          source_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_snapshots: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          opportunity_id: string
          parser_version: string
          profile_id: string
          raw_text: string
          retrieval_method: string
          retrieved_at: string
          source_policy_decision: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          opportunity_id: string
          parser_version: string
          profile_id: string
          raw_text: string
          retrieval_method: string
          retrieved_at?: string
          source_policy_decision?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          parser_version?: string
          profile_id?: string
          raw_text?: string
          retrieval_method?: string
          retrieved_at?: string
          source_policy_decision?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_snapshots_profile_id_opportunity_id_fkey"
            columns: ["profile_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      opportunity_tracking: {
        Row: {
          created_at: string
          follow_up_on: string | null
          id: string
          note: string
          opportunity_id: string
          profile_id: string
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          follow_up_on?: string | null
          id?: string
          note?: string
          opportunity_id: string
          profile_id: string
          stage?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          follow_up_on?: string | null
          id?: string
          note?: string
          opportunity_id?: string
          profile_id?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tracking_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tracking_profile_id_opportunity_id_fkey"
            columns: ["profile_id", "opportunity_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["profile_id", "id"]
          },
        ]
      }
      profile_claims: {
        Row: {
          created_at: string
          id: string
          kind: string
          origin: string
          previous_claim_id: string | null
          profile_id: string
          state: string
          superseded_at: string | null
          superseded_by_claim_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          origin?: string
          previous_claim_id?: string | null
          profile_id: string
          state?: string
          superseded_at?: string | null
          superseded_by_claim_id?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          origin?: string
          previous_claim_id?: string | null
          profile_id?: string
          state?: string
          superseded_at?: string | null
          superseded_by_claim_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "profile_claims_previous_claim_id_fkey"
            columns: ["previous_claim_id"]
            isOneToOne: false
            referencedRelation: "profile_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_claims_superseded_by_claim_id_fkey"
            columns: ["superseded_by_claim_id"]
            isOneToOne: false
            referencedRelation: "profile_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_clarifications: {
        Row: {
          answer: string | null
          asked_at: string
          id: string
          origin: string
          profile_id: string
          question: string
          question_key: string
          settled_at: string | null
          skipped: boolean
        }
        Insert: {
          answer?: string | null
          asked_at?: string
          id?: string
          origin: string
          profile_id: string
          question: string
          question_key: string
          settled_at?: string | null
          skipped?: boolean
        }
        Update: {
          answer?: string | null
          asked_at?: string
          id?: string
          origin?: string
          profile_id?: string
          question?: string
          question_key?: string
          settled_at?: string | null
          skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profile_clarifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_search_plans: {
        Row: {
          computed_at: string
          dossier_hash: string
          plan: Json
          profile_id: string
          prompt_versions: string
        }
        Insert: {
          computed_at?: string
          dossier_hash: string
          plan: Json
          profile_id: string
          prompt_versions: string
        }
        Update: {
          computed_at?: string
          dossier_hash?: string
          plan?: Json
          profile_id?: string
          prompt_versions?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_search_plans_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_versions: {
        Row: {
          change_summary: string
          content: Json
          content_hash: string
          created_from_version_id: string | null
          id: string
          profile_id: string
          published_at: string
          version_number: number
        }
        Insert: {
          change_summary: string
          content: Json
          content_hash: string
          created_from_version_id?: string | null
          id?: string
          profile_id: string
          published_at?: string
          version_number: number
        }
        Update: {
          change_summary?: string
          content?: Json
          content_hash?: string
          created_from_version_id?: string | null
          id?: string
          profile_id?: string
          published_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_versions_created_from_version_id_fkey"
            columns: ["profile_id", "created_from_version_id"]
            isOneToOne: false
            referencedRelation: "profile_versions"
            referencedColumns: ["profile_id", "id"]
          },
          {
            foreignKeyName: "profile_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          plan: string
          polar_customer_id: string | null
          polar_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
          version_timestamp: string
        }
        Insert: {
          current_period_end?: string | null
          plan?: string
          polar_customer_id?: string | null
          polar_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version_timestamp?: string
        }
        Update: {
          current_period_end?: string | null
          plan?: string
          polar_customer_id?: string | null
          polar_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version_timestamp?: string
        }
        Relationships: []
      }
      system_health_results: {
        Row: {
          ai_mock_ok: boolean
          checked_at: string
          db_ok: boolean
          details: Json | null
          id: string
          idempotency_key: string
          run_id: string | null
          user_id: string
        }
        Insert: {
          ai_mock_ok: boolean
          checked_at?: string
          db_ok: boolean
          details?: Json | null
          id?: string
          idempotency_key: string
          run_id?: string | null
          user_id: string
        }
        Update: {
          ai_mock_ok?: boolean
          checked_at?: string
          db_ok?: boolean
          details?: Json | null
          id?: string
          idempotency_key?: string
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_health_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      build_profile_snapshot: { Args: { p_profile_id: string }; Returns: Json }
      ecarter_offre: {
        Args: { p_profile_id: string; p_reason: string }
        Returns: number
      }
      import_opportunity: {
        Args: {
          p_canonical_fingerprint: string
          p_content_hash: string
          p_normalized: Json
          p_parser_version: string
          p_raw_text: string
          p_retrieval_method: string
          p_source_policy_decision: string
        }
        Returns: Json
      }
      publish_profile_version: {
        Args: {
          p_change_summary: string
          p_created_from_version_id?: string
          p_profile_id: string
        }
        Returns: Json
      }
      replace_profile_claim: {
        Args: {
          p_claim_to_supersede?: string
          p_kind: string
          p_origin?: string
          p_profile_id: string
          p_value: Json
        }
        Returns: string
      }
      restore_profile_version: {
        Args: {
          p_change_summary: string
          p_profile_id: string
          p_version_id: string
        }
        Returns: Json
      }
      snapshot_content_hash: { Args: { p_content: Json }; Returns: string }
      validate_claim_value: {
        Args: { p_kind: string; p_value: Json }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

