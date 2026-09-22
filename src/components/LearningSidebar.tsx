import React from 'react';
import { motion } from 'motion/react';
import { Map, Star, ChevronRight, Trash2, WifiOff, Zap, Info } from 'lucide-react';
import { LearningTrail, CachedQuiz } from '../types';

interface LearningSidebarProps {
  activeTrail: LearningTrail | null;
  onStartTrail: (trail: LearningTrail) => void;
  onContinueTrail: () => void;
  onDeleteTrail?: () => void;
  cachedQuizzes?: CachedQuiz[];
  onStartCachedQuiz?: (quiz: CachedQuiz) => void;
  onDeleteCachedQuiz?: (quizId: string) => void;
  isOffline?: boolean;
}

export default function LearningSidebar({
  activeTrail,
  onStartTrail,
  onContinueTrail,
  onDeleteTrail,
  cachedQuizzes = [],
  onStartCachedQuiz,
  onDeleteCachedQuiz,
  isOffline = false
}: LearningSidebarProps) {
  return (
    <div className="space-y-8">
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

      {/* Offline / Cached Quizzes Section */}
      {cachedQuizzes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <WifiOff size={20} className="text-amber-500" />
              <h2 className="font-bold text-slate-800">Salvos (Offline)</h2>
              <div className="group relative">
                <Info size={14} className="text-slate-400 cursor-pointer" />
                <div className="absolute left-0 top-6 w-48 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                  Acesse seus quizzes favoritos mesmo sem conexão com a internet.
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
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
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
