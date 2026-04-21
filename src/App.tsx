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
    const grps = await dataService.getGroupsByCategory(cat.id);
    setGroups(grps);
    
    if (grps.length === 0) {
      await loadDetailData(cat.id);
    } else {
      setLoading(false);
    }
  };

  const handleSelectGroup = async (group: LeagueGroup) => {
    setSelectedGroup(group);
    await loadDetailData(selectedCategory?.id!, group.id);
  };

  const loadDetailData = async (catId: string, grpId?: string) => {
    setLoading(true);
    const [up, res, std] = await Promise.all([
      dataService.getUpcomingMatches(catId, grpId),
      dataService.getResults(catId, grpId),
      grpId ? dataService.getStandings(grpId) : Promise.resolve([])
    ]);
    setUpcoming(up);
    setResults(res);
    setStandings(std);
    setLoading(false);
  };

  const resetSelection = () => {
    setSelectedCategory(null);
    setSelectedGroup(null);
    setGroups([]);
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
        resetSelection={resetSelection}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        upcoming={upcoming}
        results={results}
        standings={standings}
        groups={groups}
        season={season}
        categories={categories}
      />
    </div>
  );
}

// --- App Content Component ---

function AppContent({ 
  loading, isDetailView, selectedCategory, selectedGroup, 
  handleSelectCategory, handleSelectGroup, resetSelection,
  activeTab, setActiveTab, upcoming, results, standings,
  groups, season, categories
}: any) {
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Sticky Top Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h1 className="text-primary font-black text-xl tracking-tighter leading-none">
                LIGA PRO
              </h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {season?.name || 'Temporada Actual'}
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
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${
                    isActive 
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
            {groups.length > 0 && (
              <div className="mb-3 relative">
                <select 
                  value={selectedGroup?.id || ""} 
                  onChange={(e) => {
                    const grp = groups.find((g: any) => g.id === e.target.value);
                    if (grp) handleSelectGroup(grp);
                  }}
                  className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center', backgroundSize: '16px' }}
                >
                  <option value="" disabled>Selecciona un Grupo</option>
                  {groups.map((grp: any) => (
                    <option key={grp.id} value={grp.id}>{grp.name}</option>
                  ))}
                </select>
              </div>
            )}

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
                    {upcoming.length > 0 ? upcoming.map((match: LeagueMatch) => (
                      <div key={match.id}>
                        <MatchCard match={match} />
                      </div>
                    )) : (
                      <EmptyState label="Sin partidos próximos." />
                    )}
                  </>
                )}

                {activeTab === 'results' && (
                  <>
                    {results.length > 0 ? results.map((match: LeagueMatch) => (
                      <div key={match.id}>
                        <MatchCard match={match} />
                      </div>
                    )) : (
                      <EmptyState label="Sin resultados aún." />
                    )}
                  </>
                )}

                {activeTab === 'standings' && (
                  <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                    <div className="grid grid-cols-[32px_1fr_40px_40px] gap-2 px-4 py-4 border-b border-slate-50 bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      <span>#</span>
                      <span>Pareja</span>
                      <span className="text-center">PJ</span>
                      <span className="text-center">Pts</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {standings.length > 0 ? standings.map((row: any, idx: number) => (
                        <div key={row.id} className="grid grid-cols-[32px_1fr_40px_40px] gap-2 px-4 py-4 items-center hover:bg-slate-50/50 transition-colors">
                          <span className="text-xs font-black text-slate-300">{idx + 1}</span>
                          <span className="text-sm font-bold text-slate-800 leading-tight truncate pr-2">{formatTeamName(row.team_name)}</span>
                          <span className="text-xs font-bold text-slate-500 text-center">{row.played}</span>
                          <span className="text-sm font-black text-primary text-center">{row.points}</span>
                        </div>
                      )) : (
                        <div className="p-10 text-center">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pendiente de cálculo</p>
                        </div>
                      )}
                    </div>
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
      className={`flex-1 py-2 text-[11px] font-bold transition-all rounded-lg ${
        active 
          ? 'bg-white text-primary shadow-sm' 
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function MatchCard({ match }: { match: LeagueMatch }) {
  const isFinished = ['jugado', 'finalizado', 'played', 'walkover', 'w.o.'].includes(match.status.toLowerCase());
  const isWalkover = ['walkover', 'w.o.'].includes(match.status.toLowerCase());
  const hasSets = match.s1_t1 !== undefined && match.s1_t1 !== null;

  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-slate-100 text-slate-500">Jornada {match.round}</Badge>
          {match.match_date && (
            <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Calendar size={12} />
              {match.match_date} {match.match_time?.substring(0, 5)}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest ${
          isWalkover ? 'text-rose-500' : 
          isFinished ? 'text-primary' : 'text-amber-500'
        }`}>
          {match.status}
        </span>
      </div>

      <div className="space-y-4">
        {/* Team 1 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-1 h-8 rounded-full ${isFinished && match.team1_sets > match.team2_sets ? 'bg-primary' : 'bg-slate-100'}`} />
            <span className={`text-sm font-bold truncate ${isFinished && match.team1_sets < match.team2_sets ? 'text-slate-400' : 'text-slate-800'}`}>
              {formatTeamName(match.team1_name)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isFinished && hasSets && (
              <div className="flex gap-1.5">
                {[1, 2, 3].map(s => {
                  const t1 = (match as any)[`s${s}_t1`];
                  const t2 = (match as any)[`s${s}_t2`];
                  if (t1 === null || t1 === undefined) return null;
                  return (
                    <span key={s} className={`text-[11px] font-bold w-4 text-center ${t1 > t2 ? 'text-slate-800' : 'text-slate-400'}`}>
                      {t1}
                    </span>
                  );
                })}
              </div>
            )}
            {isFinished && (
              <span className="font-mono text-lg font-black text-primary w-6 text-right">
                {match.team1_sets}
              </span>
            )}
          </div>
        </div>

        {/* Team 2 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`w-1 h-8 rounded-full ${isFinished && match.team2_sets > match.team1_sets ? 'bg-primary' : 'bg-slate-100'}`} />
            <span className={`text-sm font-bold truncate ${isFinished && match.team2_sets < match.team1_sets ? 'text-slate-400' : 'text-slate-800'}`}>
              {formatTeamName(match.team2_name)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isFinished && hasSets && (
              <div className="flex gap-1.5">
                {[1, 2, 3].map(s => {
                  const t1 = (match as any)[`s${s}_t1`];
                  const t2 = (match as any)[`s${s}_t2`];
                  if (t2 === null || t2 === undefined) return null;
                  return (
                    <span key={s} className={`text-[11px] font-bold w-4 text-center ${t2 > t1 ? 'text-slate-800' : 'text-slate-400'}`}>
                      {t2}
                    </span>
                  );
                })}
              </div>
            )}
            {isFinished && (
              <span className="font-mono text-lg font-black text-primary w-6 text-right">
                {match.team2_sets}
              </span>
            )}
          </div>
        </div>
      </div>

      {(match.court || match.court_number) && (
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Trophy size={11} />
            {match.court} {match.court_number ? `#${match.court_number}` : ''}
          </span>
        </div>
      )}
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
