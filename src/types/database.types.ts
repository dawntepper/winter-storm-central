/**
 * Supabase database types — Phase 1 (accounts + saved locations).
 *
 * Hand-written to match supabase/migrations/002_phase1_accounts_locations.sql.
 * This project is currently plain JavaScript, so this file is for editor/IDE
 * reference and a future TypeScript migration — it is not imported at runtime.
 *
 * To regenerate from the live database once the Supabase CLI is linked:
 *   supabase gen types typescript --linked > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      locations: {
        Row: {
          id: string;
          name: string;
          state: string | null;
          latitude: number;
          longitude: number;
          zip: string | null;
          /** Generated column: round(lat,2),round(lon,2) — dedup key. */
          geo_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          state?: string | null;
          latitude: number;
          longitude: number;
          zip?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          state?: string | null;
          latitude?: number;
          longitude?: number;
          zip?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_locations: {
        Row: {
          id: string;
          user_id: string;
          location_id: string;
          nickname: string | null;
          is_primary: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id: string;
          nickname?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          location_id?: string;
          nickname?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_locations_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_locations_location_id_fkey';
            columns: ['location_id'];
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          }
        ];
      };
      alert_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          location_id: string | null;
          channel: 'email' | 'sms';
          categories: string[] | null;
          min_severity: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id?: string | null;
          channel?: 'email' | 'sms';
          categories?: string[] | null;
          min_severity?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          location_id?: string | null;
          channel?: 'email' | 'sms';
          categories?: string[] | null;
          min_severity?: string | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alert_subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alert_subscriptions_location_id_fkey';
            columns: ['location_id'];
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: { [key: string]: never };
    Functions: {
      get_or_create_location: {
        Args: {
          p_name: string;
          p_state: string;
          p_lat: number;
          p_lon: number;
          p_zip?: string;
        };
        Returns: string;
      };
    };
    Enums: { [key: string]: never };
    CompositeTypes: { [key: string]: never };
  };
}

// Convenience row aliases for app code.
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type LocationRow = Database['public']['Tables']['locations']['Row'];
export type UserLocationRow = Database['public']['Tables']['user_locations']['Row'];
export type AlertSubscriptionRow = Database['public']['Tables']['alert_subscriptions']['Row'];
