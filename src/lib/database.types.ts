export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface Database {
  public: {
    Tables: {
      countries: {
        Row: {
          id: string
          name: string
          code: string
          flag_emoji: string
          group_letter: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['countries']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['countries']['Insert']>
      }
      players: {
        Row: {
          id: string
          country_id: string
          name: string
          position: Position
          shirt_number: number | null
          club: string | null
          age: number | null
          market_value_eur: number | null
          overall: number
          photo_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
    }
  }
}
