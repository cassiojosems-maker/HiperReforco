import React from "react";
import { motion } from "motion/react";
import { QuizHistoryEntry, UserStats, Question } from "../types";
import { generateWeeklyPdfReport } from "../services/reportService";
import {
  TrendingUp,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  Target,
  Compass,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Printer,
  ChevronRight,
  Sparkles,
  Info,
  Download,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface WeeklyReportProps {
  stats: UserStats;
  onBack: () => void;
}

interface WeeklyData {
  weekLabel: string;
  startDate: Date;
  accuracy: number;
  quizzesCount: number;
  totalCorrect: number;
  totalQuestions: number;
  hyperfocusAccuracy: number;
  transferAccuracy: number;
  neutralAccuracy: number;
}

export default function WeeklyReport({ stats, onBack }: WeeklyReportProps) {
  const [timeRange, setTimeRange] = React.useState<"4" | "8" | "12">("8");
  const [selectedSubject, setSelectedSubject] = React.useState<string>("all");
  const [dateInterval, setDateInterval] = React.useState<"7" | "15" | "30" | "all">("all");

  // Filter history based on selected date interval
  const filteredHistory = React.useMemo(() => {
    if (!stats.history || stats.history.length === 0) return [];
    if (dateInterval === "all") return stats.history;

    const limitDays = parseInt(dateInterval);
    
    // Anchor on the latest date in history or current time to support offline/historical mock data
    let referenceDate = new Date();
    stats.history.forEach((entry) => {
      const d = new Date(entry.date);
      if (d > referenceDate) {
        referenceDate = d;
      }
    });

    const cutOff = new Date(referenceDate);
    cutOff.setDate(cutOff.getDate() - limitDays);
    cutOff.setHours(0, 0, 0, 0);

    return stats.history.filter((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= cutOff;
    });
  }, [stats.history, dateInterval]);

  // Helper to get start of week (Monday)
  const getStartOfWeek = (dateStr: string): Date => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  // Helper to format Date as "DD/MM"
  const formatDateLabel = (date: Date): string => {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // 1. Process Weekly Data
  const weeklyData = React.useMemo(() => {
    if (!filteredHistory || filteredHistory.length === 0) return [];

    // Group history entries by week start date
    const groups: Record<string, QuizHistoryEntry[]> = {};
    filteredHistory.forEach((entry) => {
      // Filter by subject if needed
      if (selectedSubject !== "all" && entry.subject !== selectedSubject) {
        return;
      }
      const startOfWeek = getStartOfWeek(entry.date);
      const key = startOfWeek.toISOString();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });

    // Generate weeks array
    const sortedWeekKeys = Object.keys(groups).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    const data: WeeklyData[] = sortedWeekKeys.map((key) => {
      const entries = groups[key];
      const start = new Date(key);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const weekLabel = `Semana de ${formatDateLabel(start)}`;

      let totalCorrect = 0;
      let totalQuestions = 0;
      let hCorrect = 0;
      let hQuestions = 0;
      let tCorrect = 0;
      let tQuestions = 0;
      let nCorrect = 0;
      let nQuestions = 0;

      entries.forEach((entry) => {
        totalCorrect += entry.score;
        totalQuestions += entry.total;

        // Process individual question context types
        if (entry.questions && entry.questions.length > 0) {
          entry.questions.forEach((q) => {
            const context = q.contextType || "hyperfocus";
            const response = entry.responses?.find((r) => r.questionId === q.id);
            const isCorrect =
              response &&
              (response.answer === (q as any).correctAnswer ||
                (q.options &&
                  q.correctAnswerIndex !== undefined &&
                  response.answer === q.options[q.correctAnswerIndex]));

            if (context === "hyperfocus") {
              hQuestions++;
              if (isCorrect) hCorrect++;
            } else if (context === "transfer") {
              tQuestions++;
              if (isCorrect) tCorrect++;
            } else if (context === "neutral") {
              nQuestions++;
              if (isCorrect) nCorrect++;
            }
          });
        }
      });

      return {
        weekLabel,
        startDate: start,
        accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        quizzesCount: entries.length,
        totalCorrect,
        totalQuestions,
        hyperfocusAccuracy: hQuestions > 0 ? Math.round((hCorrect / hQuestions) * 100) : 0,
        transferAccuracy: tQuestions > 0 ? Math.round((tCorrect / tQuestions) * 100) : 0,
        neutralAccuracy: nQuestions > 0 ? Math.round((nCorrect / nQuestions) * 100) : 0,
      };
    });

    // Limit to the selected range of weeks (last 4, 8, or 12 weeks)
    const limitWeeks = parseInt(timeRange);
    return data.slice(-limitWeeks);
  }, [filteredHistory, selectedSubject, timeRange]);

  // 2. Extract Unique Subjects for filter
  const uniqueSubjects = React.useMemo(() => {
    if (!stats.history) return [];
    const subjects = new Set<string>();
    stats.history.forEach((entry) => subjects.add(entry.subject));
    return Array.from(subjects);
  }, [stats.history]);

  // 3. Process Focus Areas (Hyperfocus Themes) and Subjects Performance
  const focusAreasData = React.useMemo(() => {
    if (!filteredHistory) return { subjects: [], focus: [] };

    const subjectsMap: Record<string, { correct: number; total: number; count: number }> = {};
    const focusMap: Record<string, { correct: number; total: number; count: number }> = {};

    filteredHistory.forEach((entry) => {
      // Subjects
      if (!subjectsMap[entry.subject]) {
        subjectsMap[entry.subject] = { correct: 0, total: 0, count: 0 };
      }
      subjectsMap[entry.subject].correct += entry.score;
      subjectsMap[entry.subject].total += entry.total;
      subjectsMap[entry.subject].count += 1;

      // Focus themes (hiperfocos)
      if (entry.focus) {
        if (!focusMap[entry.focus]) {
          focusMap[entry.focus] = { correct: 0, total: 0, count: 0 };
        }
        focusMap[entry.focus].correct += entry.score;
        focusMap[entry.focus].total += entry.total;
        focusMap[entry.focus].count += 1;
      }
    });

    const subjectsList = Object.keys(subjectsMap).map((name) => {
      const { correct, total, count } = subjectsMap[name];
      return {
        name,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        count,
        type: "Matéria" as const,
      };
    }).sort((a, b) => b.accuracy - a.accuracy);

    const focusList = Object.keys(focusMap).map((name) => {
      const { correct, total, count } = focusMap[name];
      return {
        name,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        count,
        type: "Hiperfoco" as const,
      };
    }).sort((a, b) => b.accuracy - a.accuracy);

    return { subjects: subjectsList, focus: focusList };
  }, [filteredHistory]);

  // 4. Overall Progress metrics over the selected period
  const trendMetrics = React.useMemo(() => {
    if (weeklyData.length < 2) return { diff: 0, direction: "stable" as const };
    const firstWeek = weeklyData[0].accuracy;
    const lastWeek = weeklyData[weeklyData.length - 1].accuracy;
    const diff = lastWeek - firstWeek;
    return {
      diff,
      direction: diff > 0 ? ("up" as const) : diff < 0 ? ("down" as const) : ("stable" as const),
    };
  }, [weeklyData]);

  // 5. Context Performance aggregation (Radar or Bar)
  const contextData = React.useMemo(() => {
    let hCorrect = 0, hTotal = 0;
    let tCorrect = 0, tTotal = 0;
    let nCorrect = 0, nTotal = 0;

    filteredHistory.forEach((entry) => {
      if (entry.questions && entry.questions.length > 0) {
        entry.questions.forEach((q) => {
          const context = q.contextType || "hyperfocus";
          const response = entry.responses?.find((r) => r.questionId === q.id);
          const isCorrect =
            response &&
            (response.answer === (q as any).correctAnswer ||
              (q.options &&
                q.correctAnswerIndex !== undefined &&
                response.answer === q.options[q.correctAnswerIndex]));

          if (context === "hyperfocus") {
            hTotal++;
            if (isCorrect) hCorrect++;
          } else if (context === "transfer") {
            tTotal++;
            if (isCorrect) tCorrect++;
          } else if (context === "neutral") {
            nTotal++;
            if (isCorrect) nCorrect++;
          }
        });
      }
    });

    return [
      {
        subject: "🚀 Hiperfoco",
        A: hTotal > 0 ? Math.round((hCorrect / hTotal) * 100) : 0,
        fullMark: 100,
        total: hTotal,
      },
      {
        subject: "🌉 Transferência",
        A: tTotal > 0 ? Math.round((tCorrect / tTotal) * 100) : 0,
        fullMark: 100,
        total: tTotal,
      },
      {
        subject: "🎯 Território Neutro",
        A: nTotal > 0 ? Math.round((nCorrect / nTotal) * 100) : 0,
        fullMark: 100,
        total: nTotal,
      },
    ];
  }, [filteredHistory]);

  // Handle page printing
  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8"
    >
      {/* Printable CSS Helper */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            background: white !important;
            page-break-inside: avoid;
          }
          .print-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-indigo-50 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm hover:scale-105 active:scale-95"
            title="Voltar ao Painel Geral"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <TrendingUp className="text-indigo-600" /> Relatório Semanal
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Evolução pedagógica detalhada do aluno através dos hiperfocos
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => generateWeeklyPdfReport(stats, weeklyData, focusAreasData, contextData, timeRange, selectedSubject)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-md active:scale-95 cursor-pointer"
            title="Exportar dados como PDF estruturado para pais e especialistas"
          >
            <Download size={16} /> Baixar PDF
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-white border-2 border-indigo-100 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm shadow-sm active:scale-95"
          >
            <Printer size={16} /> Imprimir Relatório
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm shadow-sm active:scale-95"
          >
            Voltar
          </button>
        </div>
      </div>

      {/* Print-only Header (Hidden in UI) */}
      <div className="hidden print:block text-center border-b pb-6 mb-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          HiperReforço • Relatório de Evolução Semanal
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Acompanhamento Clínico-Pedagógico de Inclusão por Hiperfoco
        </p>
        <div className="grid grid-cols-3 gap-4 mt-4 text-left text-xs text-slate-600 max-w-2xl mx-auto bg-slate-50 p-3 rounded-lg border">
          <div><strong>Aluno:</strong> {stats.uid ? `ID: ${stats.uid.slice(0, 8)}` : "Estudante"}</div>
          <div><strong>Série/Ano:</strong> {stats.history[0]?.grade || "AEE / Inclusão"}</div>
          <div><strong>Data de Emissão:</strong> {new Date().toLocaleDateString("pt-BR")}</div>
        </div>
      </div>

      {/* Filter and Overview Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filtrar Matéria</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todas as Matérias</option>
              {uniqueSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Intervalo de Datas</span>
            <select
              value={dateInterval}
              onChange={(e) => setDateInterval(e.target.value as any)}
              className="bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todo o Período</option>
              <option value="7">Última semana</option>
              <option value="15">Últimos 15 dias</option>
              <option value="30">Último mês</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Período de Análise</span>
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
              <button
                onClick={() => setTimeRange("4")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeRange === "4" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                4 Semanas
              </button>
              <button
                onClick={() => setTimeRange("8")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeRange === "8" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                8 Semanas
              </button>
              <button
                onClick={() => setTimeRange("12")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeRange === "12" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                12 Semanas
              </button>
            </div>
          </div>
        </div>

        {/* Quick trend pill */}
        {weeklyData.length > 0 && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl shrink-0 self-center">
            <TrendingUp size={16} className={trendMetrics.diff > 0 ? "text-emerald-500" : trendMetrics.diff < 0 ? "text-rose-500" : "text-slate-400"} />
            <div className="text-xs font-bold text-slate-600">
              Tendência:{" "}
              <span
                className={
                  trendMetrics.diff > 0 ? "text-emerald-600" : trendMetrics.diff < 0 ? "text-rose-600" : "text-slate-600"
                }
              >
                {trendMetrics.diff > 0 ? `+${trendMetrics.diff}%` : `${trendMetrics.diff}%`} no período
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Content */}
      {weeklyData.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <Calendar size={48} className="mx-auto text-slate-300 mb-4 animate-pulse" />
          <h3 className="text-lg font-black text-slate-700">Ainda sem dados semanais</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
            Precisamos de quizzes concluídos para estruturar o relatório semanal. Realize missões para construir o histórico!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Top Level Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print-grid">
            <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 p-5 rounded-2xl shadow-sm flex items-center gap-4 print-card">
              <div className="p-3 bg-indigo-500 text-white rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aproveitamento Última Semana</span>
                <span className="text-2xl font-black text-slate-800">
                  {weeklyData[weeklyData.length - 1]?.accuracy}%
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-5 rounded-2xl shadow-sm flex items-center gap-4 print-card">
              <div className="p-3 bg-emerald-500 text-white rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acertos Totais (Filtro)</span>
                <span className="text-2xl font-black text-slate-800">
                  {weeklyData.reduce((acc, curr) => acc + curr.totalCorrect, 0)}
                  <span className="text-xs text-slate-400 font-bold ml-1">
                    / {weeklyData.reduce((acc, curr) => acc + curr.totalQuestions, 0)} q
                  </span>
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-100 p-5 rounded-2xl shadow-sm flex items-center gap-4 print-card">
              <div className="p-3 bg-violet-500 text-white rounded-xl">
                <BarChart3 size={24} />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Missões Concluídas</span>
                <span className="text-2xl font-black text-slate-800">
                  {weeklyData.reduce((acc, curr) => acc + curr.quizzesCount, 0)}
                  <span className="text-xs text-slate-400 font-bold ml-1">quizzes</span>
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 p-5 rounded-2xl shadow-sm flex items-center gap-4 print-card">
              <div className="p-3 bg-amber-500 text-white rounded-xl">
                <Zap size={24} />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tema Mais Utilizado</span>
                <span className="text-sm font-black text-slate-800 truncate block max-w-[150px] mt-0.5">
                  {focusAreasData.focus && focusAreasData.focus[0]?.name || "Nenhum"}
                </span>
              </div>
            </div>
          </div>

          {/* First Row of Charts: Trend over Time */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-grid">
            
            {/* Weekly Progress Trend Chart */}
            <div className="glass-card p-5 rounded-3xl lg:col-span-2 flex flex-col justify-between print-card">
              <div>
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                  <span className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg"><TrendingUp size={16} /></span>
                  Evolução do Aproveitamento Pedagógico
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Mapeamento da porcentagem média de acertos e do número de quizzes finalizados por semana.
                </p>
              </div>

              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="weekLabel" fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} label={{ value: "Aproveitamento (%)", angle: -90, position: "insideLeft", fontSize: 10, fill: "#94a3b8" }} stroke="#94a3b8" />
                    <YAxis yAxisId="right" orientation="right" fontSize={10} tickLine={false} axisLine={false} label={{ value: "Nº Quizzes", angle: 90, position: "insideRight", fontSize: 10, fill: "#94a3b8" }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      formatter={(value, name) => {
                        if (name === "accuracy") return [`${value}%`, "Aproveitamento"];
                        if (name === "quizzesCount") return [value, "Quizzes Feitos"];
                        return [value, name];
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Area yAxisId="left" type="monotone" dataKey="accuracy" name="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorAccuracy)" />
                    <Bar yAxisId="right" dataKey="quizzesCount" name="quizzesCount" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Generalization radar or focused context chart */}
            <div className="glass-card p-5 rounded-3xl flex flex-col justify-between print-card">
              <div>
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                  <span className="p-1.5 bg-violet-50 text-violet-500 rounded-lg"><Compass size={16} /></span>
                  Pillars de Aprendizagem (AEE)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Taxa de acertos por tipo de missão para analisar se o conhecimento está generalizado.
                </p>
              </div>

              {contextData.some(d => d.total > 0) ? (
                <div className="h-60 flex items-center justify-center mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={contextData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" fontSize={11} tick={{ fill: "#475569", fontWeight: "bold" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={8} tick={{ fill: "#94a3b8" }} />
                      <Radar name="Aproveitamento" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                      <Tooltip
                        contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                        formatter={(value) => [`${value}%`, "Aproveitamento"]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 italic text-xs">
                  Sem dados detalhados de questões. Continue respondendo perguntas no app.
                </div>
              )}

              <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-500 font-medium leading-relaxed border mt-2">
                🌟 <strong>Hiperfoco:</strong> Conhecimento no tema de interesse. <br />
                🌉 <strong>Transferência:</strong> Ponte temática aproximada. <br />
                🎯 <strong>Neutro:</strong> Contexto curricular genérico.
              </div>
            </div>
          </div>

          {/* Second Row of Content: Focus Areas by Subject & Hiperfoco */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid">
            
            {/* Performance by Subject */}
            <div className="glass-card p-5 rounded-3xl flex flex-col justify-between print-card">
              <div>
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                  <span className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg"><BookOpen size={16} /></span>
                  Desempenho por Matéria
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Taxa de acertos em cada matéria curricular mapeada nos quizzes.
                </p>
              </div>

              {focusAreasData.subjects && focusAreasData.subjects.length > 0 ? (
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={focusAreasData.subjects} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                      <YAxis dataKey="name" type="category" width={100} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontWeight: "bold" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                        formatter={(value) => [`${value}%`, "Aproveitamento"]}
                      />
                      <Bar dataKey="accuracy" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400 italic text-sm">
                  Sem dados de matérias disponíveis.
                </div>
              )}
            </div>

            {/* Performance by Focus Area */}
            <div className="glass-card p-5 rounded-3xl flex flex-col justify-between print-card">
              <div>
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                  <span className="p-1.5 bg-amber-50 text-amber-500 rounded-lg"><Brain size={16} /></span>
                  Foco em Temas de Interesse (Hiperfocos)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Compara o aproveitamento do aluno quando exposto a diferentes hiperfocos ativos.
                </p>
              </div>

              {focusAreasData.focus && focusAreasData.focus.length > 0 ? (
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={focusAreasData.focus} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} stroke="#94a3b8" />
                      <YAxis dataKey="name" type="category" width={100} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#475569", fontWeight: "bold" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                        formatter={(value) => [`${value}%`, "Aproveitamento"]}
                      />
                      <Bar dataKey="accuracy" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-400 italic text-sm">
                  Nenhum tema de hiperfoco cadastrado no histórico ainda.
                </div>
              )}
            </div>
          </div>

          {/* Third Row: Psychopedagogical Insights & Alerts (Pedagogical Safeguards) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-grid">
            
            {/* Pedagogical Insights Card (Takes 2 cols) */}
            <div className="glass-card p-6 rounded-3xl md:col-span-2 space-y-4 border border-indigo-50 shadow-sm print-card">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base border-b border-slate-100 pb-3">
                <Sparkles size={18} className="text-indigo-600" />
                Leitura Clínica & Recomendações
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs uppercase tracking-wide">
                    <CheckCircle2 size={14} /> Fortalezas e Sucessos
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                    {focusAreasData.subjects.slice(0, 2).map((sub) => (
                      <li key={sub.name} className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Alto engajamento e aproveitamento de <strong>{sub.accuracy}%</strong> em <strong>{sub.name}</strong>.
                      </li>
                    ))}
                    {focusAreasData.focus.slice(0, 1).map((f) => (
                      <li key={f.name} className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        O tema de interesse <strong>{f.name}</strong> serve como excelente âncora motivacional.
                      </li>
                    ))}
                    {focusAreasData.subjects.length === 0 && (
                      <li className="italic text-slate-400">Calculando fortalezas a partir dos quizzes...</li>
                    )}
                  </ul>
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs uppercase tracking-wide">
                    <AlertTriangle size={14} /> Oportunidades de Suporte
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                    {focusAreasData.subjects.length > 2 ? (
                      focusAreasData.subjects.slice(-2).map((sub) => (
                        <li key={sub.name} className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <strong>{sub.name}</strong> (Aproveitamento: {sub.accuracy}%) pode se beneficiar de maior ancoragem no hiperfoco.
                        </li>
                      ))
                    ) : (
                      <li className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Recomenda-se continuar expandindo temas para criar novas conexões.
                      </li>
                    )}
                    <li className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Manter a proporção de 10 min de novos temas para cada 30 min de hiperfoco para reduzir resistências.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border rounded-2xl text-xs text-slate-600 leading-relaxed font-medium">
                <strong>Orientações para o AEE (Atendimento Educacional Especializado):</strong> <br />
                O aluno apresenta padrão de engajamento que responde muito bem a representações visuais e lúdicas atreladas ao hiperfoco.
                Para potencializar a generalização (contexto neutro), sugerimos realizar as <strong>Missões de Transferência</strong> sugeridas no Assistente, permitindo que a transição ocorra de forma segura, respeitosa e progressiva.
              </div>
            </div>

            {/* Pedagogical Alerts Card (1 col) */}
            <div className="glass-card p-6 rounded-3xl border border-rose-50 shadow-sm flex flex-col justify-between print-card">
              <div className="space-y-3">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base border-b border-slate-100 pb-3">
                  <AlertTriangle size={18} className="text-amber-500" />
                  Salvaguardas de Inclusão
                </h3>
                <p className="text-xs text-slate-400">
                  Alertas em tempo real sobre saturação temática, dependência de contexto e isolamento cognitivo.
                </p>

                {/* Interactive Dynamic Safeguard Trigger */}
                <div className="space-y-2.5">
                  {/* Alert 1 */}
                  {weeklyData.length > 1 &&
                    weeklyData[weeklyData.length - 1].hyperfocusAccuracy - weeklyData[weeklyData.length - 1].neutralAccuracy > 25 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] leading-tight flex gap-2">
                        <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                        <div>
                          <strong>Alerta AP-1 (Resistência):</strong> Alta divergência de aproveitamento entre hiperfoco e contexto neutro. Sugere-se reforçar pontes temáticas.
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-[11px] leading-tight flex gap-2">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <div>
                          <strong>Evolução Estável:</strong> Níveis adequados de transferência entre contextos. Bom ritmo de generalização curricular.
                        </div>
                      </div>
                    )}

                  {/* Alert 2 */}
                  {weeklyData.reduce((acc, curr) => acc + curr.quizzesCount, 0) > 6 ? (
                    <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl text-[11px] leading-tight flex gap-2">
                      <Info size={16} className="shrink-0 text-blue-600" />
                      <div>
                        <strong>Monitoramento AP-2:</strong> Saturação temática sob controle. Quizzes distribuídos adequadamente em diferentes dias.
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl text-[11px] leading-tight flex gap-2">
                      <Info size={16} className="shrink-0 text-slate-500" />
                      <div>
                        <strong>AP-3 (Roteamento):</strong> Progresso gradual recomendado. Estimule o aluno com 1 quiz neutro a cada 3 quizzes com hiperfoco.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider pt-4 border-t border-slate-100 mt-2">
                Monitoramento Clínico Conforme PEI
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
