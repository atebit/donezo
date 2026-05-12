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
      activity: {
        Row: {
          actor_id: string | null
          board_id: string
          created_at: string
          id: string
          payload: Json
          task_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          board_id: string
          created_at?: string
          id?: string
          payload?: Json
          task_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          board_id?: string
          created_at?: string
          id?: string
          payload?: Json
          task_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      attachment: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          task_id: string
          uploader_id: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          task_id: string
          uploader_id?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          task_id?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachment_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      board: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          id: string
          is_private: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          is_private?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          is_private?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      board_member: {
        Row: {
          board_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_member_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
        ]
      }
      cell: {
        Row: {
          board_id: string
          boolean_value: boolean | null
          column_id: string
          created_at: string
          date_end_value: string | null
          date_value: string | null
          json_value: Json | null
          label_id: string | null
          number_value: number | null
          task_id: string
          text_value: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          board_id: string
          boolean_value?: boolean | null
          column_id: string
          created_at?: string
          date_end_value?: string | null
          date_value?: string | null
          json_value?: Json | null
          label_id?: string | null
          number_value?: number | null
          task_id: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          board_id?: string
          boolean_value?: boolean | null
          column_id?: string
          created_at?: string
          date_end_value?: string | null
          date_value?: string | null
          json_value?: Json | null
          label_id?: string | null
          number_value?: number | null
          task_id?: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cell_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "column"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "label"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      column: {
        Row: {
          board_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
          settings: Json
          type: string
          updated_at: string
        }
        Insert: {
          board_id: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position: number
          settings?: Json
          type: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          settings?: Json
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
        ]
      }
      comment: {
        Row: {
          author_id: string | null
          board_id: string
          body: Json
          body_text: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          board_id: string
          body: Json
          body_text?: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          board_id?: string
          body?: Json
          body_text?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reaction: {
        Row: {
          board_id: string
          comment_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          board_id: string
          comment_id: string
          created_at?: string
          emoji: string
          user_id: string
        }
        Update: {
          board_id?: string
          comment_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reaction_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reaction_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reaction_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group: {
        Row: {
          board_id: string
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation: {
        Row: {
          accepted_at: string | null
          board_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          board_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: string
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          board_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      label: {
        Row: {
          color: string
          column_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color: string
          column_id: string
          created_at?: string
          id?: string
          name: string
          position: number
          updated_at?: string
        }
        Update: {
          color?: string
          column_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "column"
            referencedColumns: ["id"]
          },
        ]
      }
      notification: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_workspace_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_workspace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_last_workspace_id_fkey"
            columns: ["last_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
      task: {
        Row: {
          board_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          group_id: string
          id: string
          position: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          board_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          group_id: string
          id?: string
          position: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          board_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          group_id?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group"
            referencedColumns: ["id"]
          },
        ]
      }
      user_starred_board: {
        Row: {
          board_id: string
          starred_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          starred_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          starred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_starred_board_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
        ]
      }
      view: {
        Row: {
          board_id: string
          config: Json
          created_at: string
          id: string
          is_shared: boolean
          kind: string
          name: string
          owner_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          board_id: string
          config?: Json
          created_at?: string
          id?: string
          is_shared?: boolean
          kind: string
          name: string
          owner_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_shared?: boolean
          kind?: string
          name?: string
          owner_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "board"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_member: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_member_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clone_board: {
        Args: { p_board_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          id: string
          is_private: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "board"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_board: {
        Args: { p_is_private: boolean; p_name: string; p_workspace_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          id: string
          is_private: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "board"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_workspace: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      greater_role: { Args: { a: string; b: string }; Returns: string }
      restore_board: {
        Args: { p_board_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          id: string
          is_private: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "board"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      role_for_board: {
        Args: { p_board_id: string; p_user_id: string }
        Returns: string
      }
      role_rank: { Args: { r: string }; Returns: number }
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
