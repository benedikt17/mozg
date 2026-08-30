export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      canvas_asset_variants: {
        Row: {
          asset_id: string
          byte_size: number
          canvas_id: string
          created_at: string
          kind: string
          mime_type: string
          pixel_height: number
          pixel_width: number
          ready_at: string | null
          storage_path: string
          target_max_edge: number
          workspace_id: string
        }
        Insert: {
          asset_id: string
          byte_size: number
          canvas_id: string
          created_at?: string
          kind: string
          mime_type: string
          pixel_height: number
          pixel_width: number
          ready_at?: string | null
          storage_path: string
          target_max_edge: number
          workspace_id: string
        }
        Update: {
          asset_id?: string
          byte_size?: number
          canvas_id?: string
          created_at?: string
          kind?: string
          mime_type?: string
          pixel_height?: number
          pixel_width?: number
          ready_at?: string | null
          storage_path?: string
          target_max_edge?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_asset_variants_parent_fkey"
            columns: ["workspace_id", "canvas_id", "asset_id"]
            isOneToOne: false
            referencedRelation: "canvas_assets"
            referencedColumns: ["workspace_id", "canvas_id", "id"]
          },
        ]
      }
      canvas_assets: {
        Row: {
          byte_size: number
          canvas_id: string
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          height: number
          id: string
          mime_type: string
          preview_storage_key: string | null
          ready_at: string | null
          storage_key: string
          width: number
          workspace_id: string
        }
        Insert: {
          byte_size: number
          canvas_id: string
          checksum?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          height: number
          id?: string
          mime_type: string
          preview_storage_key?: string | null
          ready_at?: string | null
          storage_key: string
          width: number
          workspace_id: string
        }
        Update: {
          byte_size?: number
          canvas_id?: string
          checksum?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          height?: number
          id?: string
          mime_type?: string
          preview_storage_key?: string | null
          ready_at?: string | null
          storage_key?: string
          width?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_assets_canvas_workspace_fkey"
            columns: ["workspace_id", "canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "canvas_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_groups: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          parent_group_id: string | null
          project_id: string
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          parent_group_id?: string | null
          project_id: string
          sort_order?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          parent_group_id?: string | null
          project_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_groups_parent_workspace_project_fkey"
            columns: ["workspace_id", "project_id", "parent_group_id"]
            isOneToOne: false
            referencedRelation: "canvas_groups"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "canvas_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_view_states: {
        Row: {
          canvas_id: string
          open_article_id: string | null
          updated_at: string
          user_id: string
          viewport_x: number
          viewport_y: number
          zoom: number
        }
        Insert: {
          canvas_id: string
          open_article_id?: string | null
          updated_at?: string
          user_id: string
          viewport_x?: number
          viewport_y?: number
          zoom?: number
        }
        Update: {
          canvas_id?: string
          open_article_id?: string | null
          updated_at?: string
          user_id?: string
          viewport_x?: number
          viewport_y?: number
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_view_states_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
        ]
      }
      canvases: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          document: Json
          group_id: string | null
          id: string
          project_id: string
          revision: number
          schema_version: number
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          document?: Json
          group_id?: string | null
          id?: string
          project_id: string
          revision?: number
          schema_version?: number
          sort_order?: number
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          document?: Json
          group_id?: string | null
          id?: string
          project_id?: string
          revision?: number
          schema_version?: number
          sort_order?: number
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvases_group_workspace_project_fkey"
            columns: ["workspace_id", "project_id", "group_id"]
            isOneToOne: false
            referencedRelation: "canvas_groups"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "canvases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      file_variants: {
        Row: {
          byte_size: number
          created_at: string
          file_id: string
          kind: string
          mime_type: string
          pixel_height: number | null
          pixel_width: number | null
          processing_error: string | null
          project_id: string
          ready_at: string | null
          storage_path: string
          target_max_edge: number | null
          workspace_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          file_id: string
          kind: string
          mime_type: string
          pixel_height?: number | null
          pixel_width?: number | null
          processing_error?: string | null
          project_id: string
          ready_at?: string | null
          storage_path: string
          target_max_edge?: number | null
          workspace_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          file_id?: string
          kind?: string
          mime_type?: string
          pixel_height?: number | null
          pixel_width?: number | null
          processing_error?: string | null
          project_id?: string
          ready_at?: string | null
          storage_path?: string
          target_max_edge?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_variants_parent_fkey"
            columns: ["workspace_id", "project_id", "file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
        ]
      }
      knowledge_annotations: {
        Row: {
          comment: string
          created_at: string
          created_by: string
          document_id: string
          end_offset: number
          id: string
          prefix: string
          resolved_at: string | null
          schema_version: number
          selected_text: string
          start_offset: number
          suffix: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          created_by?: string
          document_id: string
          end_offset: number
          id?: string
          prefix?: string
          resolved_at?: string | null
          schema_version?: number
          selected_text: string
          start_offset: number
          suffix?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          created_by?: string
          document_id?: string
          end_offset?: number
          id?: string
          prefix?: string
          resolved_at?: string | null
          schema_version?: number
          selected_text?: string
          start_offset?: number
          suffix?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_annotations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          archived_at: string | null
          content_md: string
          created_at: string
          daily_date: string | null
          id: string
          is_daily: boolean
          project_id: string
          search_tsv: unknown
          share_token: string | null
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          content_md?: string
          created_at?: string
          daily_date?: string | null
          id?: string
          is_daily?: boolean
          project_id: string
          search_tsv?: unknown
          share_token?: string | null
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          content_md?: string
          created_at?: string
          daily_date?: string | null
          id?: string
          is_daily?: boolean
          project_id?: string
          search_tsv?: unknown
          share_token?: string | null
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_workspace_id_project_id_fkey"
            columns: ["workspace_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      project_files: {
        Row: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }
        Insert: {
          byte_size: number
          checksum?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          folder_id?: string | null
          height?: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at?: string | null
          search_tsv?: unknown
          storage_key: string
          updated_at?: string
          width?: number | null
          workspace_id: string
        }
        Update: {
          byte_size?: number
          checksum?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          folder_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          name?: string
          original_name?: string
          project_id?: string
          ready_at?: string | null
          search_tsv?: unknown
          storage_key?: string
          updated_at?: string
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_folder_scope_fkey"
            columns: ["workspace_id", "project_id", "folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "project_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_folders: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          parent_folder_id: string | null
          project_id: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          project_id: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          project_id?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_folders_parent_scope_fkey"
            columns: ["workspace_id", "project_id", "parent_folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["workspace_id", "project_id", "id"]
          },
          {
            foreignKeyName: "project_folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_snapshots: {
        Row: {
          created_at: string
          revision: number
          schema_version: number
          snapshot: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          revision?: number
          schema_version?: number
          snapshot: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          revision?: number
          schema_version?: number
          snapshot?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_canvas_title: {
        Args: { target_title: string }
        Returns: undefined
      }
      assert_desktop_snapshot_v1_keys: {
        Args: {
          allowed_keys: string[]
          record_value: Json
          required_keys: string[]
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v1_order: {
        Args: {
          field_name: string
          record_value: Json
          required_value?: boolean
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v1_string: {
        Args: {
          field_name: string
          non_empty?: boolean
          record_value: Json
          required_value?: boolean
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v1_string_array: {
        Args: {
          field_name: string
          non_empty_array?: boolean
          non_empty_items?: boolean
          record_value: Json
          required_value?: boolean
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v3_keys: {
        Args: {
          allowed_keys: string[]
          record_value: Json
          required_keys: string[]
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v3_order: {
        Args: {
          field_name: string
          record_value: Json
          required_value?: boolean
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v3_string: {
        Args: {
          field_name: string
          non_empty?: boolean
          record_value: Json
          required_value?: boolean
        }
        Returns: undefined
      }
      assert_desktop_snapshot_v3_string_array: {
        Args: {
          field_name: string
          non_empty_array?: boolean
          non_empty_items?: boolean
          record_value: Json
          required_value?: boolean
        }
        Returns: undefined
      }
      create_canvas:
        | {
            Args: { target_title: string; target_workspace_id: string }
            Returns: {
              id: string
              revision: number
            }[]
          }
        | {
            Args: {
              target_group_id: string
              target_title: string
              target_workspace_id: string
            }
            Returns: {
              id: string
              revision: number
            }[]
          }
      create_canvas_for_project: {
        Args: {
          target_group_id?: string
          target_project_id: string
          target_title: string
          target_workspace_id: string
        }
        Returns: {
          id: string
          revision: number
        }[]
      }
      create_canvas_group: {
        Args: {
          target_parent_group_id: string
          target_title: string
          target_workspace_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          parent_group_id: string | null
          project_id: string
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "canvas_groups"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_canvas_group_for_project: {
        Args: {
          target_parent_group_id?: string
          target_project_id: string
          target_title: string
          target_workspace_id: string
        }
        Returns: {
          id: string
        }[]
      }
      create_project_folder: {
        Args: {
          target_name: string
          target_parent_folder_id?: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          parent_folder_id: string | null
          project_id: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_folders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_canvas: {
        Args: { target_canvas_id: string }
        Returns: {
          deleted: boolean
        }[]
      }
      delete_canvas_asset: {
        Args: {
          target_asset_id: string
          target_canvas_id: string
          target_workspace_id: string
        }
        Returns: {
          deleted: boolean
        }[]
      }
      delete_canvas_asset_variant: {
        Args: {
          target_asset_id: string
          target_canvas_id: string
          target_kind: string
          target_workspace_id: string
        }
        Returns: {
          deleted: boolean
        }[]
      }
      delete_canvas_asset_variants: {
        Args: {
          target_asset_id: string
          target_canvas_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      delete_canvas_group: {
        Args: { target_group_id: string }
        Returns: {
          deleted: boolean
          id: string
          workspace_id: string
        }[]
      }
      delete_project_file: {
        Args: {
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_files"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_project_file_variant: {
        Args: {
          requested_max_edge: number
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: boolean
      }
      finalize_canvas_asset: {
        Args: {
          target_asset_id: string
          target_canvas_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          canvas_id: string
          checksum: string
          created_at: string
          created_by: string
          deleted_at: string
          height: number
          id: string
          mime_type: string
          preview_storage_key: string
          ready_at: string
          storage_key: string
          width: number
          workspace_id: string
        }[]
      }
      finalize_canvas_asset_variant: {
        Args: {
          target_asset_id: string
          target_canvas_id: string
          target_kind: string
          target_workspace_id: string
        }
        Returns: {
          asset_id: string
          byte_size: number
          canvas_id: string
          created_at: string
          kind: string
          mime_type: string
          pixel_height: number
          pixel_width: number
          ready_at: string
          storage_path: string
          workspace_id: string
        }[]
      }
      finalize_canvas_asset_variant_v2: {
        Args: {
          requested_max_edge: number
          target_asset_id: string
          target_canvas_id: string
          target_workspace_id: string
        }
        Returns: {
          asset_id: string
          byte_size: number
          canvas_id: string
          created_at: string
          kind: string
          mime_type: string
          pixel_height: number
          pixel_width: number
          ready_at: string
          storage_path: string
          target_max_edge: number
          workspace_id: string
        }[]
      }
      fail_project_file_pdf_cover: {
        Args: {
          target_error: string
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: undefined
      }
      finalize_project_file: {
        Args: {
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_files"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finalize_project_file_pdf_cover: {
        Args: {
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          created_at: string
          file_id: string
          kind: string
          mime_type: string
          pixel_height: number | null
          pixel_width: number | null
          processing_error: string | null
          project_id: string
          ready_at: string | null
          storage_path: string
          target_max_edge: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "file_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finalize_project_file_variant: {
        Args: {
          requested_max_edge: number
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          created_at: string
          file_id: string
          kind: string
          mime_type: string
          pixel_height: number | null
          pixel_width: number | null
          processing_error: string | null
          project_id: string
          ready_at: string | null
          storage_path: string
          target_max_edge: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "file_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_workspace_role: {
        Args: { roles: string[]; target_workspace_id: string }
        Returns: boolean
      }
      initialize_workspace_snapshot: {
        Args: {
          target_schema_version: number
          target_snapshot: Json
          target_workspace_id: string
        }
        Returns: undefined
      }
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      move_canvas_group: {
        Args: { target_group_id: string; target_parent_group_id: string }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          parent_group_id: string | null
          project_id: string
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "canvas_groups"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      move_canvas_to_group: {
        Args: { target_canvas_id: string; target_group_id: string }
        Returns: undefined
      }
      move_project_file: {
        Args: {
          target_file_id: string
          target_folder_id?: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_files"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      move_project_folder: {
        Args: {
          target_folder_id: string
          target_parent_folder_id?: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          parent_folder_id: string | null
          project_id: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_folders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rename_canvas: {
        Args: { target_canvas_id: string; target_title: string }
        Returns: {
          created_at: string
          deleted_at: string
          id: string
          revision: number
          schema_version: number
          title: string
          updated_at: string
          workspace_id: string
        }[]
      }
      rename_canvas_group: {
        Args: { target_group_id: string; target_title: string }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          parent_group_id: string | null
          project_id: string
          sort_order: number
          title: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "canvas_groups"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rename_project_file: {
        Args: {
          target_file_id: string
          target_name: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_files"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rename_project_folder: {
        Args: {
          target_folder_id: string
          target_name: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          name: string
          parent_folder_id: string | null
          project_id: string
          sort_order: number
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_folders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_canvas_asset: {
        Args: {
          target_asset_id: string
          target_byte_size: number
          target_canvas_id: string
          target_checksum?: string
          target_height: number
          target_mime_type: string
          target_width: number
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          canvas_id: string
          checksum: string
          created_at: string
          created_by: string
          deleted_at: string
          height: number
          id: string
          mime_type: string
          preview_storage_key: string
          ready_at: string
          storage_key: string
          width: number
          workspace_id: string
        }[]
      }
      reserve_canvas_asset_variant: {
        Args: {
          target_asset_id: string
          target_byte_size: number
          target_canvas_id: string
          target_kind: string
          target_pixel_height: number
          target_pixel_width: number
          target_workspace_id: string
        }
        Returns: {
          asset_id: string
          byte_size: number
          canvas_id: string
          created_at: string
          kind: string
          mime_type: string
          pixel_height: number
          pixel_width: number
          ready_at: string
          storage_path: string
          workspace_id: string
        }[]
      }
      reserve_canvas_asset_variant_v2: {
        Args: {
          requested_max_edge: number
          target_asset_id: string
          target_byte_size: number
          target_canvas_id: string
          target_pixel_height: number
          target_pixel_width: number
          target_workspace_id: string
        }
        Returns: {
          asset_id: string
          byte_size: number
          canvas_id: string
          created_at: string
          kind: string
          mime_type: string
          pixel_height: number
          pixel_width: number
          ready_at: string
          storage_path: string
          target_max_edge: number
          workspace_id: string
        }[]
      }
      reserve_project_file: {
        Args: {
          target_byte_size: number
          target_checksum?: string
          target_file_id: string
          target_folder_id?: string
          target_height?: number
          target_mime_type: string
          target_name: string
          target_original_name: string
          target_project_id: string
          target_width?: number
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_files"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_project_file_pdf_cover: {
        Args: {
          target_byte_size: number
          target_file_id: string
          target_pixel_height: number
          target_pixel_width: number
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          created_at: string
          file_id: string
          kind: string
          mime_type: string
          pixel_height: number | null
          pixel_width: number | null
          processing_error: string | null
          project_id: string
          ready_at: string | null
          storage_path: string
          target_max_edge: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "file_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reserve_project_file_variant: {
        Args: {
          requested_max_edge: number
          target_byte_size: number
          target_file_id: string
          target_pixel_height: number
          target_pixel_width: number
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          created_at: string
          file_id: string
          kind: string
          mime_type: string
          pixel_height: number | null
          pixel_width: number | null
          processing_error: string | null
          project_id: string
          ready_at: string | null
          storage_path: string
          target_max_edge: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "file_variants"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      restore_project_file: {
        Args: {
          target_file_id: string
          target_project_id: string
          target_workspace_id: string
        }
        Returns: {
          byte_size: number
          checksum: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          folder_id: string | null
          height: number | null
          id: string
          mime_type: string
          name: string
          original_name: string
          project_id: string
          ready_at: string | null
          search_tsv: unknown
          storage_key: string
          updated_at: string
          width: number | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "project_files"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_canvas_document: {
        Args: {
          target_canvas_id: string
          target_document: Json
          target_expected_revision: number
          target_title: string
        }
        Returns: {
          revision: number
          status: string
        }[]
      }
      save_workspace_snapshot: {
        Args: {
          target_expected_revision: number
          target_schema_version: number
          target_snapshot: Json
          target_workspace_id: string
        }
        Returns: {
          revision: number
          status: string
        }[]
      }
      validate_canvas_document_v1: {
        Args: { target_document: Json; target_schema_version: number }
        Returns: undefined
      }
      validate_canvas_document_v2: {
        Args: { target_document: Json; target_schema_version: number }
        Returns: undefined
      }
      validate_desktop_snapshot_v1: {
        Args: { target_schema_version: number; target_snapshot: Json }
        Returns: undefined
      }
      validate_desktop_snapshot_v2: {
        Args: { target_schema_version: number; target_snapshot: Json }
        Returns: undefined
      }
      validate_desktop_snapshot_v3: {
        Args: { target_schema_version: number; target_snapshot: Json }
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
  public: {
    Enums: {},
  },
} as const
