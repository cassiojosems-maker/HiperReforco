import React from 'react';
import { motion } from 'motion/react';
import { 
  ClipboardCheck, 
  ChevronRight, 
  BookOpen, 
  Calendar, 
  Sparkles, 
  ArrowLeft, 
  HelpCircle,
  Loader2,
  CheckCircle2,
  BellRing
} from 'lucide-react';
import { SpecialistAssignment, ChildProfile } from '../types';

interface TeacherMissionsProps {
  assignments: SpecialistAssignment[];
  isLoading?: boolean;
  activeProfile?: ChildProfile | null;
  onStartMission: (assignment: SpecialistAssignment) => void;
  onBackToGenerator: () => void;
}

export default function TeacherMissions({
  assignments,
  isLoading = false,
  activeProfile,
  onStartMission,
  onBackToGenerator
}: TeacherMissionsProps) {

  const formatSigner = (assignment: SpecialistAssignment) => {
    const rawRole = (assignment as any).specialistRole;
    if (rawRole) {
      return `${assignment.specialistName} (${rawRole})`;
    }

    const name = assignment.specialistName || 'Especialista';
    const lower = name.toLowerCase();

    if (lower.startsWith('prof') || lower.includes('prof.')) {
      return name;
    }
    if (lower.startsWith('dr.') || lower.startsWith('dra.')) {
      return `${name} (Psicopedagogo)`;
    }
    return `${name} (Especialista)`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-2">
      {/* Top Header Row with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <button
          onClick={onBackToGenerator}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors w-fit px-3 py-2 rounded-xl hover:bg-indigo-50/50"
          title="Voltar para o gerador de quizzes"
        >
          <ArrowLeft size={18} />
          <span>Voltar ao Gerador</span>
        </button>

        {activeProfile && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 self-start sm:self-auto">
            <span>Perfil Ativo:</span>
            <span className="font-bold text-indigo-700">{activeProfile.name}</span>
          </div>
        )}
      </div>

      {/* Title Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-100/50">
          <ClipboardCheck size={28} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight">
              Missões do Professor
            </h1>
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
              {assignments.length}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Atividades personalizadas preparadas especialmente para reforçar o aprendizado através dos hiperfocos.
          </p>
        </div>
      </div>

      {/* Content States */}
      {isLoading ? (
        <div className="glass-card p-12 rounded-[32px] bg-white border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center space-y-4 my-6">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-800">Carregando missões do professor...</p>
            <p className="text-xs text-slate-400">Verificando atividades atribuídas para este perfil</p>
          </div>
        </div>
      ) : assignments.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 sm:p-14 rounded-[32px] bg-white border border-slate-100 shadow-sm text-center space-y-6 my-6"
        >
          <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mx-auto border border-slate-100">
            <ClipboardCheck size={36} className="text-indigo-400" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug">
              Nenhuma missão atribuída no momento.
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Quando um professor ou especialista enviar uma atividade, ela aparecerá aqui.
            </p>
          </div>
          <button
            onClick={onBackToGenerator}
            className="px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-2xl transition-all text-sm inline-flex items-center gap-2"
          >
            <Sparkles size={16} />
            <span>Criar Quiz Personalizado Agora</span>
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {assignments.map((assignment, index) => {
            const isReminded = !!assignment.remindedAt;
            return (
              <motion.div
                key={assignment.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className={`bg-white rounded-3xl p-6 sm:p-8 border transition-all duration-300 shadow-sm hover:shadow-md ${
                  isReminded 
                    ? 'border-amber-200 ring-4 ring-amber-50/50 bg-gradient-to-br from-white via-white to-amber-50/20' 
                    : 'border-slate-100 hover:border-indigo-100'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Left Column: Details */}
                  <div className="space-y-4 flex-1">
                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                        {assignment.subject}
                      </span>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                        {assignment.questions?.length || 0} questões
                      </span>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Pendente
                      </span>
                      {isReminded && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200 flex items-center gap-1 animate-pulse">
                          <BellRing size={12} />
                          Lembrete do Professor
                        </span>
                      )}
                    </div>

                    {/* Activity name */}
                    <div>
                      <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">
                        Atividade: {assignment.topic}
                      </h3>
                      <p className="text-sm font-semibold text-indigo-900 mt-1">
                        Assinado por: {formatSigner(assignment)}
                      </p>
                    </div>

                    {/* Metadata footer */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                      {assignment.assignedAt && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          Enviado em {formatDate(assignment.assignedAt)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={14} className="text-slate-400" />
                        Disciplina: {assignment.subject}
                      </span>
                    </div>

                    {/* Friendly Reminder Banner */}
                    {isReminded && (
                      <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/60 text-xs text-amber-800 font-medium flex items-center gap-2">
                        <span>🚀</span>
                        <span>Seu professor está esperando por você nesta missão! Que tal começar agora?</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: CTA Button */}
                  <div className="shrink-0 flex sm:self-center">
                    <button
                      onClick={() => onStartMission(assignment)}
                      className={`w-full sm:w-auto px-8 py-4 font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 group text-sm sm:text-base ${
                        isReminded
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                      }`}
                    >
                      <span>Começar Missão</span>
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
