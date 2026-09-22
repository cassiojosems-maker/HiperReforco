import React from "react";
import { motion } from "motion/react";
import logoUrl from '../assets/images/logo.png';
import { UserStats, QuizHistoryEntry } from "../types";
import {
  BarChart3,
  Award,
  History,
  CheckCircle2,
  XCircle,
  Calendar,
  ChevronRight,
  FileText,
  MessageSquare,
  UserCheck,
  FolderOpen,
  Download,
  Trash2,
  Printer,
  TrendingUp,
  Bell,
  BellOff,
  Clock,
  Settings,
  Play,
} from "lucide-react";
import { generatePedagogicalReport } from "../services/reportService";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { showToast } from "../lib/useToast";

import { SpecialistAssignment } from '../types';
import WeeklyReport from "./WeeklyReport";

interface DashboardProps {
  stats: UserStats;
  assignments?: SpecialistAssignment[];
  onStartAssignment?: (assignment: SpecialistAssignment) => void;
  onClose: () => void;
  onDeleteHistoryEntry?: (id: string) => void;
  onArchiveHistoryEntry?: (id: string, archive: boolean) => void;
}

const getBadgeImage = (badge: { id?: string; badgeId?: string; icon?: string }) => {
  const iconLower = (badge.icon || '').toLowerCase();
  const idLower = (badge.badgeId || badge.id || '').toLowerCase();
  
  if (iconLower === 'ouro' || idLower === 'knowledge-explorer' || idLower === 'perfect') {
    return '/assets/images/badges/ouro.jpg';
  }
  if (iconLower === 'prata' || idLower === 'connecting-ideas') {
    return '/assets/images/badges/prata.jpg';
  }
  if (iconLower === 'bronze' || idLower === 'knowledge-pioneer') {
    return '/assets/images/badges/bronze.jpg';
  }
  
  if (iconLower.includes('🧠') || idLower.includes('perfect') || idLower.includes('explorer')) {
    return '/assets/images/badges/ouro.jpg';
  }
  if (idLower.includes('ideas')) {
    return '/assets/images/badges/prata.jpg';
  }
  
  return '/assets/images/badges/bronze.jpg';
};

export default function Dashboard({
  stats,
  assignments = [],
  onStartAssignment,
  onClose,
  onDeleteHistoryEntry,
  onArchiveHistoryEntry,
}: DashboardProps) {
  const [activeTab, setActiveTab] = React.useState<"recent" | "archived">("recent");
  const [dashboardView, setDashboardView] = React.useState<"general" | "weekly">(
    "general"
  );

  const reportRef = React.useRef<HTMLDivElement>(null);
  const [selectedQuizForPdf, setSelectedQuizForPdf] =
    React.useState<QuizHistoryEntry | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  // States for Daily Reminders
  const [reminderEnabled, setReminderEnabled] = React.useState(stats.reminderEnabled ?? false);
  const [reminderTime, setReminderTime] = React.useState(stats.reminderTime ?? "16:00");
  const [reminderMessage, setReminderMessage] = React.useState(
    stats.reminderMessage ?? "Olá {nome}! Hora de treinar seu hiperfoco no HiperReforço! 🚀"
  );
  const [notificationPermission, setNotificationPermission] = React.useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const activeProfile = stats.profiles?.find((p) => p.id === stats.activeProfileId);
  const childName = activeProfile ? activeProfile.name : "estudante";

  React.useEffect(() => {
    if (stats.reminderEnabled !== undefined) {
      setReminderEnabled(stats.reminderEnabled);
    }
    if (stats.reminderTime) {
      setReminderTime(stats.reminderTime);
    }
    if (stats.reminderMessage) {
      setReminderMessage(stats.reminderMessage);
    }
  }, [stats.reminderEnabled, stats.reminderTime, stats.reminderMessage]);

  React.useEffect(() => {
    if (!reminderEnabled) return;

    let lastTriggeredDate = "";

    const checkReminder = () => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const currentDateString = now.toDateString();

      if (currentHHMM === reminderTime && lastTriggeredDate !== currentDateString) {
        lastTriggeredDate = currentDateString;

        const message = reminderMessage.replace("{nome}", childName);

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("HiperReforço 🚀", {
              body: message,
              icon: logoUrl,
            });
          } catch (err) {
            console.error("Background notification blocked:", err);
            showToast(`[Lembrete Diário] ${message}`, "success", 7000);
          }
        } else {
          showToast(`[Lembrete Diário] ${message}`, "success", 7000);
        }
      }
    };

    checkReminder();
    const interval = setInterval(checkReminder, 30000);
    return () => clearInterval(interval);
  }, [reminderEnabled, reminderTime, reminderMessage, childName]);

  const handleRequestPermission = async () => {
    if (!("Notification" in window)) {
      showToast("Este navegador não suporta notificações de área de trabalho.", "warning");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted") {
        showToast("Permissão para notificações concedida!", "success");
      } else if (perm === "denied") {
        showToast("Permissão para notificações negada.", "warning");
      }
    } catch (err) {
      console.error("Erro ao solicitar permissão de notificação:", err);
    }
  };

  const handleSaveReminder = async () => {
    if (!stats.uid) {
      showToast("Você precisa estar logado para salvar as configurações.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const userRef = doc(db, "users", stats.uid);
      await updateDoc(userRef, {
        reminderEnabled,
        reminderTime,
        reminderMessage,
      });
      showToast("Configuração de lembretes salva com sucesso!", "success");
    } catch (error) {
      console.error("Erro ao salvar lembrete no Firestore:", error);
      showToast("Erro ao salvar configuração.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = () => {
    const message = reminderMessage.replace("{nome}", childName);
    
    if (!("Notification" in window)) {
      showToast(`[Lembrete Local] ${message}`, "success", 6000);
      return;
    }
    
    if (Notification.permission !== "granted") {
      showToast("Por favor, conceda permissão para receber notificações reais. Exibindo demonstração em tela.", "info");
      handleRequestPermission();
      showToast(`[Lembrete Local] ${message}`, "success", 6000);
      return;
    }

    try {
      new Notification("HiperReforço 🚀", {
        body: message,
        icon: logoUrl,
      });
      showToast("Lembrete de teste enviado!", "success");
    } catch (err) {
      console.error("Erro ao enviar notificação local:", err);
      showToast(`[Lembrete Local] ${message}`, "success", 6000);
    }
  };

  React.useEffect(() => {
    let active = true;
    if (selectedQuizForPdf && isGeneratingPdf) {
      const timer = setTimeout(async () => {
        if (!active) return;
        if (reportRef.current) {
          try {
            const canvas = await html2canvas(reportRef.current, {
              scale: 2,
              useCORS: true,
              logging: false,
              allowTaint: true,
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
              heightLeft -= pageHeight;
            }
            pdf.save(`relatorio-quiz-${selectedQuizForPdf.id}.pdf`);
          } catch (error) {
            console.error("Erro ao gerar PDF:", error);
          } finally {
            setSelectedQuizForPdf(null);
            setIsGeneratingPdf(false);
          }
        }
      }, 150);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [selectedQuizForPdf, isGeneratingPdf]);

  const handleGenerateQuizPdf = (entry: QuizHistoryEntry) => {
    setSelectedQuizForPdf(entry);
    setIsGeneratingPdf(true);
  };

  const exportEntryToTxt = (entry: any) => {
    let content = `Relatório do Quiz Arquivado\n`;
    content += `===========================\n\n`;
    content += `Conteúdo: ${entry.subject} - ${entry.topic}\n`;
    content += `Hiperfoco: ${entry.focus}\n`;
    content += `Data: ${new Date(entry.date).toLocaleDateString("pt-BR")}\n`;
    content += `Desempenho: ${entry.score} de ${entry.total} (${Math.round((entry.score / entry.total) * 100)}%)\n\n`;

    if (entry.questions && entry.questions.length > 0) {
      entry.questions.forEach((q: any, idx: number) => {
        content += `${idx + 1}. ${q.text}\n`;
        q.options?.forEach((opt: string) => {
          content += `   [${opt === q.correctAnswer ? "X" : " "}] ${opt}\n`;
        });

        const response = entry.responses?.find(
          (r: any) => r.questionId === q.id,
        );
        const isCorrect = response && response.answer === q.correctAnswer;

        if (response) {
          content += `\n   Sua Resposta: ${response.isSkipped ? "Pulou a questão" : response.answer}\n`;
          content += `   Status: ${isCorrect ? "Correta" : response.isSkipped ? "Pulada" : "Incorreta"}\n`;
        }

        if (!isCorrect && !response?.isSkipped && q.explanation) {
          content += `   Explicação: ${q.explanation}\n`;
        }

        content += `\n-----------------------------\n\n`;
      });
    } else {
      if (entry.wrongQuestions && entry.wrongQuestions.length > 0) {
        content += `Questões Incorretas:\n`;
        entry.wrongQuestions.forEach((q: any, idx: number) => {
          content += `${idx + 1}. ${q.text}\n`;
          content += `   Correção/Explicação: ${q.explanation}\n\n`;
        });
      }
      if (entry.skippedQuestions && entry.skippedQuestions.length > 0) {
        content += `Questões Puladas:\n`;
        entry.skippedQuestions.forEach((q: any, idx: number) => {
          content += `${idx + 1}. ${q.text}\n\n`;
        });
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `quiz_historico_${entry.subject}_${entry.topic}.txt`.replace(/\s+/g, "_"),
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportHistoryToCSV = () => {
    if (!stats.history || stats.history.length === 0) {
      alert("Nenhum histórico disponível para exportação.");
      return;
    }

    const headers = [
      "Data",
      "Matéria",
      "Tópico",
      "Hiperfoco",
      "Acertos",
      "Total",
      "Porcentagem",
      "Status",
      "Questoes Hiperfoco",
      "Acertos Hiperfoco",
      "Questoes Transferencia",
      "Acertos Transferencia",
      "Questoes Neutro",
      "Acertos Neutro",
      "Indice Generalizacao",
    ];

    const escapeCSV = (str: string | undefined | null | number) => {
      if (str === null || str === undefined) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvRows = (stats.history || []).map((entry) => {
      const date = new Date(entry.date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const pct = Math.round((entry.score / entry.total) * 100) + "%";
      const status = entry.isArchived ? "Arquivado" : "Recente";

      let entryHyperfocusQuestions = 0;
      let entryHyperfocusCorrect = 0;
      let entryTransferQuestions = 0;
      let entryTransferCorrect = 0;
      let entryNeutralQuestions = 0;
      let entryNeutralCorrect = 0;

      if (entry.questions && entry.questions.length > 0) {
        entry.questions.forEach((q: any) => {
          const context = q.contextType || "hyperfocus";
          const response = entry.responses?.find((r: any) => r.questionId === q.id);
          const isCorrect = response && (response.answer === q.correctAnswer || (q.options && q.correctAnswerIndex !== undefined && response.answer === q.options[q.correctAnswerIndex]));

          if (context === "hyperfocus") {
            entryHyperfocusQuestions++;
            if (isCorrect) entryHyperfocusCorrect++;
          } else if (context === "transfer") {
            entryTransferQuestions++;
            if (isCorrect) entryTransferCorrect++;
          } else if (context === "neutral") {
            entryNeutralQuestions++;
            if (isCorrect) entryNeutralCorrect++;
          }
        });
      }

      const entryGeneralizationIndex = entryHyperfocusCorrect > 0 
        ? ((entryNeutralCorrect + entryTransferCorrect) / entryHyperfocusCorrect).toFixed(2)
        : "0.00";

      return [
        escapeCSV(date),
        escapeCSV(entry.subject),
        escapeCSV(entry.topic),
        escapeCSV(entry.focus),
        escapeCSV(entry.score),
        escapeCSV(entry.total),
        escapeCSV(pct),
        escapeCSV(status),
        escapeCSV(entryHyperfocusQuestions),
        escapeCSV(entryHyperfocusCorrect),
        escapeCSV(entryTransferQuestions),
        escapeCSV(entryTransferCorrect),
        escapeCSV(entryNeutralQuestions),
        escapeCSV(entryNeutralCorrect),
        escapeCSV(entryGeneralizationIndex + "x"),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `historico_quizzes_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
      : 0;

  const filteredHistory = (stats.history || []).filter((entry) =>
    activeTab === "archived" ? entry.isArchived : !entry.isArchived,
  );

  const chartData = [...(stats.history || [])].reverse().slice(0, 10).map(entry => ({
    name: new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: entry.score,
    total: entry.total,
    pct: Math.round((entry.score / entry.total) * 100)
  }));

  const subjectDataMap: Record<string, number> = {};
  (stats.history || []).forEach(entry => {
    subjectDataMap[entry.subject] = (subjectDataMap[entry.subject] || 0) + 1;
  });
  const subjectData = Object.keys(subjectDataMap).map(key => ({
    name: key,
    value: subjectDataMap[key]
  }));
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Generalization Metrics Calculation
  let hyperfocusQuestions = 0;
  let hyperfocusCorrect = 0;
  let transferQuestions = 0;
  let transferCorrect = 0;
  let neutralQuestions = 0;
  let neutralCorrect = 0;

  (stats.history || []).forEach((entry) => {
    if (entry.questions && entry.questions.length > 0) {
      entry.questions.forEach((q: any) => {
        const context = q.contextType || "hyperfocus";
        const response = entry.responses?.find((r: any) => r.questionId === q.id);
        const isCorrect = response && (response.answer === q.correctAnswer || (q.options && q.correctAnswerIndex !== undefined && response.answer === q.options[q.correctAnswerIndex]));

        if (context === "hyperfocus") {
          hyperfocusQuestions++;
          if (isCorrect) hyperfocusCorrect++;
        } else if (context === "transfer") {
          transferQuestions++;
          if (isCorrect) transferCorrect++;
        } else if (context === "neutral") {
          neutralQuestions++;
          if (isCorrect) neutralCorrect++;
        }
      });
    }
  });

  const hyperfocusPct = hyperfocusQuestions > 0 ? Math.round((hyperfocusCorrect / hyperfocusQuestions) * 100) : 0;
  const transferPct = transferQuestions > 0 ? Math.round((transferCorrect / transferQuestions) * 100) : 0;
  const neutralPct = neutralQuestions > 0 ? Math.round((neutralCorrect / neutralQuestions) * 100) : 0;

  const outOfHyperfocusQuestions = transferQuestions + neutralQuestions;
  const outOfHyperfocusCorrect = transferCorrect + neutralCorrect;
  const outOfHyperfocusPct = outOfHyperfocusQuestions > 0 ? Math.round((outOfHyperfocusCorrect / outOfHyperfocusQuestions) * 100) : 0;

  const diffPoints = hyperfocusPct - outOfHyperfocusPct;
  const generalizationIndex = hyperfocusCorrect > 0 
    ? ((neutralCorrect + transferCorrect) / hyperfocusCorrect).toFixed(2) 
    : "0.00";

  let automaticFeedback = "";
  let feedbackType: "success" | "warning" | "neutral" = "neutral";

  if (outOfHyperfocusQuestions === 0) {
    automaticFeedback = "Ainda não há dados suficientes de transferência ou território neutro para calcular a generalização. Continue aplicando novas missões.";
    feedbackType = "neutral";
  } else if (diffPoints <= 10) {
    automaticFeedback = `O aluno mantém ${outOfHyperfocusPct}% do desempenho fora do hiperfoco (Índice: ${generalizationIndex}x) — forte evidência de generalização e eficácia do AEE!`;
    feedbackType = "success";
  } else if (diffPoints <= 25) {
    automaticFeedback = `O aluno apresenta bom desempenho fora do hiperfoco (${outOfHyperfocusPct}%), mas com leve queda de ${diffPoints} pontos percentuais. Continue estimulando com pontes temáticas para facilitar a transferência de contexto.`;
    feedbackType = "warning";
  } else {
    automaticFeedback = `Queda de ${diffPoints} pontos de desempenho fora do hiperfoco (${outOfHyperfocusPct}% de acertos) — recomenda-se reforçar missões de transferência e reduzir gradualmente a saturação do tema de interesse.`;
    feedbackType = "warning";
  }

  if (dashboardView === "weekly") {
    return (
      <WeeklyReport
        stats={stats}
        onBack={() => setDashboardView("general")}
      />
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto p-6 space-y-8 print:hidden"
      >
        <div className="flex flex-col md:flex-row items-center gap-8 pb-8 border-b-2 border-indigo-50">
          <div className="relative">
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-32 h-32 bg-white rounded-[40px] p-4 shadow-xl border-4 border-indigo-50 flex items-center justify-center"
            >
              <img
                src={logoUrl}
                alt="Logo HiperReforço"
                className="w-full h-full object-contain"
              />
            </motion.div>
          </div>
          <div className="text-center md:text-left flex-1 space-y-1">
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">
              Seu Painel
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-center md:justify-start">
              <span className="text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full text-sm">
                Level {stats.level}
              </span>
              <span className="text-slate-400 font-medium text-sm">
                {stats.xp} XP acumulados • Conhecimento em Evolução 🚀
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setDashboardView("weekly")}
              className="px-6 py-3 bg-indigo-50 border-2 border-indigo-100 text-indigo-600 font-black rounded-2xl hover:bg-indigo-100 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
            >
              <BarChart3 size={20} />
              Relatório Semanal
            </button>
            <button
              onClick={() => generatePedagogicalReport(stats, stats.history)}
              className="px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-600 font-black rounded-2xl hover:bg-indigo-50 transition-all flex items-center gap-2 active:scale-95"
            >
              <FileText size={20} />
              Relatório PDF
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all active:scale-95"
            >
              Voltar
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-3xl text-center">
            <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-3">
              <BarChart3 size={24} />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {accuracy}%
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase">
              Precisão Geral
            </div>
          </div>
          <div className="glass-card p-6 rounded-3xl text-center">
            <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-2xl mb-3">
              <CheckCircle2 size={24} />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {stats.totalCorrect}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase">
              Acertos Totais
            </div>
          </div>
          <div className="glass-card p-6 rounded-3xl text-center">
            <div className="inline-flex p-3 bg-amber-50 text-amber-600 rounded-2xl mb-3">
              <Award size={24} />
            </div>
            <div className="text-2xl font-black text-slate-800">
              {stats.badges?.length || 0}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase">
              Medalhas
            </div>
          </div>
        </div>

        {/* Generalização do Aprendizado Card */}
        <div className="glass-card p-8 rounded-[32px] border border-indigo-100/50 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <span className="text-2xl">🧩</span> Generalização do Aprendizado
              </h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
                A métrica que traduz a eficácia do Atendimento Educacional Especializado (AEE)
              </p>
            </div>
            {outOfHyperfocusQuestions > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-2xl text-center md:text-right">
                <span className="block text-[10px] font-bold text-indigo-500 uppercase">Índice de Generalização</span>
                <span className="text-xl font-black text-indigo-600">{generalizationIndex}x</span>
              </div>
            )}
          </div>

          {outOfHyperfocusQuestions === 0 && hyperfocusQuestions === 0 ? (
            <p className="text-slate-400 text-sm italic text-center py-6">
              Aguardando a conclusão dos primeiros quizzes para exibir os índices de generalização.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Progresso por Contexto */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Aproveitamento por Contexto</h3>
                
                {/* Hyperfocus */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-indigo-600">🚀 Hiperfoco / Interesse</span>
                    <span className="text-slate-700">{hyperfocusPct}% <span className="text-[10px] text-slate-400">({hyperfocusCorrect}/{hyperfocusQuestions})</span></span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: `${hyperfocusPct}%` }}
                    />
                  </div>
                </div>

                {/* Transfer */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-600">🌉 Missão de Transferência</span>
                    <span className="text-slate-700">{transferPct}% <span className="text-[10px] text-slate-400">({transferCorrect}/{transferQuestions})</span></span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${transferPct}%` }}
                    />
                  </div>
                </div>

                {/* Neutral */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">🎯 Território Neutro</span>
                    <span className="text-slate-700">{neutralPct}% <span className="text-[10px] text-slate-400">({neutralCorrect}/{neutralQuestions})</span></span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-500 rounded-full" 
                      style={{ width: `${neutralPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Leitura e Feedback Automático */}
              <div className="h-full flex flex-col justify-center">
                <div className={`p-6 rounded-3xl border h-full flex flex-col justify-center space-y-3 ${
                  feedbackType === 'success' 
                    ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                    : feedbackType === 'warning'
                    ? 'bg-amber-50/50 border-amber-100 text-amber-800'
                    : 'bg-slate-50/50 border-slate-100 text-slate-800'
                }`}>
                  <h4 className="text-xs font-black uppercase tracking-widest">Leitura Psicopedagógica</h4>
                  <p className="text-sm font-medium leading-relaxed">
                    {automaticFeedback}
                  </p>
                  {outOfHyperfocusQuestions > 0 && (
                    <div className="text-[11px] font-bold opacity-75 pt-2 border-t border-current/10">
                      Cálculo: (Acertos em Território Neutro + Transferência) ÷ Acertos em Hiperfoco
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts Section */}
        {stats.history && stats.history.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-3xl">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-500" />
                Desempenho Recente (%)
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => [`${value}%`, 'Acertos']}
                    />
                    <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="glass-card p-6 rounded-3xl">
              <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-500" />
                Quizzes por Matéria
              </h2>
              <div className="h-64 flex flex-col">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={subjectData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {subjectData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-2 shrink-0">
                  {subjectData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Report Call-to-Action Card */}
        <div className="glass-card bg-indigo-50/40 border border-indigo-100/70 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-indigo-950 flex items-center gap-2">
                Relatório de Evolução Semanal Disponível!
              </h3>
              <p className="text-slate-500 text-sm mt-0.5 max-w-xl leading-relaxed">
                Acompanhe o aprendizado detalhado ao longo do tempo, analise a performance por matéria e veja os pilares de generalização pedagógica de forma interativa.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDashboardView("weekly")}
            className="w-full md:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer shrink-0 active:scale-95"
          >
            Visualizar Tendências
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Daily Reminder Configuration Section */}
        <div className="glass-card bg-indigo-50/20 border border-indigo-100/50 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                <Bell size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                  Lembretes Diários de Estudo
                  {reminderEnabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-black border border-emerald-100">
                      ATIVO
                    </span>
                  )}
                </h3>
                <p className="text-slate-500 text-sm mt-0.5">
                  Configure notificações locais para incentivar a constância nos estudos e manter o engajamento com os hiperfocos de {childName}.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 self-start md:self-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-sm font-bold text-slate-600">
                  {reminderEnabled ? "Ativado" : "Desativado"}
                </span>
              </label>
            </div>
          </div>

          {reminderEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-indigo-500" />
                    Horário do Lembrete
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={14} className="text-indigo-500" />
                    Mensagem Personalizada
                  </label>
                  <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="Ex: Hora de treinar seu hiperfoco no HiperReforço! 🚀"
                    rows={2}
                    className="w-full bg-white border border-slate-200 text-slate-700 font-medium rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm resize-none"
                  />
                  <p className="text-[10px] text-slate-400 font-medium">
                    Use <code className="font-bold bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{"{nome}"}</code> para incluir automaticamente o nome do aluno na mensagem.
                  </p>
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-100/30 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Settings size={14} />
                    Status das Notificações
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-medium">Permissão do Navegador:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
                        notificationPermission === "granted"
                          ? "bg-emerald-50 text-emerald-600"
                          : notificationPermission === "denied"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {notificationPermission === "granted" ? "Concedida" : notificationPermission === "denied" ? "Bloqueada" : "Pendente"}
                      </span>
                    </div>
                    {notificationPermission !== "granted" && (
                      <p className="text-xs text-slate-400">
                        Para receber lembretes diretamente na sua área de trabalho, você precisa autorizar as notificações locais no navegador.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {notificationPermission !== "granted" && (
                    <button
                      onClick={handleRequestPermission}
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95"
                    >
                      Autorizar Notificações
                    </button>
                  )}
                  <button
                    onClick={handleTestNotification}
                    className="flex-1 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Play size={12} />
                    Testar Lembrete
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveReminder}
              disabled={isSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Badges Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Award size={20} className="text-amber-500" />
              <h2 className="font-bold text-slate-800">
                Medalhas Conquistadas
              </h2>
            </div>
            <div className="glass-card p-6 rounded-3xl grid grid-cols-3 gap-4">
              {stats.badges && stats.badges.length > 0 ? (
                stats.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center text-center space-y-2"
                  >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-inner overflow-hidden">
                      <img 
                        src={getBadgeImage(badge)} 
                        alt={badge.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 leading-tight">
                      {badge.name}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-8 text-center text-slate-400 text-sm italic">
                  Nenhuma medalha ainda. Continue estudando!
                </div>
              )}
            </div>
          </div>

          {/* History Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <History size={20} className="text-primary" />
                <h2 className="font-bold text-slate-800">
                  Histórico de Quizzes
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportHistoryToCSV}
                  className="px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50 shadow-sm flex items-center gap-1"
                  title="Copiar histórico para CSV"
                >
                  <Download size={14} /> CSV
                </button>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab("recent")}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === "recent" ? "bg-white text-primary shadow-sm" : "text-slate-400"}`}
                  >
                    Recentes
                  </button>
                  <button
                    onClick={() => setActiveTab("archived")}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === "archived" ? "bg-white text-primary shadow-sm" : "text-slate-400"}`}
                  >
                    Arquivados
                  </button>
                </div>
              </div>
            </div>
            <div className="glass-card p-4 rounded-3xl space-y-3">
              {filteredHistory.length > 0 ? (
                filteredHistory.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {entry.subject}: {entry.topic}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(entry.date).toLocaleDateString("pt-BR")} •{" "}
                          {entry.grade}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="text-right">
                        <div className="text-sm font-black text-primary">
                          {entry.score}/{entry.total}
                        </div>
                        {entry.skippedQuestions &&
                          entry.skippedQuestions.length > 0 && (
                            <div className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full mt-0.5">
                              {entry.skippedQuestions.length} pulada(s)
                            </div>
                          )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleGenerateQuizPdf(entry)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors shrink-0"
                          title="Gerar PDF do Quiz"
                          disabled={
                            isGeneratingPdf &&
                            selectedQuizForPdf?.id === entry.id
                          }
                        >
                          <Printer
                            size={14}
                            className={
                              isGeneratingPdf &&
                              selectedQuizForPdf?.id === entry.id
                                ? "animate-pulse"
                                : ""
                            }
                          />
                          <span className="hidden sm:inline">
                            {isGeneratingPdf &&
                            selectedQuizForPdf?.id === entry.id
                              ? "Gerando..."
                              : "Imprimir Quiz"}
                          </span>
                        </button>
                        <button
                          onClick={() => exportEntryToTxt(entry)}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Baixar Relatório (TXT)"
                        >
                          <FileText size={16} />
                        </button>
                        {onArchiveHistoryEntry && (
                          <button
                            onClick={() =>
                              onArchiveHistoryEntry(
                                entry.id,
                                activeTab === "recent",
                              )
                            }
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title={
                              activeTab === "recent" ? "Arquivar" : "Restaurar"
                            }
                          >
                            <Download
                              size={16}
                              className={
                                activeTab === "recent" ? "rotate-180" : ""
                              }
                            />
                          </button>
                        )}
                        {onDeleteHistoryEntry && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Deseja realmente apagar este histórico permanentemente?",
                                )
                              ) {
                                onDeleteHistoryEntry(entry.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Apagar Histórico"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-sm italic">
                  {activeTab === "recent"
                    ? "Nenhum quiz recente."
                    : "Nenhum quiz arquivado."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Materials Archive Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-2">
            <FolderOpen size={20} className="text-cyan-500" />
            <h2 className="font-bold text-slate-800">
              Meus Arquivos & Materiais
            </h2>
          </div>
          <div className="glass-card p-4 rounded-3xl space-y-3">
            {stats.materials && stats.materials.length > 0 ? (
              stats.materials.map((material) => (
                <div
                  key={material.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-2xl border border-cyan-100 shadow-sm gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 bg-cyan-50 text-cyan-500 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {material.fileName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(material.uploadedAt).toLocaleString("pt-BR")}{" "}
                        • {(material.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                  <a
                    href={material.downloadURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-cyan-200"
                  >
                    <Download size={16} />
                    Baixar Arquivo
                  </a>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <FolderOpen size={24} />
                </div>
                <p className="text-sm font-medium text-slate-600">
                  Seu arquivo está vazio
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Materiais que você enviar no Assistente aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Specialist Area Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-2">
            <UserCheck size={20} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800">Área do Especialista</h2>
          </div>
          <div className="glass-card p-6 rounded-3xl space-y-6">
            <div className="flex items-start gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="p-2 bg-white rounded-xl text-indigo-500">
                <MessageSquare size={20} />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-indigo-900">
                  Orientações Pedagógicas
                </div>
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Esta área é reservada para comentários de psicopedagogos e
                  especialistas que acompanham o aluno. As orientações ajudam a
                  ajustar o hiperfoco e as matérias para um melhor
                  aproveitamento.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {stats.comments && stats.comments.length > 0 ? (
                stats.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {comment.specialistName} •{" "}
                        {comment.category === "pedagogical"
                          ? "Psicopedagogo"
                          : "Especialista"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(comment.date).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700">
                      "{comment.content}"
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-white rounded-2xl border border-slate-100 text-center text-sm text-slate-400 italic">
                  Nenhuma orientação recebida ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hidden PDF template container */}
      {selectedQuizForPdf && (
        <QuizReportTemplate ref={reportRef} entry={selectedQuizForPdf} />
      )}
    </>
  );
}

const QuizReportTemplate = React.forwardRef<
  HTMLDivElement,
  { entry: QuizHistoryEntry }
>(({ entry }, ref) => {
  const accuracy = Math.round((entry.score / entry.total) * 100);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: "-9999px",
        top: "0",
        width: "800px",
        backgroundColor: "#ffffff",
        color: "#1e293b",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "40px",
        boxSizing: "border-box",
      }}
      className="quiz-report-pdf-template"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: "20px",
          marginBottom: "30px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "800",
              color: "#1e1b4b",
              margin: "0 0 5px 0",
            }}
          >
            Relatório de Desempenho do Quiz
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            HiperReforço • Aprendizado focado no Hiperfoco
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#4f46e5",
              backgroundColor: "#e0e7ff",
              padding: "6px 12px",
              borderRadius: "20px",
            }}
          >
            {new Date(entry.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Info Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginBottom: "30px",
          backgroundColor: "#f8fafc",
          padding: "20px",
          borderRadius: "16px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Estudo
          </div>
          <div
            style={{ fontSize: "15px", fontWeight: "bold", color: "#334155" }}
          >
            {entry.subject}
          </div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            {entry.topic}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Hiperfoco Ativo
          </div>
          <div
            style={{ fontSize: "15px", fontWeight: "bold", color: "#4f46e5" }}
          >
            {entry.focus}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Desempenho
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "900",
              color: entry.score >= entry.total * 0.7 ? "#059669" : "#dc2626",
            }}
          >
            {entry.score} de {entry.total} acertos
          </div>
          <div
            style={{ fontSize: "12px", fontWeight: "bold", color: "#64748b" }}
          >
            {accuracy}% de aproveitamento
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <h2
        style={{
          fontSize: "18px",
          fontWeight: "bold",
          color: "#1e293b",
          marginBottom: "20px",
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: "10px",
        }}
      >
        Detalhamento das Questões
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {entry.questions && entry.questions.length > 0 ? (
          entry.questions.map((q: any, idx: number) => {
            const response = entry.responses?.find(
              (r: any) => r.questionId === q.id,
            );
            const isCorrect = response && (response.answer === q.correctAnswer || (q.options && q.correctAnswerIndex !== undefined && response.answer === q.options[q.correctAnswerIndex]));

            return (
              <div
                key={q.id || idx}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "20px",
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#4f46e5",
                        backgroundColor: "#f5f3ff",
                        padding: "4px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      Questão {idx + 1}
                    </span>
                    
                    {/* Selo de contexto */}
                    {(!q.contextType || q.contextType === 'hyperfocus') && (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          color: "#4f46e5",
                          backgroundColor: "#f5f3ff",
                          border: "1px solid #e0e7ff",
                        }}
                      >
                        🚀 Hiperfoco
                      </span>
                    )}
                    {q.contextType === 'transfer' && (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          color: "#047857",
                          backgroundColor: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        🌉 Missão de Transferência
                      </span>
                    )}
                    {q.contextType === 'neutral' && (
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "bold",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          color: "#475569",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #cbd5e1",
                        }}
                      >
                        🎯 Território Neutro
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      color: isCorrect
                        ? "#065f46"
                        : response?.isSkipped
                          ? "#92400e"
                          : "#991b1b",
                      backgroundColor: isCorrect
                        ? "#d1fae5"
                        : response?.isSkipped
                          ? "#fef3c7"
                          : "#fee2e2",
                    }}
                  >
                    {isCorrect
                      ? "Correta"
                      : response?.isSkipped
                        ? "Pulada"
                        : "Incorreta"}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#1e293b",
                    marginBottom: "16px",
                    marginTop: 0,
                  }}
                >
                  {q.text}
                </p>

                {/* Options */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  {q.options?.map((opt: string) => {
                    const isCorrectOpt = opt === q.correctAnswer;
                    const isChosenOpt = response && opt === response.answer;
                    let optionBg = "#ffffff";
                    let optionBorder = "1px solid #cbd5e1";
                    let optionBadge = null;

                    if (isCorrectOpt) {
                      optionBg = "#f0fdf4";
                      optionBorder = "2px solid #22c55e";
                      optionBadge = (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#15803d",
                            backgroundColor: "#d1fae5",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            marginLeft: "auto",
                          }}
                        >
                          Resposta Correta
                        </span>
                      );
                    } else if (isChosenOpt) {
                      optionBg = "#fef2f2";
                      optionBorder = "2px solid #ef4444";
                      optionBadge = (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#b91c1c",
                            backgroundColor: "#fee2e2",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            marginLeft: "auto",
                          }}
                        >
                          Sua Escolha
                        </span>
                      );
                    }

                    return (
                      <div
                        key={opt}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          backgroundColor: optionBg,
                          border: optionBorder,
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight:
                              isCorrectOpt || isChosenOpt ? "bold" : "normal",
                            color: isCorrectOpt
                              ? "#15803d"
                              : isChosenOpt
                                ? "#b91c1c"
                                : "#475569",
                          }}
                        >
                          {opt}
                        </span>
                        {optionBadge}
                      </div>
                    );
                  })}
                </div>

                {/* Student choice row if skipped */}
                {response?.isSkipped && (
                  <div
                    style={{
                      backgroundColor: "#fef3c7",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      marginBottom: "12px",
                      border: "1px dashed #d97706",
                      fontSize: "13px",
                      color: "#92400e",
                    }}
                  >
                    <strong>Status:</strong> Você escolheu pular esta questão.
                  </div>
                )}

                {/* Pedagogical Explanation */}
                {q.explanation && (
                  <div
                    style={{
                      backgroundColor: "#eff6ff",
                      borderLeft: "4px solid #3b82f6",
                      padding: "12px 16px",
                      borderRadius: "0 8px 8px 0",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 4px 0",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: "#1e40af",
                        textTransform: "uppercase",
                      }}
                    >
                      Explicação Pedagógica:
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#1e3a8a",
                        lineHeight: "1.5",
                      }}
                    >
                      {q.explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Fallback for old history entries without full question payloads
          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {entry.wrongQuestions && entry.wrongQuestions.length > 0 && (
              <div>
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: "bold",
                    color: "#dc2626",
                    marginBottom: "12px",
                  }}
                >
                  Questões com Oportunidade de Melhoria:
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {entry.wrongQuestions.map((wq: any, wIdx: number) => (
                    <div
                      key={wIdx}
                      style={{
                        border: "1px solid #fee2e2",
                        backgroundColor: "#fff5f5",
                        borderRadius: "8px",
                        padding: "16px",
                      }}
                    >
                      <p
                        style={{
                          fontWeight: "bold",
                          color: "#991b1b",
                          fontSize: "14px",
                          margin: "0 0 8px 0",
                        }}
                      >
                        {wIdx + 1}. {wq.text}
                      </p>
                      <div
                        style={{
                          backgroundColor: "#ffffff",
                          padding: "12px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#7f1d1d",
                          border: "1px solid #fecaca",
                        }}
                      >
                        <strong>Orientação/Correção:</strong> {wq.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entry.skippedQuestions && entry.skippedQuestions.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: "bold",
                    color: "#d97706",
                    marginBottom: "12px",
                  }}
                >
                  Questões Puladas:
                </h3>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {entry.skippedQuestions.map((sq: any, sIdx: number) => (
                    <li
                      key={sIdx}
                      style={{ fontSize: "13px", color: "#92400e" }}
                    >
                      {sq.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "40px",
          paddingTop: "20px",
          borderTop: "1px solid #e2e8f0",
          textAlign: "center",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        Relatório gerado automaticamente pela plataforma HiperReforço.
        <br />
        Para fins pedagógicos e acompanhamento especializado do aluno.
      </div>
    </div>
  );
});
QuizReportTemplate.displayName = "QuizReportTemplate";
