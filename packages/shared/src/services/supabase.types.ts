// ============================================================
// Supabase database type definitions
// Generated manually to match migration files.
// Run `npx supabase gen types typescript` to auto-generate
// once you have the Supabase CLI connected to your project.
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          level: number;
          xp: number;
          coins: number;
          energy: number;
          last_energy_regen: string;
          total_distance_km: number;
          total_runs: number;
          total_territories_claimed: number;
          streak_days: number;
          last_run_date: string | null;
          // Biometrics — migration 013
          age: number | null;
          gender: 'male' | 'female' | 'other' | null;
          height_cm: number | null;
          weight_kg: number | null;
          // Training preferences
          experience_level: 'new' | 'casual' | 'regular' | 'competitive' | null;
          weekly_frequency: number | null;
          primary_goal: 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete' | null;
          preferred_distance: 'short' | '5k' | '10k' | 'long' | null;
          playstyle: 'conqueror' | 'defender' | 'explorer' | 'social' | null;
          distance_unit: 'km' | 'mi';
          notifications_enabled: boolean;
          weekly_goal_km: number;
          mission_difficulty: 'easy' | 'mixed' | 'hard';
          onboarding_completed_at: string | null;
          phone: string | null;
          subscription_tier: 'free' | 'premium';
          subscription_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };

      runs: {
        Row: {
          id: string;
          user_id: string;
          activity_type: string;
          started_at: string;
          finished_at: string;
          distance_m: number;
          duration_sec: number;
          avg_pace: string;
          gps_points: Json;
          route: string | null;
          territories_claimed: string[];
          territories_fortified: string[];
          xp_earned: number;
          coins_earned: number;
          calories_burned: number | null; // migration 013 — auto-filled by trigger
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['runs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['runs']['Insert']>;
      };

      territories: {
        Row: {
          h3_index: string;
          owner_id: string | null;
          owner_name: string | null;
          defense: number;
          tier: 'bronze' | 'silver' | 'gold' | 'crown';
          captured_at: string | null;
          last_fortified_at: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['territories']['Row'], 'updated_at'> & {
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['territories']['Insert']>;
      };

      feed_posts: {
        Row: {
          id: string;
          user_id: string;
          run_id: string | null;
          content: string | null;
          distance_km: number | null;
          territories_claimed: number | null;
          likes: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['feed_posts']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['feed_posts']['Insert']>;
      };

      feed_post_likes: {
        Row: { post_id: string; user_id: string; created_at: string };
        Insert: Omit<Database['public']['Tables']['feed_post_likes']['Row'], 'created_at'> & { created_at?: string };
        Update: never;
      };

      clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          badge_emoji: string;
          owner_id: string;
          member_count: number;
          total_km: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clubs']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['clubs']['Insert']>;
      };

      club_members: {
        Row: { club_id: string; user_id: string; role: 'owner' | 'admin' | 'member'; joined_at: string };
        Insert: Omit<Database['public']['Tables']['club_members']['Row'], 'joined_at'> & { joined_at?: string };
        Update: Partial<Database['public']['Tables']['club_members']['Insert']>;
      };

      lobbies: {
        Row: {
          id: string;
          club_id: string | null;
          name: string;
          status: 'open' | 'active' | 'closed';
          created_by: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['lobbies']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['lobbies']['Insert']>;
      };

      lobby_messages: {
        Row: { id: string; lobby_id: string; user_id: string; content: string; created_at: string };
        Insert: Omit<Database['public']['Tables']['lobby_messages']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };

      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          event_type: 'territory-war' | 'king-of-hill' | 'survival' | 'brand-challenge' | 'community';
          starts_at: string;
          ends_at: string;
          location: string | null;
          location_name: string | null;
          distance_m: number | null;
          participant_count: number;
          xp_multiplier: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };

      event_participants: {
        Row: { event_id: string; user_id: string; joined_at: string };
        Insert: Omit<Database['public']['Tables']['event_participants']['Row'], 'joined_at'> & { joined_at?: string };
        Update: never;
      };

      mission_progress: {
        Row: {
          id: string;
          user_id: string;
          mission_type: string;
          current_value: number;
          completed: boolean;
          claimed: boolean;
          expires_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['mission_progress']['Row'], 'updated_at'> & { updated_at?: string };
        Update: Partial<Database['public']['Tables']['mission_progress']['Insert']>;
      };
    };

    Views: {
      leaderboard_weekly: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          level: number;
          weekly_xp: number;
          weekly_km: number;
          weekly_territories: number;
          rank: number;
        };
      };
    };

    Functions: {
      toggle_like: {
        Args: { p_post_id: string; p_user_id: string };
        Returns: boolean;
      };
      claim_territory: {
        Args: {
          p_h3_index: string;
          p_owner_id: string;
          p_owner_name: string;
          p_gps_proof: Json;
        };
        Returns: Json;
      };
      // migration 013
      calculate_calories: {
        Args: {
          p_distance_km:  number;
          p_duration_sec: number;
          p_weight_kg?:   number;
          p_gender?:      'male' | 'female' | 'other';
          p_age?:         number;
        };
        Returns: number;
      };
      calculate_bmr: {
        Args: {
          p_weight_kg: number;
          p_height_cm: number;
          p_age:       number;
          p_gender?:   'male' | 'female' | 'other';
        };
        Returns: number;
      };
    };
  };
}
