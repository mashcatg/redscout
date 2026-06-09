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
      admin_prompts: {
        Row: {
          content: string
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content: string
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_call_logs: {
        Row: {
          api_platform: string
          cost_usd: number | null
          created_at: string
          endpoint: string | null
          error_message: string | null
          feature: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          ok: boolean
          operation: string
          org_id: string | null
          output_tokens: number | null
          request_meta: Json
          response_meta: Json
          status_code: number | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          api_platform: string
          cost_usd?: number | null
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          feature: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          ok?: boolean
          operation: string
          org_id?: string | null
          output_tokens?: number | null
          request_meta?: Json
          response_meta?: Json
          status_code?: number | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          api_platform?: string
          cost_usd?: number | null
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          feature?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          ok?: boolean
          operation?: string
          org_id?: string | null
          output_tokens?: number | null
          request_meta?: Json
          response_meta?: Json
          status_code?: number | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          created_at: string
          dodo_customer_id: string | null
          email: string
          id: string
          name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dodo_customer_id?: string | null
          email: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dodo_customer_id?: string | null
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          customer_id: string
          dodo_payment_id: string
          id: string
          invoice_id: string | null
          raw_payload: Json
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          customer_id: string
          dodo_payment_id: string
          id?: string
          invoice_id?: string | null
          raw_payload?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          customer_id?: string
          dodo_payment_id?: string
          id?: string
          invoice_id?: string | null
          raw_payload?: Json
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          competitors_limit: number
          created_at: string
          customer_id: string
          dodo_subscription_id: string
          id: string
          keywords_limit: number
          plan: Database["public"]["Enums"]["plan_type"]
          projects_limit: number
          raw_payload: Json
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          competitors_limit: number
          created_at?: string
          customer_id: string
          dodo_subscription_id: string
          id?: string
          keywords_limit: number
          plan: Database["public"]["Enums"]["plan_type"]
          projects_limit: number
          raw_payload?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          competitors_limit?: number
          created_at?: string
          customer_id?: string
          dodo_subscription_id?: string
          id?: string
          keywords_limit?: number
          plan?: Database["public"]["Enums"]["plan_type"]
          projects_limit?: number
          raw_payload?: Json
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_personalities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instructions: string
          label: string
          org_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instructions: string
          label: string
          org_id: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string
          label?: string
          org_id?: string
          slug?: string
        }
        Relationships: []
      }
      competitors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_reddit_scan_at: string | null
          name: string
          next_reddit_scan_at: string | null
          org_id: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_reddit_scan_at?: string | null
          name: string
          next_reddit_scan_at?: string | null
          org_id: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_reddit_scan_at?: string | null
          name?: string
          next_reddit_scan_at?: string | null
          org_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_campaigns: {
        Row: {
          created_at: string
          first_level_only: boolean
          id: string
          message_template: string
          name: string
          org_id: string
          post_author: string | null
          post_body: string | null
          post_subreddit: string | null
          post_title: string | null
          post_url: string | null
          queued_at: string | null
          sent_at: string | null
          skip_if_dmed: boolean
          skip_post_author: boolean
          status: string
          subreddit: string | null
          target_username: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_level_only?: boolean
          id?: string
          message_template: string
          name: string
          org_id: string
          post_author?: string | null
          post_body?: string | null
          post_subreddit?: string | null
          post_title?: string | null
          post_url?: string | null
          queued_at?: string | null
          sent_at?: string | null
          skip_if_dmed?: boolean
          skip_post_author?: boolean
          status?: string
          subreddit?: string | null
          target_username?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_level_only?: boolean
          id?: string
          message_template?: string
          name?: string
          org_id?: string
          post_author?: string | null
          post_body?: string | null
          post_subreddit?: string | null
          post_title?: string | null
          post_url?: string | null
          queued_at?: string | null
          sent_at?: string | null
          skip_if_dmed?: boolean
          skip_post_author?: boolean
          status?: string
          subreddit?: string | null
          target_username?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_leads: {
        Row: {
          campaign_id: string
          comment_body: string | null
          comment_id: string | null
          comment_url: string | null
          contacted_at: string | null
          created_at: string
          id: string
          is_first_level: boolean
          note: string | null
          org_id: string
          post_title: string | null
          post_url: string | null
          reddit_username: string
          skipped: boolean
          status: string
          subreddit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          comment_body?: string | null
          comment_id?: string | null
          comment_url?: string | null
          contacted_at?: string | null
          created_at?: string
          id?: string
          is_first_level?: boolean
          note?: string | null
          org_id: string
          post_title?: string | null
          post_url?: string | null
          reddit_username: string
          skipped?: boolean
          status?: string
          subreddit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          comment_body?: string | null
          comment_id?: string | null
          comment_url?: string | null
          contacted_at?: string | null
          created_at?: string
          id?: string
          is_first_level?: boolean
          note?: string | null
          org_id?: string
          post_title?: string | null
          post_url?: string | null
          reddit_username?: string
          skipped?: boolean
          status?: string
          subreddit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_message_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message_body: string
          org_id: string
          reddit_url: string | null
          reddit_username: string
          sent_at: string | null
          status: string
          subreddit: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_body: string
          org_id: string
          reddit_url?: string | null
          reddit_username: string
          sent_at?: string | null
          status?: string
          subreddit?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_body?: string
          org_id?: string
          reddit_url?: string | null
          reddit_username?: string
          sent_at?: string | null
          status?: string
          subreddit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_message_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_message_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_message_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          archived_at: string | null
          author: string | null
          body: string | null
          competitor_id: string | null
          created_at: string
          generated_comment: string | null
          google_position: number | null
          hidden_keyword_id: string | null
          id: string
          is_read: boolean
          keyword_id: string | null
          num_comments: number | null
          org_id: string
          reddit_created_at: string | null
          reddit_post_id: string
          reddit_url: string
          relevance_score: number | null
          replied_at: string | null
          saved_at: string | null
          score_reason: string | null
          serp_keyword: string | null
          source: string
          status: Database["public"]["Enums"]["inbox_status"]
          subreddit: string | null
          title: string
          upvote_ratio: number | null
          upvotes: number | null
        }
        Insert: {
          archived_at?: string | null
          author?: string | null
          body?: string | null
          competitor_id?: string | null
          created_at?: string
          generated_comment?: string | null
          google_position?: number | null
          hidden_keyword_id?: string | null
          id?: string
          is_read?: boolean
          keyword_id?: string | null
          num_comments?: number | null
          org_id: string
          reddit_created_at?: string | null
          reddit_post_id: string
          reddit_url: string
          relevance_score?: number | null
          replied_at?: string | null
          saved_at?: string | null
          score_reason?: string | null
          serp_keyword?: string | null
          source: string
          status?: Database["public"]["Enums"]["inbox_status"]
          subreddit?: string | null
          title: string
          upvote_ratio?: number | null
          upvotes?: number | null
        }
        Update: {
          archived_at?: string | null
          author?: string | null
          body?: string | null
          competitor_id?: string | null
          created_at?: string
          generated_comment?: string | null
          google_position?: number | null
          hidden_keyword_id?: string | null
          id?: string
          is_read?: boolean
          keyword_id?: string | null
          num_comments?: number | null
          org_id?: string
          reddit_created_at?: string | null
          reddit_post_id?: string
          reddit_url?: string
          relevance_score?: number | null
          replied_at?: string | null
          saved_at?: string | null
          score_reason?: string | null
          serp_keyword?: string | null
          source?: string
          status?: Database["public"]["Enums"]["inbox_status"]
          subreddit?: string | null
          title?: string
          upvote_ratio?: number | null
          upvotes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          is_paused: boolean
          keyword: string
          last_reddit_scan_at: string | null
          last_serp_scan_at: string | null
          match_type: string
          next_reddit_scan_at: string | null
          next_serp_scan_at: string | null
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_paused?: boolean
          keyword: string
          last_reddit_scan_at?: string | null
          last_serp_scan_at?: string | null
          match_type?: string
          next_reddit_scan_at?: string | null
          next_serp_scan_at?: string | null
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_paused?: boolean
          keyword?: string
          last_reddit_scan_at?: string | null
          last_serp_scan_at?: string | null
          match_type?: string
          next_reddit_scan_at?: string | null
          next_serp_scan_at?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          favicon_url: string | null
          id: string
          name: string
          owner_id: string
          product_description: string | null
          product_name: string | null
          training_notes: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          name: string
          owner_id: string
          product_description?: string | null
          product_name?: string | null
          training_notes?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          product_description?: string | null
          product_name?: string | null
          training_notes?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_jobs: {
        Row: {
          created_at: string
          entity_id: string
          error_message: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type_enum"]
          last_run_at: string | null
          next_run_at: string
          org_id: string
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          error_message?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["job_type_enum"]
          last_run_at?: string | null
          next_run_at?: string
          org_id: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          error_message?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type_enum"]
          last_run_at?: string | null
          next_run_at?: string
          org_id?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scan_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_hidden_keywords: {
        Row: {
          created_at: string
          generation_round: number
          id: string
          keyword: string
          last_used_at: string | null
          org_id: string
        }
        Insert: {
          created_at?: string
          generation_round?: number
          id?: string
          keyword: string
          last_used_at?: string | null
          org_id: string
        }
        Update: {
          created_at?: string
          generation_round?: number
          id?: string
          keyword?: string
          last_used_at?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_hidden_keywords_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keyword_schedule: {
        Row: {
          next_run_at: string
          org_id: string
          seeded: boolean
          updated_at: string
        }
        Insert: {
          next_run_at?: string
          org_id: string
          seeded?: boolean
          updated_at?: string
        }
        Update: {
          next_run_at?: string
          org_id?: string
          seeded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_warmup_selections: {
        Row: {
          created_at: string
          id: string
          org_id: string
          subreddit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          subreddit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          subreddit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warmup_selections_subreddit_id_fkey"
            columns: ["subreddit_id"]
            isOneToOne: false
            referencedRelation: "warmup_subreddits"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_until: string | null
          avatar_url: string | null
          created_at: string
          delete_at: string | null
          email: string
          id: string
          name: string | null
          pass_type: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          subscription_status: string
          updated_at: string
        }
        Insert: {
          access_until?: string | null
          avatar_url?: string | null
          created_at?: string
          delete_at?: string | null
          email: string
          id: string
          name?: string | null
          pass_type?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          access_until?: string | null
          avatar_url?: string | null
          created_at?: string
          delete_at?: string | null
          email?: string
          id?: string
          name?: string | null
          pass_type?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      warmup_engagements: {
        Row: {
          created_at: string
          engaged_at: string
          id: string
          org_id: string
          post_id: string
          status: string
          subreddit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engaged_at?: string
          id?: string
          org_id: string
          post_id: string
          status?: string
          subreddit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          engaged_at?: string
          id?: string
          org_id?: string
          post_id?: string
          status?: string
          subreddit_id?: string
          user_id?: string
        }
        Relationships: []
      }
      warmup_scans: {
        Row: {
          credits_used: number | null
          id: string
          posts: Json
          scanned_at: string
          subreddit_id: string
        }
        Insert: {
          credits_used?: number | null
          id?: string
          posts?: Json
          scanned_at?: string
          subreddit_id: string
        }
        Update: {
          credits_used?: number | null
          id?: string
          posts?: Json
          scanned_at?: string
          subreddit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warmup_scans_subreddit_id_fkey"
            columns: ["subreddit_id"]
            isOneToOne: false
            referencedRelation: "warmup_subreddits"
            referencedColumns: ["id"]
          },
        ]
      }
      warmup_subreddits: {
        Row: {
          allows_body: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          rules: string | null
          updated_at: string
        }
        Insert: {
          allows_body?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          rules?: string | null
          updated_at?: string
        }
        Update: {
          allows_body?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          rules?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      claim_next_dm_lead: {
        Args: { _campaign_id: string }
        Returns: {
          comment_body: string
          comment_id: string
          comment_url: string
          id: string
          is_first_level: boolean
          org_id: string
          post_title: string
          post_url: string
          reddit_username: string
          subreddit: string
        }[]
      }
      claim_scan_jobs: {
        Args: {
          _limit?: number
          _org_id: string
          _running_timeout_minutes?: number
        }
        Returns: {
          entity_id: string
          id: string
          job_type: Database["public"]["Enums"]["job_type_enum"]
        }[]
      }
      create_dm_campaign: {
        Args: {
          _first_level_only?: boolean
          _message_template: string
          _name: string
          _org_id: string
          _post_author?: string
          _post_subreddit?: string
          _post_title?: string
          _post_url?: string
          _skip_if_dmed?: boolean
          _skip_post_author?: boolean
          _status?: string
          _user_id: string
        }
        Returns: {
          created_at: string
          first_level_only: boolean
          id: string
          message_template: string
          name: string
          org_id: string
          post_author: string | null
          post_body: string | null
          post_subreddit: string | null
          post_title: string | null
          post_url: string | null
          queued_at: string | null
          sent_at: string | null
          skip_if_dmed: boolean
          skip_post_author: boolean
          status: string
          subreddit: string | null
          target_username: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dm_campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_org_with_seed: { Args: { _payload: Json }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      plan_limits: {
        Args: { _plan: string }
        Returns: {
          max_competitors: number
          max_keywords: number
          max_orgs: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "member"
      inbox_status: "new" | "saved" | "replied" | "dismissed" | "archived"
      job_status: "pending" | "running" | "done" | "failed"
      job_type_enum:
        | "keyword_serp"
        | "keyword_reddit"
        | "competitor_reddit"
        | "competitor_serp"
      member_role: "owner" | "admin" | "member"
      plan_type: "starter" | "growth" | "agency"
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
    Enums: {
      app_role: ["admin", "member"],
      inbox_status: ["new", "saved", "replied", "dismissed", "archived"],
      job_status: ["pending", "running", "done", "failed"],
      job_type_enum: [
        "keyword_serp",
        "keyword_reddit",
        "competitor_reddit",
        "competitor_serp",
      ],
      member_role: ["owner", "admin", "member"],
      plan_type: ["starter", "growth", "agency"],
    },
  },
} as const
