import React from 'react';
import { motion } from 'motion/react';
import { 
  Trash2, 
  WifiOff, 
  Zap, 
  Info, 
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Play
} from 'lucide-react';
import { LearningTrail, CachedQuiz, SpecialistAssignment } from '../types';

interface LearningSidebarProps {
  activeTrail: LearningTrail | null;
  onStartTrail?: (trail: LearningTrail) => void;
  onContinueTrail: () => void;
  onDeleteTrail?: () => void;
  cachedQuizzes?: CachedQuiz[];
  onStartCachedQuiz?: (quiz: CachedQuiz) => void;
  onDeleteCachedQuiz?: (quizId: string) => void;
  isOffline?: boolean;
  assignments?: SpecialistAssignment[];
  onStartAssignment?: (assignment: SpecialistAssignment) => void;
}

export default function LearningSidebar({
  activeTrail,
  onContinueTrail,
  cachedQuizzes = [],
  onStartCachedQuiz,
  onDeleteCachedQuiz,
  assignments = [],
  onStartAssignment
}: LearningSidebarProps) {
  const defaultAssignments: SpecialistAssignment[] = [
    {
      id: 'mock-assign-1',
      specialistId: 'doc-roberto',
      specialistName: 'Dr. Roberto Souza (Psicopedagogo)',
      studentId: 'current',
      subject: 'Matemática',
      topic: 'Formas e Cores',
      questions: [
        {
          id: 'q-1',
          text: 'Qual figura geométrica possui exatamente 3 lados?',
          options: ['Quadrado', 'Triângulo', 'Círculo', 'Retângulo'],
          correctAnswerIndex: 1,
          explanation: 'O triângulo possui exatamente três lados.',
          contextType: 'neutral'
        }
      ],
      status: 'pending',
      assignedAt: new Date().toISOString()
    },
    {
      id: 'mock-assign-2',
      specialistId: 'prof-ana',
      specialistName: 'Prof. Ana',
      studentId: 'current',
      subject: 'Matemática',
      topic: 'Matemática com Redstone',
      questions: [
        {
          id: 'q-2',
          text: 'Em um circuito de Redstone com 4 repetidores no nível 2, qual o atraso em ticks?',
          options: ['4 ticks', '8 ticks', '12 ticks', '16 ticks'],
          correctAnswerIndex: 1,
          explanation: '4 repetidores * 2 ticks = 8 ticks.',
          contextType: 'hyperfocus'
        }
      ],
      status: 'pending',
      assignedAt: new Date().toISOString()
    }
  ];

  const displayAssignments = assignments && assignments.length > 0 ? assignments : defaultAssignments;

  return (
    <div className="space-y-6">
      {/* Learning Trails Section / Sua Jornada */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <BookOpen size={18} className="text-emerald-500" />
          <h2 className="font-bold text-slate-800 text-sm">Sua Jornada</h2>
          <div className="group relative">
            <Info size={14} className="text-slate-400 cursor-pointer" />
            <div className="absolute left-0 top-6 w-48 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
              Acompanhe seu avanço pelas trilhas de aprendizado personalizadas.
            </div>
          </div>
        </div>
        
        {activeTrail ? (
          <div className="glass-card p-5 rounded-3xl bg-emerald-50/50 border-emerald-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-emerald-900 text-left">Trilha: {activeTrail.topic}</div>
                <div className="text-xs text-emerald-600 text-left">{activeTrail.subject} • {activeTrail.focus}</div>
              </div>
              <div className="text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase">
                {activeTrail.currentStep} de {activeTrail.totalSteps}
              </div>
            </div>
            
            <div className="relative h-2 bg-emerald-100 rounded-full mb-6">
              <div 
                className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                style={{ width: `${(activeTrail.currentStep / activeTrail.totalSteps) * 100}%` }}
              />
            </div>

            <button 
              type="button"
              onClick={onContinueTrail}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-md shadow-emerald-100 flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
            >
              Continuar Jornada
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="glass-card p-6 rounded-3xl bg-white border border-slate-100 shadow-sm text-center">
            <p className="text-sm font-medium text-slate-400">Nenhuma trilha ativa.</p>
          </div>
        )}
      </div>

      {/* Salvos (Offline) Section */}
      <div id="offline-quizzes-section" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <WifiOff size={18} className="text-amber-500" />
            <h2 className="font-bold text-slate-800 text-sm">Salvos (Offline)</h2>
            <div className="group relative">
              <Info size={14} className="text-slate-400 cursor-pointer" />
              <div className="absolute left-0 top-6 w-48 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                Acesse seus quizzes favoritos mesmo sem conexão com a internet.
              </div>
            </div>
          </div>
        </div>

        {cachedQuizzes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {cachedQuizzes.map((quiz) => (
              <div key={quiz.id} className="relative group">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onStartCachedQuiz?.(quiz)}
                  className="glass-card p-4 rounded-3xl text-left bg-white border border-slate-100 hover:border-amber-200 transition-all w-full shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0">
                      <Zap size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 text-sm line-clamp-1">{quiz.config.subject}: {quiz.config.topic}</div>
                      <div className="mt-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded-md text-slate-500 uppercase">{quiz.questions.length} QUESTÕES</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Tem certeza que deseja excluir este quiz salvo?')) {
                      onDeleteCachedQuiz?.(quiz.id);
                    }
                  }}
                  className="absolute top-3 right-3 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                  title="Excluir quiz salvo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-5 rounded-3xl bg-white border border-slate-100 shadow-sm text-center">
            <p className="text-xs font-medium text-slate-400">Nenhum quiz salvo offline.</p>
          </div>
        )}
      </div>

      {/* Missões do Professor */}
      <div id="teacher-missions-sidebar" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-sm">Missões do Professor</h2>
          </div>
        </div>

        {displayAssignments.length > 0 ? (
          <div className="space-y-3">
            {displayAssignments.map((assignment) => (
              <div 
                key={assignment.id} 
                className="glass-card p-4 rounded-3xl bg-white border border-slate-100 hover:border-indigo-200 transition-all space-y-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Play size={16} fill="currentColor" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold leading-tight text-slate-800">
                      Atividade: {assignment.topic}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      Assinado por: {assignment.specialistName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 rounded-lg text-slate-400 uppercase">
                    {assignment.subject}
                  </span>
                  <button 
                    type="button"
                    onClick={() => onStartAssignment?.(assignment)}
                    className="px-3 py-1.5 font-bold text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1 transition-all active:scale-95"
                  >
                    <span>Começar Missão</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-5 rounded-3xl bg-white border border-slate-100 shadow-sm text-center">
            <p className="text-xs font-medium text-slate-400">Nenhuma missão pendente.</p>
          </div>
        )}
      </div>
    </div>
  );
}

