import React, { useState } from "react";
import logoUrl from '../assets/images/logo.png';
import { motion } from "motion/react";
import {
  Trophy,
  Star,
  RefreshCw,
  Home,
  TrendingUp,
  AlertCircle,
  ArrowUpCircle,
  Timer,
  GraduationCap,
  Printer,
  Download,
  FileText,
} from "lucide-react";
import { UserStats, Question } from "../types";

interface QuizResultProps {
  score: number;
  total: number;
  xpEarned: number;
  stats: UserStats;
  onRestart: () => void;
  onHome: () => void;
  onClaimReward: () => void;
  onContinue: (upgrade: boolean) => void;
  onGenerateMindMap: () => void;
  hasReward: boolean;
  currentFocus?: string;
  onStartSimulado?: () => void;
  wrongQuestions: { text: string; explanation: string }[];
  skippedQuestions?: { text: string }[];
  questionDurations?: { questionText: string; duration: number }[];
  questions?: Question[];
  lastResponses?: { questionId: string; answer: string; isSkipped?: boolean }[];
}

export default function QuizResult({
  score,
  total,
  xpEarned,
  stats,
  onRestart,
  onHome,
  onClaimReward,
  onContinue,
  onGenerateMindMap,
  hasReward,
  currentFocus,
  onStartSimulado,
  wrongQuestions,
  skippedQuestions = [],
  questionDurations = [],
  questions = [],
  lastResponses = [],
}: QuizResultProps) {
  const percentage = Math.round((score / total) * 100);
  const slowQuestions = questionDurations.filter((q) => q.duration > 20);

  let neutralErrors = 0;
  let totalNeutral = 0;
  questions.forEach(q => {
    if (q.contextType === 'neutral' || q.contextType === 'transfer') {
      totalNeutral++;
      if (wrongQuestions.some(wq => wq.text === q.text)) {
        neutralErrors++;
      }
    }
  });
  
  const hasR4Regression = neutralErrors >= 2;
  const canShowReward = hasReward && percentage >= 60 && !hasR4Regression;

  const exportToTxt = () => {
    let content = `Relatório do Quiz e Respostas\n`;
    content += `=============================\n\n`;
    content += `Desempenho: ${score} de ${total} (${percentage}%)\n\n`;

    questions.forEach((q, idx) => {
      content += `${idx + 1}. ${q.text}\n`;
      const contextName = q.contextType === 'neutral' ? 'Neutro' : q.contextType === 'transfer' ? 'Transferência' : 'Hiperfoco';
      content += `   [Contexto: ${contextName}]\n`;
      q.options.forEach((opt) => {
        const isCorrectOpt = opt === q.options[q.correctAnswerIndex];
        content += `   [${isCorrectOpt ? "X" : " "}] ${opt}\n`;
      });

      const response = lastResponses.find((r) => r.questionId === q.id);
      const isCorrect =
        response && response.answer === q.options[q.correctAnswerIndex];

      if (response) {
        content += `\n   Sua Resposta: ${response.isSkipped ? "Pulou a questão" : response.answer}\n`;
        content += `   Status: ${isCorrect ? "Correta" : response.isSkipped ? "Pulada" : "Incorreta"}\n`;
      }

      if (!isCorrect && !response?.isSkipped && q.explanation) {
        content += `   Explicação: ${q.explanation}\n`;
      }

      content += `\n-----------------------------\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `quiz_resultado.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto p-6 text-center print:hidden"
      >
        <div className="glass-card p-10 rounded-[40px] space-y-8 relative overflow-hidden">
          {/* Background Decoration */}
          <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 opacity-5 pointer-events-none grayscale">
            <img
              src={logoUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 opacity-5 pointer-events-none grayscale rotate-180">
            <img
              src={logoUrl}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-4">
            <div className="relative inline-flex mb-4">
              <div className="p-6 bg-yellow-50 rounded-full text-yellow-500 relative z-10">
                <Trophy size={64} />
              </div>
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute -top-6 -right-6 w-24 h-24 bg-white rounded-3xl p-3 shadow-xl border-2 border-indigo-50 z-20"
              >
                <img
                  src={logoUrl}
                  alt="Logo HiperReforço"
                  className="w-full h-full object-contain"
                />
              </motion.div>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900">
              Mandou bem!
            </h1>
            <p className="text-slate-500 text-lg">
              Você completou o desafio com sucesso.
            </p>
          </div>

          {currentFocus && currentFocus !== "Genérico" && percentage >= 50 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border-2 border-indigo-200 p-6 rounded-[34px] space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-center gap-2 text-indigo-600 font-black uppercase text-xs tracking-widest">
                <GraduationCap size={20} />
                Desafio do Mestre!
              </div>
              <p className="text-indigo-900 text-sm font-bold leading-relaxed">
                Você já mostrou que manda MUITO bem em{" "}
                <span className="text-indigo-600">{currentFocus}</span>! 🚀
                <br />
                <span className="text-[10px] text-indigo-700 block mt-2 font-medium">
                  Sabia que para tirar 10 na escola, a gente precisa praticar
                  também com os temas que os professores usam nas provas?
                </span>
              </p>
              <button
                onClick={onStartSimulado}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                Fazer Simulado de Prova 📝
              </button>
              <p className="text-[10px] text-indigo-400 italic">
                Isso vai te ajudar a ficar super preparado para a aula!
              </p>
            </motion.div>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={onGenerateMindMap}
              className="w-full group bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-4 rounded-3xl border-2 border-dashed border-indigo-200 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <div className="p-2 bg-indigo-500 rounded-xl text-white group-hover:rotate-12 transition-transform">
                <TrendingUp size={20} />
              </div>
              Ver Mapa Mental da Matéria 🧠
            </button>
          </div>

          {canShowReward && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl space-y-3"
            >
              <div className="flex items-center justify-center gap-2 text-amber-600 font-black uppercase text-sm tracking-widest">
                <Star size={20} fill="currentColor" />
                Prêmio Liberado!
                <Star size={20} fill="currentColor" />
              </div>
              <p className="text-amber-800 text-sm font-medium">
                Você desbloqueou o Quiz Especial sobre seu Hiperfoco!
              </p>
              <button
                onClick={onClaimReward}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95"
              >
                Resgatar Prêmio 🎁
              </button>
            </motion.div>
          )}

          {hasReward && percentage >= 60 && hasR4Regression && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-indigo-50 border-2 border-indigo-200 p-6 rounded-3xl space-y-3 text-center"
            >
              <div className="flex items-center justify-center gap-2 text-indigo-600 font-black uppercase text-sm tracking-widest">
                <Trophy size={20} fill="currentColor" />
                Missão concluída!
                <Trophy size={20} fill="currentColor" />
              </div>
              <p className="text-indigo-800 text-sm font-medium">
                Ótimo trabalho hoje! Seu professor vai preparar a próxima etapa para continuarmos evoluindo juntos.
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="text-3xl font-black text-primary mb-1">
                {score}/{total}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Acertos
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="text-3xl font-black text-accent mb-1">
                +{xpEarned}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                XP Ganhos
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm font-bold text-slate-600 px-2">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-500 fill-yellow-500" />
                Nível {stats.level}
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                {percentage}% Precisão
              </div>
            </div>
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-1">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(stats.xp % 1000) / 10}%` }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Faltam {1000 - (stats.xp % 1000)} XP para o Nível{" "}
              {stats.level + 1}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            {percentage >= 70 && (
              <button
                onClick={() => onContinue(true)}
                className="btn-primary w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100"
              >
                <ArrowUpCircle size={20} />
                Continuar (Aumentar Dificuldade)
              </button>
            )}
            {percentage < 70 && (
              <button
                onClick={() => onContinue(false)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                Continuar (Mesma Dificuldade)
              </button>
            )}

            {wrongQuestions.length > 0 && (
              <div className="mt-8 text-left space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold px-1">
                  <AlertCircle size={20} className="text-amber-500" />
                  <span className="text-lg">Dicas para Estudar Mais</span>
                </div>
                <div className="space-y-4">
                  {wrongQuestions.slice(0, 2).map((q, i) => (
                    <div
                      key={i}
                      className="bg-white p-5 rounded-[24px] border border-indigo-100 shadow-sm space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 font-bold text-[10px]">
                          !
                        </div>
                        <div className="font-bold text-slate-800 leading-tight">
                          {q.text}
                        </div>
                      </div>
                      <div className="pl-8 text-indigo-700 text-sm leading-relaxed border-l-2 border-indigo-200 italic">
                        <span className="font-bold not-italic text-indigo-900 block mb-1">
                          Dica de Estudo:
                        </span>
                        {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {skippedQuestions.length > 0 && (
              <div className="mt-8 text-left space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold px-1">
                  <AlertCircle size={20} className="text-primary" />
                  <span className="text-lg">Questões Puladas</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-[32px] space-y-4">
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    O aluno optou por pular estas questões por não saber a
                    resposta (Importante para o Especialista):
                  </p>
                  <div className="space-y-2">
                    {skippedQuestions.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm"
                      >
                        <div className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
                        <div className="text-xs font-bold text-slate-700">
                          {q.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {slowQuestions.length > 0 && (
              <div className="mt-8 text-left space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold px-1">
                  <Timer size={20} className="text-blue-500" />
                  <span className="text-lg">Análise de Foco e Tempo</span>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-[32px] space-y-4">
                  <p className="text-xs text-blue-700 font-medium leading-relaxed">
                    Identificamos que estas questões exigiram mais tempo de
                    reflexão (acima de 20s):
                  </p>
                  <div className="space-y-3">
                    {slowQuestions.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-blue-50 shadow-sm"
                      >
                        <div className="text-xs font-bold text-slate-700 line-clamp-1 pr-4">
                          {q.questionText}
                        </div>
                        <div className="whitespace-nowrap bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black">
                          {q.duration}s
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4 print:hidden">
              <button
                onClick={exportToTxt}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <FileText size={18} />
                Baixar (TXT)
              </button>
              <button
                onClick={onRestart}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Reiniciar
              </button>
              <button
                onClick={onHome}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Home size={18} />
                Início
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
