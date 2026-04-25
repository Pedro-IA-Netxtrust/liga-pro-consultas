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

  async getUpcomingMatches(categoryId: string, groupId?: string, phase?: number, round?: number): Promise<LeagueMatch[]> {
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
        ),
        group:league_groups!league_group_id(id, group_name, phase)
      `)
      .eq('league_category_id', categoryId)
      .in('status', ['pendiente', 'programado'])
      .order('match_date', { ascending: true, nullsFirst: false })
      .order('match_time', { ascending: true, nullsFirst: false })
      .order('round', { ascending: true });
    
    if (groupId) {
      query = query.eq('league_group_id', groupId);
    }

    if (phase) {
      // Matches can have a phase or belong to a group with a phase
      query = query.or(`phase.eq.${phase},league_groups.phase.eq.${phase}`);
    }

    if (round) {
      query = query.eq('round', round);
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

    const matches = (finalData || []).map((m: any) => ({
      ...m,
      team1_name: formatTeamFromData(m.team1),
      team2_name: formatTeamFromData(m.team2),
      group_name: m.group?.group_name,
      phase: m.group?.phase || m.phase
    }));

    // Sort: Scheduled matches first, then by date, then by time, then by round
    return matches.sort((a, b) => {
      const isAScheduled = a.status.toLowerCase() === 'programado' || 
                         (a.status.toLowerCase() === 'pendiente' && (a.match_date || a.match_time || a.court));
      const isBScheduled = b.status.toLowerCase() === 'programado' || 
                         (b.status.toLowerCase() === 'pendiente' && (b.match_date || b.match_time || b.court));

      if (isAScheduled && !isBScheduled) return -1;
      if (!isAScheduled && isBScheduled) return 1;

      // If both are same scheduled status, sort by date/time
      if (a.match_date && b.match_date) {
        if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
        if (a.match_time && b.match_time) return a.match_time.localeCompare(b.match_time);
      } else if (a.match_date) {
        return -1;
      } else if (b.match_date) {
        return 1;
      }

      return (a.round || 0) - (b.round || 0);
    });
  },

  async getResults(categoryId: string, groupId?: string, phase?: number, round?: number): Promise<LeagueMatch[]> {
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
        ),
        group:league_groups!league_group_id(id, group_name, phase)
      `)
      .eq('league_category_id', categoryId)
      .in('status', ['jugado', 'walkover'])
      .order('round', { ascending: false });
    
    if (groupId) {
      query = query.eq('league_group_id', groupId);
    }

    if (phase) {
      query = query.or(`phase.eq.${phase},league_groups.phase.eq.${phase}`);
    }

    if (round) {
      query = query.eq('round', round);
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
      team2_name: formatTeamFromData(m.team2),
      group_name: m.group?.group_name,
      phase: m.group?.phase || m.phase
    }));
  },

  async getStandings(categoryId: string, groupId?: string, phase?: number): Promise<LeagueStanding[]> {
    if (useMockData) {
      return [
        { 
          id: 's1', group_id: groupId || 'g1', team_id: 't1', team_name: 'Pérez / García', 
          played: 3, won: 3, lost: 0, points: 9, sets_for: 6, sets_against: 1, 
          games_for: 36, games_against: 20 
        },
      ];
    }

    // 1. Get all groups for this category (and optionally phase/groupId)
    let groupsQuery = supabase
      .from('league_groups')
      .select('id, group_name, phase')
      .eq('league_category_id', categoryId);
    
    if (groupId) groupsQuery = groupsQuery.eq('id', groupId);
    if (phase) groupsQuery = groupsQuery.eq('phase', phase);

    const { data: groups, error: groupsError } = await groupsQuery;
    
    // If we have groups, fetch teams via league_group_teams
    // If NO groups, fetch teams directly from league_teams
    let groupTeams: any[] = [];
    const groupIds = (groups || []).map(g => g.id);

    if (groupIds.length > 0) {
      const { data: gtData } = await supabase
        .from('league_group_teams')
        .select(`
          league_group_id,
          team:league_teams!league_team_id (
            id, team_name, is_ghost,
            p1:clients!player1_id (first_name, last_name),
            p2:clients!player2_id (first_name, last_name)
          )
        `)
        .in('league_group_id', groupIds);
      groupTeams = gtData || [];
    } else {
      const { data: tData } = await supabase
        .from('league_teams')
        .select(`
          id, team_name, is_ghost,
          p1:clients!player1_id (first_name, last_name),
          p2:clients!player2_id (first_name, last_name)
        `)
        .eq('league_category_id', categoryId);
      
      groupTeams = (tData || []).map(t => ({
        league_group_id: null,
        team: t
      }));
    }

    if (groupTeams.length === 0) return [];

    // 3. Get existing standings for these groups (or category if no groups)
    let standingsQuery = supabase.from('league_standings').select('*');
    if (groupIds.length > 0) {
      standingsQuery = standingsQuery.in('league_group_id', groupIds);
    } else {
      standingsQuery = standingsQuery.eq('league_category_id', categoryId);
    }
    
    const { data: standingsData } = await standingsQuery;

    // 4. Merge data: Every team in groupTeams should have a row
    const mergedStandings: any[] = groupTeams.map(gt => {
      const standing = (standingsData || []).find(s => 
        s.league_team_id === gt.team?.id && 
        (groupIds.length > 0 ? s.league_group_id === gt.league_group_id : true)
      );
      const group = groups ? groups.find(g => g.id === gt.league_group_id) : undefined;
      
      return {
        id: standing?.id || `${gt.league_group_id || 'general'}-${gt.team?.id}`,
        group_id: gt.league_group_id,
        group_name: group?.group_name,
        phase: group?.phase,
        team_id: gt.team?.id,
        team_name: formatTeamFromData(gt.team),
        played: standing?.played || 0,
        won: standing?.won || 0,
        lost: standing?.lost || 0,
        points: standing?.points || 0,
        sets_for: standing?.sets_for || 0,
        sets_against: standing?.sets_against || 0,
        games_for: standing?.games_for || 0,
        games_against: standing?.games_against || 0
      };
    });

    return mergedStandings;
  },

  async getPhasesAndRounds(categoryId: string): Promise<{ phases: number[], rounds: number[] }> {
    if (useMockData) return { phases: [1], rounds: [1, 2, 3] };

    const { data: matches, error } = await supabase
      .from('league_matches')
      .select('phase, round')
      .eq('league_category_id', categoryId);
    
    if (error) return { phases: [], rounds: [] };

    const phases = Array.from(new Set(matches.map(m => m.phase).filter(p => p !== null))) as number[];
    const rounds = Array.from(new Set(matches.map(m => m.round).filter(r => r !== null))) as number[];

    return {
      phases: phases.sort((a, b) => a - b),
      rounds: rounds.sort((a, b) => a - b)
    };
  }
};
