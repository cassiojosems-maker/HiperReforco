import React from 'react';
import { motion } from 'motion/react';
import { 
  Map, 
  ChevronRight, 
  Trash2, 
  WifiOff, 
  Zap, 
  Info, 
  ClipboardCheck, 
  LayoutDashboard, 
  Compass, 
  Users, 
  LogOut,
  Play
} from 'lucide-react';
import { LearningTrail, CachedQuiz, RankingEntry, SpecialistAssignment } from '../types';
import Leaderboard from './Leaderboard';

interface LearningSidebarProps {
  activeTrail: LearningTrail | null;
  onStartTrail: (trail: LearningTrail) => void;
  onContinueTrail: () => void;
  onDeleteTrail?: () => void;
  cachedQuizzes?: CachedQuiz[];
  onStartCachedQuiz?: (quiz: CachedQuiz) => void;
  onDeleteCachedQuiz?: (quizId: string) => void;
  isOffline?: boolean;
  onNavigate?: (screen: 'setup' | 'dashboard' | 'expansion' | 'missions') => void;
  onSwitchProfile?: () => void;
  onLogout?: () => void;
  pendingMissionsCount?: number;
  currentScreen?: string;
  rankings?: RankingEntry[];
  assignments?: SpecialistAssignment[];
  onStartAssignment?: (assignment: SpecialistAssignment) => void;
}

export default function LearningSidebar({
  activeTrail,
  onStartTrail,
  onContinueTrail,
  onDeleteTrail,
  cachedQuizzes = [],
  onStartCachedQuiz,
  onDeleteCachedQuiz,
  isOffline = false,
  onNavigate,
  onSwitchProfile,
  onLogout,
  pendingMissionsCount = 0,
  currentScreen = 'setup',
  rankings = [],
  assignments = [],
  onStartAssignment
}: LearningSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Menu Lateral Esquerdo / Navegação dos Pais */}
      <div className="glass-card p-3 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
          Menu Principal
        </div>
        
        {/* 1. Painel */}
        <button
          type="button"
          onClick={() => onNavigate?.('dashboard')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
            currentScreen === 'dashboard'
              ? 'bg-indigo-50 text-indigo-700 font-bold'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <LayoutDashboard size={18} className="text-indigo-500" />
            <span>Painel</span>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </button>

        {/* 2. Expansão do Hiperfoco */}
        <button
          type="button"
          onClick={() => onNavigate?.('expansion')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
            currentScreen === 'expansion'
              ? 'bg-indigo-50 text-indigo-700 font-bold'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Compass size={18} className="text-purple-500" />
            <span>Expansão do Hiperfoco</span>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </button>

        {/* 3. Trocar Perfil */}
        {onSwitchProfile && (
          <button
            type="button"
            onClick={onSwitchProfile}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-emerald-500" />
              <span>Trocar Perfil</span>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        )}

        {/* 4. Salvos Offline */}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('offline-quizzes-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold text-slate-600 hover:text-amber-600 hover:bg-amber-50/50 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff size={18} className="text-amber-500" />
            <span>Salvos Offline</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
            {cachedQuizzes.length}
          </span>
        </button>

        {/* 5. Missões do Professor */}
        <button
          type="button"
          onClick={() => onNavigate?.('missions')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
            currentScreen === 'missions'
              ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-100'
              : 'text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ClipboardCheck size={18} className={currentScreen === 'missions' ? 'text-white' : 'text-indigo-600'} />
            <span className={currentScreen === 'missions' ? 'text-white' : 'font-bold text-slate-800'}>
              Missões do Professor
            </span>
          </div>
          {pendingMissionsCount > 0 ? (
            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
              currentScreen === 'missions' 
                ? 'bg-white text-indigo-600' 
                : 'bg-indigo-100 text-indigo-700 animate-pulse'
            }`}>
              {pendingMissionsCount}
            </span>
          ) : (
            <ChevronRight size={16} className={currentScreen === 'missions' ? 'text-indigo-200' : 'text-slate-400'} />
          )}
        </button>

        {/* 6. Sair */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <LogOut size={18} className="text-rose-500" />
              <span>Sair</span>
            </div>
          </button>
        )}
      </div>

      {/* Learning Trails Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <Map size={20} className="text-emerald-500" />
          <h2 className="font-bold text-slate-800">Sua Jornada</h2>
          <div className="group relative">
            <Info size={14} className="text-slate-400 cursor-pointer" />
            <div className="absolute left-0 top-6 w-48 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
              Acompanhe seu avanço pelas trilhas de aprendizado personalizadas.
            </div>
          </div>
        </div>
        
        {activeTrail ? (
          <div className="glass-card p-6 rounded-3xl bg-emerald-50/50 border-emerald-100">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <div className="text-sm font-bold text-emerald-900 text-left">Trilha: {activeTrail.topic}</div>
                <div className="text-xs text-emerald-600 text-left">{activeTrail.subject} • {activeTrail.focus}</div>
              </div>
              <div className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase">
                {activeTrail.currentStep} de {activeTrail.totalSteps}
              </div>
            </div>
            
            <div className="relative h-2 bg-emerald-100 rounded-full mb-8">
              <div 
                className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                style={{ width: `${(activeTrail.currentStep / activeTrail.totalSteps) * 100}%` }}
              />
            </div>

            <button 
              type="button"
              onClick={onContinueTrail}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              Continuar Jornada
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="glass-card p-6 rounded-3xl bg-slate-50 border-slate-200 text-center space-y-3">
            <p className="text-sm text-slate-500">Nenhuma trilha ativa.</p>
          </div>
        )}
      </div>

      {/* Salvos Offline Section */}
      <div id="offline-quizzes-section" className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <WifiOff size={20} className="text-amber-500" />
            <h2 className="font-bold text-slate-800">Salvos Offline</h2>
            <div className="group relative">
              <Info size={14} className="text-slate-400 cursor-pointer" />
              <div className="absolute left-0 top-6 w-48 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                Acesse seus quizzes favoritos mesmo sem conexão com a internet.
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
            {cachedQuizzes.length}
          </span>
        </div>

        {cachedQuizzes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {cachedQuizzes.map((quiz) => (
              <div key={quiz.id} className="relative group">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onStartCachedQuiz?.(quiz)}
                  className="glass-card p-4 rounded-3xl text-left border-amber-100 hover:border-amber-200 transition-all w-full"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-amber-50 text-amber-500 rounded-xl group-hover:bg-amber-100 transition-colors">
                      <Zap size={18} />
                    </div>
                  </div>
                  <div className="font-bold text-slate-800 text-sm line-clamp-1">{quiz.config.subject}: {quiz.config.topic}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded-lg text-slate-500 uppercase">{quiz.questions.length} questões</span>
                  </div>
                </motion.button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Tem certeza que deseja excluir este quiz salvo?')) {
                      onDeleteCachedQuiz?.(quiz.id);
                    }
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                  title="Excluir quiz salvo"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-5 rounded-3xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-xs text-slate-500">Nenhum quiz salvo offline no momento.</p>
          </div>
        )}
      </div>

      {/* Missão do Professor - abaixo das atividades salvas e acima do ranking */}
      <div id="teacher-missions-sidebar" className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={20} className="text-indigo-600" />
            <h2 className="font-bold text-slate-800">Missão do Professor</h2>
          </div>
          {assignments.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 animate-pulse">
              {assignments.length} {assignments.length === 1 ? 'pendente' : 'pendentes'}
            </span>
          )}
        </div>

        {assignments.length > 0 ? (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const isReminded = !!(assignment as any).remindedAt;
              return (
                <div 
                  key={assignment.id} 
                  className={`glass-card p-4 rounded-3xl transition-all border ${
                    isReminded 
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-200/50' 
                      : 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-200'
                  } space-y-3 shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      isReminded ? 'bg-white text-amber-500' : 'bg-white text-indigo-600'
                    }`}>
                      <Play size={18} fill="currentColor" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-bold leading-tight ${
                        isReminded ? 'text-amber-950' : 'text-indigo-950'
                      }`}>
                        Atividade: {assignment.topic}
                      </div>
                      <div className={`text-xs mt-0.5 ${
                        isReminded ? 'text-amber-700' : 'text-indigo-600'
                      }`}>
                        Assinado por: {assignment.specialistName}
                      </div>
                      {isReminded && (
                        <div className="text-[10px] font-bold text-amber-700 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-full inline-block mt-1.5">
                          🚀 Professor aguardando sua resposta!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/40">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white/80 rounded-lg text-slate-500 uppercase">
                      {assignment.subject} • {assignment.questions?.length || 0} q
                    </span>
                    <button 
                      type="button"
                      onClick={() => onStartAssignment?.(assignment)}
                      className={`px-3.5 py-1.5 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 ${
                        isReminded 
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 animate-pulse' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                      }`}
                    >
                      <span>Começar Missão</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card p-5 rounded-3xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-xs text-slate-500">Nenhuma missão pendente no momento.</p>
          </div>
        )}
      </div>

      {/* Ranking da Turma - Posicionado na coluna esquerda abaixo de Missão do Professor */}
      <div className="space-y-4">
        <Leaderboard rankings={rankings} />
      </div>

      {/* Dica do Professor */}
      <div className="glass-card p-6 rounded-3xl bg-indigo-600 text-white border-none shadow-indigo-200">
        <h3 className="font-display font-bold text-lg mb-2">Dica do Professor 👨‍🏫</h3>
        <p className="text-indigo-100 text-sm leading-relaxed">
          "O aprendizado acontece quando a gente se diverte. Não tenha medo de errar, cada erro é uma chance de aprender algo novo!"
        </p>
      </div>
    </div>
  );
}

