import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  ChevronRight,
  Calendar,
  CheckCircle2,
  BarChart3,
  Search,
  ChevronLeft,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService } from './services/dataService';
import {
  LeagueCategory,
  LeagueGroup,
  LeagueMatch,
  LeagueStanding,
  LeagueSeason
} from './types';

// Helper to format team names: "Hidalgo Rodríguez / Astudillo" -> "Hidalgo/Astudillo"
const formatTeamName = (name: string) => {
  if (!name) return '';
  return name
    .split('/')
    .map(part => part.trim())
    .join(' / ');
};

// --- Components ---

const Badge = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}>
    {children}
  </span>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

// --- App ---

export default function App() {
  const [season, setSeason] = useState<LeagueSeason | null>(null);
  const [categories, setCategories] = useState<LeagueCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<LeagueCategory | null>(null);
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<LeagueGroup | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'results' | 'standings'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Data
  const [upcoming, setUpcoming] = useState<LeagueMatch[]>([]);
  const [results, setResults] = useState<LeagueMatch[]>([]);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);

  // Filters
  const [phases, setPhases] = useState<number[]>([]);
  const [rounds, setRounds] = useState<number[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<number | 'all'>('all');
  const [selectedRound, setSelectedRound] = useState<number | 'all'>('all');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const activeSeason = await dataService.getActiveSeason();
    if (activeSeason) {
      setSeason(activeSeason);
      const cats = await dataService.getActiveCategories(activeSeason.id);
      setCategories(cats);
    }
    setLoading(false);
  };

  const handleSelectCategory = async (cat: LeagueCategory) => {
    setSelectedCategory(cat);
    setLoading(true);

    // Reset filters
    setSelectedPhase('all');
    setSelectedRound('all');
    setSelectedGroup(null);

    const [grps, filters] = await Promise.all([
      dataService.getGroupsByCategory(cat.id),
      dataService.getPhasesAndRounds(cat.id)
    ]);

    setGroups(grps);
    setPhases(filters.phases);
    setRounds(filters.rounds);

    if (grps.length > 0) {
      setSelectedGroup(grps[0]);
      await loadDetailData(cat.id, grps[0].id);
    } else {
      await loadDetailData(cat.id);
    }
  };

  const handleSelectGroup = async (group: LeagueGroup) => {
    setSelectedGroup(group);
    await loadDetailData(
      selectedCategory?.id!,
      group.id,
      selectedPhase === 'all' ? undefined : selectedPhase,
      selectedRound === 'all' ? undefined : selectedRound
    );
  };

  const handleFilterPhase = async (phase: number | 'all') => {
    setSelectedPhase(phase);
    await loadDetailData(
      selectedCategory?.id!,
      selectedGroup?.id,
      phase === 'all' ? undefined : phase,
      selectedRound === 'all' ? undefined : selectedRound
    );
  };

  const handleFilterRound = async (round: number | 'all') => {
    setSelectedRound(round);
    await loadDetailData(
      selectedCategory?.id!,
      selectedGroup?.id,
      selectedPhase === 'all' ? undefined : selectedPhase,
      round === 'all' ? undefined : round
    );
  };

  const loadDetailData = async (catId: string, grpId?: string, phase?: number, round?: number) => {
    setLoading(true);
    const [up, res, std] = await Promise.all([
      dataService.getUpcomingMatches(catId, grpId, phase, round),
      dataService.getResults(catId, grpId, phase, round),
      dataService.getStandings(catId, grpId, phase)
    ]);
    setUpcoming(up);
    setResults(res);
    setStandings(std);
    setLoading(false);
  };

  const resetSelection = () => {
    setSelectedCategory(null);
    setSelectedGroup(null);
    setSelectedPhase('all');
    setSelectedRound('all');
    setGroups([]);
    setPhases([]);
    setRounds([]);
    setUpcoming([]);
    setResults([]);
    setStandings([]);
    setActiveTab('upcoming');
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  const isDetailView = selectedCategory && (groups.length === 0 || selectedGroup);

  if (loading && !season) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Cargando temporada...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <AppContent
        loading={loading}
        isDetailView={isDetailView}
        selectedCategory={selectedCategory}
        selectedGroup={selectedGroup}
        handleSelectCategory={handleSelectCategory}
        handleSelectGroup={handleSelectGroup}
        handleFilterPhase={handleFilterPhase}
        handleFilterRound={handleFilterRound}
        setSelectedGroup={setSelectedGroup}
        loadDetailData={loadDetailData}
        resetSelection={resetSelection}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        upcoming={upcoming}
        results={results}
        standings={standings}
        groups={groups}
        phases={phases}
        rounds={rounds}
        selectedPhase={selectedPhase}
        selectedRound={selectedRound}
        season={season}
        categories={categories}
      />
    </div>
  );
}

// --- App Content Component ---

function AppContent({
  loading, isDetailView, selectedCategory, selectedGroup,
  handleSelectCategory, handleSelectGroup, handleFilterPhase, handleFilterRound,
  setSelectedGroup, loadDetailData, resetSelection,
  activeTab, setActiveTab, upcoming, results, standings,
  groups, phases, rounds, selectedPhase, selectedRound, season, categories
}: any) {
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Sticky Top Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h1 className="text-primary font-black text-xl tracking-tighter leading-none">
                VIBE SPORT
              </h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                by Netxtrust 2026
              </span>
            </div>
            <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
              <Trophy size={18} className="text-primary" />
            </div>
          </div>

          {/* Categories Pill Carousel */}
          <div className="flex overflow-x-auto gap-2 no-scrollbar pb-3 -mx-4 px-4 scroll-smooth">
            {categories.map((cat: any) => {
              const isActive = selectedCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${isActive
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Group Selector & Tabs (Only show if category is selected) */}
        {selectedCategory && (
          <div className="bg-slate-50/50 pt-3 px-4 pb-1">
            {/* Group, Phase, Round Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              {groups.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedGroup?.id || "all"}
                    onChange={(e) => {
                      if (e.target.value === "all") {
                        setSelectedGroup(null);
                        loadDetailData(
                          selectedCategory.id,
                          undefined,
                          selectedPhase === 'all' ? undefined : selectedPhase,
                          selectedRound === 'all' ? undefined : selectedRound
                        );
                      } else {
                        const grp = groups.find((g: any) => g.id === e.target.value);
                        if (grp) handleSelectGroup(grp);
                      }
                    }}
                    className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '14px' }}
                  >
                    <option value="all">Todos los Grupos</option>
                    {groups.map((grp: any) => (
                      <option key={grp.id} value={grp.id}>{grp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {phases.length > 1 && (
                <div className="relative">
                  <select
                    value={selectedPhase}
                    onChange={(e) => handleFilterPhase(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '14px' }}
                  >
                    <option value="all">Todas las Fases</option>
                    {phases.map(p => (
                      <option key={p} value={p}>Fase {p}</option>
                    ))}
                  </select>
                </div>
              )}

              {(activeTab === 'upcoming' || activeTab === 'results') && rounds.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedRound}
                    onChange={(e) => handleFilterRound(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '14px' }}
                  >
                    <option value="all">Todas las Jornadas</option>
                    {rounds.map(r => (
                      <option key={r} value={r}>Jornada {r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex bg-slate-200/50 p-1 rounded-xl mb-3">
              <TabButton
                active={activeTab === 'upcoming'}
                onClick={() => setActiveTab('upcoming')}
                label="Próximos"
              />
              <TabButton
                active={activeTab === 'results'}
                onClick={() => setActiveTab('results')}
                label="Resultados"
              />
              <TabButton
                active={activeTab === 'standings'}
                onClick={() => setActiveTab('standings')}
                label="Posiciones"
              />
            </div>
          </div>
        )}
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {!selectedCategory ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-primary/5 rounded-[30px] flex items-center justify-center mb-6 animate-bounce">
              <BarChart3 size={32} className="text-primary" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Comencemos</h2>
            <p className="text-sm font-medium text-slate-400 mb-8 max-w-[200px]">
              Selecciona una categoría arriba para ver los horarios y resultados.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-3"
              >
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronizando...</span>
              </motion.div>
            ) : (
              <motion.div
                key={`${selectedCategory?.id}-${selectedGroup?.id}-${activeTab}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pb-10"
              >
                {activeTab === 'upcoming' && (
                  <>
                    {(() => {
                      if (upcoming.length === 0) return <EmptyState label="Sin partidos próximos." />;

                      const sortedUpcoming = [...upcoming].sort((a, b) => {
                        // 1. Scheduled status (Programado first)
                        const isAScheduled = a.status.toLowerCase() === 'programado' || 
                                           (a.status.toLowerCase() === 'pendiente' && (a.match_date || a.match_time || a.court || a.court_name || a.court_number));
                        const isBScheduled = b.status.toLowerCase() === 'programado' || 
                                           (b.status.toLowerCase() === 'pendiente' && (b.match_date || b.match_time || b.court || b.court_name || b.court_number));

                        if (isAScheduled && !isBScheduled) return -1;
                        if (!isAScheduled && isBScheduled) return 1;

                        // 2. Date/Time
                        if (a.match_date && b.match_date) {
                          if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
                          if (a.match_time && b.match_time) return a.match_time.localeCompare(b.match_time);
                        } else if (a.match_date) return -1;
                        else if (b.match_date) return 1;

                        // 3. Group Name
                        const nameA = a.group_name || '';
                        const nameB = b.group_name || '';
                        if (nameA !== nameB) return nameA.localeCompare(nameB);
                        
                        // 4. Phase
                        if (a.phase !== b.phase) return (a.phase || 0) - (b.phase || 0);

                        // 5. Round
                        return (a.round || 0) - (b.round || 0);
                      });

                      const groupedIds = Array.from(new Set(sortedUpcoming.map(m => m.league_group_id || 'general')));

                      return (
                        <div className="space-y-8">
                          {groupedIds.map(groupId => {
                            const groupMatches = sortedUpcoming.filter(m => (m.league_group_id || 'general') === groupId);
                            const groupName = groupMatches[0]?.group_name || 'General';
                            const phaseNum = groupMatches[0]?.phase;

                            return (
                              <div key={groupId} className="space-y-3">
                                {groupedIds.length > 1 && (
                                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wider px-2">
                                    {groupName} {phaseNum ? `• Fase ${phaseNum}` : ''}
                                  </h3>
                                )}
                                <div className="space-y-4">
                                  {groupMatches.map(match => (
                                    <MatchCard key={match.id} match={match} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}

                {activeTab === 'results' && (
                  <>
                    {(() => {
                      if (results.length === 0) return <EmptyState label="Sin resultados aún." />;

                      const groupedIds = Array.from(new Set(
                        [...results]
                          .sort((a, b) => {
                            const nameA = a.group_name || '';
                            const nameB = b.group_name || '';
                            if (nameA !== nameB) return nameA.localeCompare(nameB);
                            if (a.phase !== b.phase) return (a.phase || 0) - (b.phase || 0);
                            return (b.round || 0) - (a.round || 0); // Results usually sorted by round desc
                          })
                          .map(m => m.league_group_id || 'general')
                      ));

                      return (
                        <div className="space-y-8">
                          {groupedIds.map(groupId => {
                            const groupMatches = results.filter(m => (m.league_group_id || 'general') === groupId);
                            const groupName = groupMatches[0]?.group_name || 'General';
                            const phaseNum = groupMatches[0]?.phase;

                            return (
                              <div key={groupId} className="space-y-3">
                                {groupedIds.length > 1 && (
                                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-wider px-2">
                                    {groupName} {phaseNum ? `• Fase ${phaseNum}` : ''}
                                  </h3>
                                )}
                                <div className="space-y-4">
                                  {groupMatches.map(match => (
                                    <MatchCard key={match.id} match={match} />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}

                {activeTab === 'standings' && (
                  <div className="space-y-8">
                    {/* Sort standings by group name and phase */}
                    {Array.from(new Set(
                      standings
                        .sort((a, b) => {
                          const nameA = a.group_name || '';
                          const nameB = b.group_name || '';
                          if (nameA !== nameB) return nameA.localeCompare(nameB);
                          return (a.phase || 0) - (b.phase || 0);
                        })
                        .map(s => s.group_id || 'general')
                    )).map(groupId => {
                      const groupStandings = standings.filter(s => (s.group_id || 'general') === groupId);
                      const groupName = groupStandings[0]?.group_name || 'General';
                      const phaseNum = groupStandings[0]?.phase;

                      return (
                        <div key={groupId} className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                          <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                              {groupName} {phaseNum ? `• Fase ${phaseNum}` : ''}
                            </h3>
                          </div>
                          <div className="overflow-x-auto no-scrollbar">
                            <div className="min-w-[450px]">
                              <div className="grid grid-cols-[32px_1fr_30px_30px_30px_40px_40px_40px] gap-2 px-4 py-4 border-b border-slate-50 bg-slate-50/10 text-[8px] font-black text-slate-400 uppercase tracking-wider text-center">
                                <span className="text-left">#</span>
                                <span className="text-left">Pareja</span>
                                <span>PJ</span>
                                <span>PG</span>
                                <span>PP</span>
                                <span>Sets</span>
                                <span>Games</span>
                                <span>Pts</span>
                              </div>
                              <div className="divide-y divide-slate-50">
                                {groupStandings
                                  .sort((a, b) => {
                                    if (b.points !== a.points) return b.points - a.points;
                                    const diffA = a.sets_for - a.sets_against;
                                    const diffB = b.sets_for - b.sets_against;
                                    if (diffA !== diffB) return diffB - diffA;
                                    return (b.games_for - b.games_against) - (a.games_for - a.games_against);
                                  })
                                  .map((row: any, idx: number) => (
                                    <div key={row.id} className="grid grid-cols-[32px_1fr_30px_30px_30px_40px_40px_40px] gap-2 px-4 py-4 items-center hover:bg-slate-50/50 transition-colors text-center">
                                      <span className="text-xs font-black text-slate-300 text-left">{idx + 1}</span>
                                      <span className="text-[10px] font-bold text-slate-800 leading-snug whitespace-normal break-words pr-2 text-left line-clamp-3">{formatTeamName(row.team_name)}</span>
                                      <span className="text-[10px] font-bold text-slate-500">{row.played}</span>
                                      <span className="text-[10px] font-bold text-emerald-500">{row.won}</span>
                                      <span className="text-[10px] font-bold text-rose-500">{row.lost}</span>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-700">{row.sets_for}:{row.sets_against}</span>
                                        <span className={`text-[8px] font-black ${row.sets_for - row.sets_against >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                          {row.sets_for - row.sets_against > 0 ? '+' : ''}{row.sets_for - row.sets_against}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-700">{row.games_for}:{row.games_against}</span>
                                        <span className={`text-[8px] font-black ${row.games_for - row.games_against >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                          {row.games_for - row.games_against > 0 ? '+' : ''}{row.games_for - row.games_against}
                                        </span>
                                      </div>
                                      <span className="text-sm font-black text-primary">{row.points}</span>
                                    </div>
                                  ))}
                                {groupStandings.length === 0 && (
                                  <div className="p-10 text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pendiente de cálculo</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {standings.length === 0 && (
                      <div className="p-10 text-center border border-dashed border-slate-200 rounded-3xl">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin posiciones disponibles</p>
                      </div>
                    )}

                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

// --- Sub-components ---

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-lg ${active
          ? 'bg-white text-primary shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
        }`}
    >
      {label}
    </button>
  );
}

function MatchCard({ match }: { match: LeagueMatch, key?: any }) {
  const isFinished = ['jugado', 'finalizado', 'played', 'walkover', 'w.o.'].includes(match.status.toLowerCase());
  const isWalkover = ['walkover', 'w.o.'].includes(match.status.toLowerCase());
  const hasSets = match.s1_t1 !== undefined && match.s1_t1 !== null;

  // Custom display status logic
  let displayStatus = match.status;
  const courtInfo = match.court_name || match.court || (match.court_number ? `Cancha ${match.court_number}` : null);
  
  if (match.status.toLowerCase() === 'pendiente' && (match.match_date || match.match_time || courtInfo)) {
    displayStatus = 'programado';
  }

  return (
    <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 group">
      {/* Match Meta Header */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-100 text-slate-500 font-black">J1 - R{match.round}</Badge>
            {match.group_name && (
              <Badge className="bg-primary/5 text-primary border border-primary/10 font-black">{match.group_name}</Badge>
            )}
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isWalkover ? 'bg-rose-50 text-rose-600' :
              isFinished ? 'bg-primary/5 text-primary' :
                displayStatus.toLowerCase() === 'programado' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
            {displayStatus}
          </span>
        </div>

        {/* Highlighted Schedule Box */}
        {(match.match_date || courtInfo) && (
          <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 group-hover:bg-primary/5 group-hover:border-primary/10 transition-colors">
            {courtInfo && (
              <div className="bg-emerald-500 text-white px-3 py-2 rounded-xl flex flex-col items-center justify-center min-w-[60px] shadow-lg shadow-emerald-500/20">
                <span className="text-[8px] font-black uppercase leading-none mb-1 opacity-80">Ubicación</span>
                <span className="text-sm font-black leading-tight text-center">
                  {courtInfo.replace(/cancha/i, '').trim() || courtInfo}
                </span>
              </div>
            )}
            <div className="flex flex-col justify-center flex-1">
              {match.match_date && (
                <div className="flex items-center gap-2 text-slate-800">
                  <Calendar size={14} className="text-primary" />
                  <span className="text-[13px] font-black uppercase tracking-tight">{match.match_date}</span>
                </div>
              )}
              {match.match_time && (
                <div className="flex items-center gap-2 text-slate-500 mt-0.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <span className="text-xs font-bold">{match.match_time.substring(0, 5)} hrs</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Team 1 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 overflow-hidden pr-2">
            <div className={`w-1.5 h-10 rounded-full shrink-0 ${isFinished && match.team1_sets > match.team2_sets ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' : 'bg-slate-100'}`} />
            <span className={`text-[13px] font-bold leading-tight ${isFinished && match.team1_sets < match.team2_sets ? 'text-slate-400' : 'text-slate-800'}`}>
              {formatTeamName(match.team1_name)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isFinished && (
              <span className={`font-mono text-2xl font-black w-8 text-right ${match.team1_sets > match.team2_sets ? 'text-primary' : 'text-slate-300'}`}>
                {match.team1_sets}
              </span>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 overflow-hidden pr-2">
            <div className={`w-1.5 h-10 rounded-full shrink-0 ${isFinished && match.team2_sets > match.team1_sets ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' : 'bg-slate-100'}`} />
            <span className={`text-[13px] font-bold leading-tight ${isFinished && match.team2_sets < match.team1_sets ? 'text-slate-400' : 'text-slate-800'}`}>
              {formatTeamName(match.team2_name)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isFinished && (
              <span className={`font-mono text-2xl font-black w-8 text-right ${match.team2_sets > match.team1_sets ? 'text-primary' : 'text-slate-300'}`}>
                {match.team2_sets}
              </span>
            )}
          </div>
        </div>

        {/* Set Details Row */}
        {isFinished && hasSets && (
          <div className="pt-3 mt-2 border-t border-slate-50 flex items-center justify-center gap-4">
            {[1, 2, 3].map(s => {
              const t1 = (match as any)[`s${s}_t1`];
              const t2 = (match as any)[`s${s}_t2`];
              if (t1 === null || t1 === undefined) return null;
              return (
                <div key={s} className="flex flex-col items-center">
                  <span className="text-[8px] font-black text-slate-300 uppercase mb-1">Set {s}</span>
                  <div className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 flex items-center gap-2">
                    <span className={`text-[11px] font-black ${t1 > t2 ? 'text-primary' : 'text-slate-500'}`}>{t1}</span>
                    <span className="text-[10px] text-slate-300">-</span>
                    <span className={`text-[11px] font-black ${t2 > t1 ? 'text-primary' : 'text-slate-500'}`}>{t2}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-slate-50/30">
      <Search size={24} className="text-slate-200" />
      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
    </div>
  );
}
