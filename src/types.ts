export interface LeagueSeason {
  id: string;
  name: string;
  is_active: boolean;
}

export interface LeagueCategory {
  id: string;
  season_id: string;
  name: string;
  modality?: string;
  is_active?: boolean;
}

export interface LeagueGroup {
  id: string;
  category_id: string;
  name: string;
  phase?: string;
}

export interface LeagueTeam {
  id: string;
  name: string;
  group_id: string;
}

export interface LeagueMatch {
  id: string;
  league_category_id: string;
  league_group_id?: string;
  round: number;
  team1_id: string;
  team2_id: string;
  team1_name?: string;
  team2_name?: string;
  team1_sets: number;
  team2_sets: number;
  team1_games: number;
  team2_games: number;
  status: string;
  match_date?: string;
  match_time?: string;
  court?: string;
  court_number?: number;
  s1_t1?: number;
  s1_t2?: number;
  s2_t1?: number;
  s2_t2?: number;
  s3_t1?: number;
  s3_t2?: number;
  [key: string]: any; // Flexibilidad para campos adicionales de Supabase
}

export interface LeagueStanding {
  id: string;
  group_id: string;
  team_id: string;
  team_name?: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  sets_for: number;
  sets_against: number;
  games_for: number;
  games_against: number;
}
