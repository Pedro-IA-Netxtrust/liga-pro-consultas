import { supabase } from '../lib/supabase';
import { 
  LeagueCategory, 
  LeagueGroup, 
  LeagueMatch, 
  LeagueStanding,
  LeagueSeason
} from '../types';

// Mock data generator for fallback
const env = (import.meta as any).env;
const isMock = !env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL.includes('your-project-url') || env.VITE_SUPABASE_URL.includes('placeholder-project');
const hasAuth = (env.VITE_SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY !== 'placeholder-key') || 
                (env.VITE_SUPABASE_PUBLISHABLE_KEY && env.VITE_SUPABASE_PUBLISHABLE_KEY !== 'placeholder-key');

const useMockData = isMock || !hasAuth;

export const dataService = {
  async getActiveSeason(): Promise<LeagueSeason | null> {
    if (useMockData) {
      console.log('Using Mock Data: No Supabase secrets configured or using placeholder URL.');
      return { id: 's1', name: 'Temporada 2024', is_active: true };
    }
    
    console.log('Attempting to fetch active season from Supabase...');
    // Explicitly using the user's schema where status='activa' indicates the current season
    let { data, error } = await supabase
      .from('league_seasons')
      .select('*')
      .eq('status', 'activa')
      .limit(1)
      .single();
    
    if (error) {
      console.warn('No season with status "activa" found, attempting to fetch the most recent drafted or upcoming season.');
      const { data: recentData, error: recentError } = await supabase
        .from('league_seasons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (recentError) {
        console.error('Supabase Error (getActiveSeason):', recentError.message);
        return null;
      }
      data = recentData;
    }
    
    console.log('Season resolved successfully:', data?.name);
    // Map status='activa' to the UI's expected is_active boolean
    return {
      ...data,
      is_active: data.status === 'activa'
    };
  },

  async getActiveCategories(seasonId: string): Promise<LeagueCategory[]> {
    if (useMockData) {
      return [
        { id: 'c1', season_id: 's1', name: 'Primera Masculina', modality: 'Sexta', is_active: true },
        { id: 'c2', season_id: 's1', name: 'Segunda Masculina', modality: 'Quinta', is_active: true },
        { id: 'c3', season_id: 's1', name: 'Open Femenina', modality: 'Damas', is_active: true },
      ];
    }
    
    console.log('Fetching categories for season:', seasonId);
    const { data, error } = await supabase
      .from('league_categories')
      .select('id, name, modality, status, league_season_id')
      .eq('league_season_id', seasonId)
      // Accept 'activa' status or no status (defaulting to active)
      .or('status.eq.activa,status.is.null');
    
    if (error) {
      console.error('Supabase Error (getActiveCategories):', error.message);
      // Fallback: try fetching all for this season if filter fails
      const { data: allData, error: allError } = await supabase
        .from('league_categories')
        .select('id, name, modality, status, league_season_id')
        .eq('league_season_id', seasonId);
      
      if (allError) return [];
      return (allData || []).map(c => ({...c, season_id: c.league_season_id}));
    }
    console.log('Categories fetched:', data?.length || 0);
    return (data || []).map(c => ({...c, season_id: c.league_season_id}));
  },

  async getGroupsByCategory(categoryId: string): Promise<LeagueGroup[]> {
    if (useMockData) {
      if (categoryId === 'c1') return [
        { id: 'g1', category_id: 'c1', name: 'Grupo A' },
        { id: 'g2', category_id: 'c1', name: 'Grupo B' }
      ];
      return [];
    }
    const { data, error } = await supabase
      .from('league_groups')
      .select('id, group_name, league_category_id, phase')
      .eq('league_category_id', categoryId);
    
    if (error) {
       console.error('Supabase Error (getGroupsByCategory):', error.message);
       // Fallback for different column naming
       const { data: altData } = await supabase
        .from('league_groups')
        .select('*')
        .eq('category_id', categoryId);
       
       return (altData || []).map((g: any) => ({
         id: g.id,
         name: g.group_name || g.name,
         category_id: g.league_category_id || g.category_id,
         phase: g.phase?.toString()
       }));
    }

    return (data || []).map((g: any) => ({
      id: g.id,
      name: g.group_name,
      category_id: g.league_category_id,
      phase: g.phase?.toString()
    }));
  },

  async getUpcomingMatches(categoryId: string, groupId?: string): Promise<LeagueMatch[]> {
    if (useMockData) {
      return [
        { 
          id: 'm1', round: 1, team1_name: 'Pérez/García', team2_name: 'Rodríguez/López', 
          status: 'pendiente', team1_sets: 0, team2_sets: 0, team1_games: 0, team2_games: 0,
          league_category_id: categoryId, league_group_id: groupId, team1_id: 't1', team2_id: 't2'
        },
        { 
          id: 'm2', round: 1, team1_name: 'Sánchez/Díaz', team2_name: 'Martínez/Ruiz', 
          status: 'pendiente', team1_sets: 0, team2_sets: 0, team1_games: 0, team2_games: 0,
          league_category_id: categoryId, league_group_id: groupId, team1_id: 't3', team2_id: 't4'
        },
      ];
    }
    
    // Fetch with joins to get team names
    let query = supabase
      .from('league_matches')
      .select(`
        *,
        team1:league_teams!team1_id(team_name),
        team2:league_teams!team2_id(team_name)
      `)
      .eq('league_category_id', categoryId)
      .in('status', ['pendiente', 'programado']) // Restricted to values that likely exist in the enum
      .order('round', { ascending: true })
      .limit(20);
    
    if (groupId) {
      query = query.eq('league_group_id', groupId);
    }

    const { data: initialData, error } = await query;
    let finalData = initialData;

    if (error) {
      console.error('Supabase Error (getUpcomingMatches):', error.message);
      // Fallback: If 'pendiente' is the only safe one
      const { data: retryData } = await supabase
        .from('league_matches')
        .select(`*, team1:league_teams!team1_id(team_name), team2:league_teams!team2_id(team_name)`)
        .eq('league_category_id', categoryId)
        .eq('status', 'pendiente');
      
      finalData = retryData;
    }

    return (finalData || []).map((m: any) => ({
      ...m,
      team1_name: m.team1?.team_name || 'Pareja 1',
      team2_name: m.team2?.team_name || 'Pareja 2'
    }));
  },

  async getResults(categoryId: string, groupId?: string): Promise<LeagueMatch[]> {
    if (useMockData) {
      return [
        { 
          id: 'r1', round: 2, team1_name: 'Gómez/Mora', team2_name: 'Vidal/Sol', 
          status: 'jugado', team1_sets: 2, team2_sets: 1, team1_games: 12, team2_games: 8,
          league_category_id: categoryId, league_group_id: groupId, team1_id: 't5', team2_id: 't6'
        },
        { 
          id: 'r2', round: 2, team1_name: 'Blanco/Ortega', team2_name: 'Marín/Castro', 
          status: 'walkover', team1_sets: 2, team2_sets: 0, team1_games: 12, team2_games: 0,
          league_category_id: categoryId, league_group_id: groupId, team1_id: 't7', team2_id: 't8'
        },
      ];
    }
    
    let query = supabase
      .from('league_matches')
      .select(`
        *,
        team1:league_teams!team1_id(team_name),
        team2:league_teams!team2_id(team_name)
      `)
      .eq('league_category_id', categoryId)
      .in('status', ['jugado', 'walkover']) // Removed 'w.o.' as it causes enum mismatch error in Supabase
      .order('round', { ascending: false });
    
    if (groupId) {
      query = query.eq('league_group_id', groupId);
    }

    const { data: initialData, error } = await query;
    let finalData = initialData;

    if (error) {
      console.error('Supabase Error (getResults):', error.message);
      // Fallback: Use 'jugado' which is more likely to be in the enum
      const { data: retryData } = await supabase
        .from('league_matches')
        .select(`*, team1:league_teams!team1_id(team_name), team2:league_teams!team2_id(team_name)`)
        .eq('league_category_id', categoryId)
        .eq('status', 'jugado');
        
      finalData = retryData;
    }

    return (finalData || []).map((m: any) => ({
      ...m,
      team1_name: m.team1?.team_name || 'Pareja 1',
      team2_name: m.team2?.team_name || 'Pareja 2'
    }));
  },

  async getStandings(groupId: string): Promise<LeagueStanding[]> {
    if (useMockData) {
      return [
        { 
          id: 's1', group_id: groupId, team_id: 't1', team_name: 'Pérez/García', 
          played: 3, won: 3, lost: 0, points: 9, sets_for: 6, sets_against: 1, 
          games_for: 36, games_against: 20 
        },
        { 
          id: 's2', group_id: groupId, team_id: 't2', team_name: 'Rodríguez/López', 
          played: 3, won: 2, lost: 1, points: 6, sets_for: 5, sets_against: 2, 
          games_for: 34, games_against: 25 
        },
      ];
    }

    // Attempting to fetch from league_standings first (common view name)
    const { data: standings, error: standingsError } = await supabase
      .from('league_standings')
      .select('*')
      .eq('league_group_id', groupId)
      .order('points', { ascending: false });

    if (!standingsError && standings && standings.length > 0) {
      return standings;
    }

    // Fallback: If no standings source exists, fetch teams assigned to the group
    console.log('Fetching teams from league_group_teams for group:', groupId);
    const { data, error } = await supabase
      .from('league_group_teams')
      .select(`
        id,
        position,
        team:league_teams!league_team_id (
          id,
          team_name
        )
      `)
      .eq('league_group_id', groupId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Supabase Error (getStandings/league_group_teams):', error.message);
      return [];
    }

    // Map to LeagueStanding structure (with 0 stats if not calculated)
    return (data || []).map((item: any) => ({
      id: item.id,
      group_id: groupId,
      team_id: item.team?.id || '',
      team_name: item.team?.team_name || 'Sin nombre',
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      sets_for: 0,
      sets_against: 0,
      games_for: 0,
      games_against: 0
    }));
  }
};
