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

// Helper to construct team name from player objects (clients table)
const formatTeamFromData = (team: any) => {
  if (!team) return 'Pareja';
  if (team.is_ghost) return team.team_name || 'Pareja Fantasma';
  
  // Player 1 (first_name and last_name from clients join)
  const p1 = team.p1 ? `${team.p1.first_name} ${team.p1.last_name}` : null;
  // Player 2
  const p2 = team.p2 ? `${team.p2.first_name} ${team.p2.last_name}` : null;
  
  if (p1 && p2) return `${p1} / ${p2}`;
  return p1 || p2 || team.team_name || 'Pareja';
};

export const dataService = {
  async getActiveSeason(): Promise<LeagueSeason | null> {
    if (useMockData) {
      console.log('Using Mock Data: No Supabase secrets configured or using placeholder URL.');
      return { id: 's1', name: 'Temporada 2024', is_active: true };
    }
    
    console.log('Attempting to fetch active season from Supabase...');
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
      .or('status.eq.activa,status.is.null');
    
    if (error) {
      console.error('Supabase Error (getActiveCategories):', error.message);
      const { data: allData, error: allError } = await supabase
        .from('league_categories')
        .select('id, name, modality, status, league_season_id')
        .eq('league_season_id', seasonId);
      
      if (allError) return [];
      return (allData || []).map(c => ({...c, season_id: c.league_season_id}));
    }
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
          id: 'm1', round: 1, team1_name: 'Pérez / García', team2_name: 'Rodríguez / López', 
          status: 'pendiente', team1_sets: 0, team2_sets: 0, team1_games: 0, team2_games: 0,
          league_category_id: categoryId, league_group_id: groupId, team1_id: 't1', team2_id: 't2'
        },
      ];
    }
    
    let query = supabase
      .from('league_matches')
      .select(`
        *,
        team1:league_teams!team1_id(
          id, team_name, is_ghost,
          p1:clients!player1_id(first_name, last_name),
          p2:clients!player2_id(first_name, last_name)
        ),
        team2:league_teams!team2_id(
          id, team_name, is_ghost,
          p1:clients!player1_id(first_name, last_name),
          p2:clients!player2_id(first_name, last_name)
        )
      `)
      .eq('league_category_id', categoryId)
      .in('status', ['pendiente', 'programado'])
      .order('round', { ascending: true })
      .limit(20);
    
    if (groupId) {
      query = query.eq('league_group_id', groupId);
    }

    const { data: initialData, error } = await query;
    let finalData = initialData;

    if (error) {
      console.error('Supabase Error (getUpcomingMatches):', error.message);
      const { data: retryData } = await supabase
        .from('league_matches')
        .select(`
          *,
          team1:league_teams!team1_id(id, team_name, is_ghost, p1:clients!player1_id(first_name, last_name), p2:clients!player2_id(first_name, last_name)),
          team2:league_teams!team2_id(id, team_name, is_ghost, p1:clients!player1_id(first_name, last_name), p2:clients!player2_id(first_name, last_name))
        `)
        .eq('league_category_id', categoryId)
        .eq('status', 'pendiente');
      
      finalData = retryData;
    }

    return (finalData || []).map((m: any) => ({
      ...m,
      team1_name: formatTeamFromData(m.team1),
      team2_name: formatTeamFromData(m.team2)
    }));
  },

  async getResults(categoryId: string, groupId?: string): Promise<LeagueMatch[]> {
    if (useMockData) {
      return [
        { 
          id: 'r1', round: 2, team1_name: 'Gómez / Mora', team2_name: 'Vidal / Sol', 
          status: 'jugado', team1_sets: 2, team2_sets: 1, team1_games: 12, team2_games: 8,
          league_category_id: categoryId, league_group_id: groupId, team1_id: 't5', team2_id: 't6'
        },
      ];
    }
    
    let query = supabase
      .from('league_matches')
      .select(`
        *,
        team1:league_teams!team1_id(
          id, team_name, is_ghost,
          p1:clients!player1_id(first_name, last_name),
          p2:clients!player2_id(first_name, last_name)
        ),
        team2:league_teams!team2_id(
          id, team_name, is_ghost,
          p1:clients!player1_id(first_name, last_name),
          p2:clients!player2_id(first_name, last_name)
        )
      `)
      .eq('league_category_id', categoryId)
      .in('status', ['jugado', 'walkover'])
      .order('round', { ascending: false });
    
    if (groupId) {
      query = query.eq('league_group_id', groupId);
    }

    const { data: initialData, error } = await query;
    let finalData = initialData;

    if (error) {
      console.error('Supabase Error (getResults):', error.message);
      const { data: retryData } = await supabase
        .from('league_matches')
        .select(`
          *,
          team1:league_teams!team1_id(id, team_name, is_ghost, p1:clients!player1_id(first_name, last_name), p2:clients!player2_id(first_name, last_name)),
          team2:league_teams!team2_id(id, team_name, is_ghost, p1:clients!player1_id(first_name, last_name), p2:clients!player2_id(first_name, last_name))
        `)
        .eq('league_category_id', categoryId)
        .eq('status', 'jugado');
        
      finalData = retryData;
    }

    return (finalData || []).map((m: any) => ({
      ...m,
      team1_name: formatTeamFromData(m.team1),
      team2_name: formatTeamFromData(m.team2)
    }));
  },

  async getStandings(groupId: string): Promise<LeagueStanding[]> {
    if (useMockData) {
      return [
        { 
          id: 's1', group_id: groupId, team_id: 't1', team_name: 'Pérez / García', 
          played: 3, won: 3, lost: 0, points: 9, sets_for: 6, sets_against: 1, 
          games_for: 36, games_against: 20 
        },
      ];
    }

    const { data: standings, error: standingsError } = await supabase
      .from('league_standings')
      .select('*')
      .eq('league_group_id', groupId)
      .order('points', { ascending: false });

    if (!standingsError && standings && standings.length > 0) {
      return standings;
    }

    console.log('Fetching teams from league_group_teams for group:', groupId);
    const { data, error } = await supabase
      .from('league_group_teams')
      .select(`
        id,
        position,
        team:league_teams!league_team_id (
          id,
          team_name,
          is_ghost,
          p1:clients!player1_id (first_name, last_name),
          p2:clients!player2_id (first_name, last_name)
        )
      `)
      .eq('league_group_id', groupId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Supabase Error (getStandings/league_group_teams):', error.message);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      group_id: groupId,
      team_id: item.team?.id || '',
      team_name: formatTeamFromData(item.team),
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
