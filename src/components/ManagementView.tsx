import React, { useEffect, useState } from "react";
import { User } from 'firebase/auth';
import { motion } from "motion/react";
import { db } from "../firebase";
import { collection, query, getDocs, where, setDoc, doc } from "firebase/firestore";
import { UserStats, QuizHistoryEntry } from "../types";
import {
  Users,
  Activity,
  Calendar,
  FileDown,
  ChevronLeft,
  ShieldCheck,
  TrendingUp,
  Brain,
  Shield,
  Briefcase,
  Database,
  Zap,
  Loader2
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { generateMockDataForStudent } from "../lib/mockData";
import { showToast } from "../lib/useToast";
import { testApiKeyStatus } from "../services/geminiService";

interface ManagementViewProps {
  onClose: () => void;
  user: User | null;
}

export default function ManagementView({ onClose, user }: ManagementViewProps) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<UserStats[]>([]);
  const [allHistory, setAllHistory] = useState<(QuizHistoryEntry & { studentId: string })[]>([]);
  const [isTestingKey, setIsTestingKey] = useState(false);

  const handleTestApiKey = async () => {
    setIsTestingKey(true);
    try {
      const result = await testApiKeyStatus();
      if (result.success) {
        showToast(result.message, 'success');
        alert(result.message);
      } else {
        showToast(result.message, 'error');
        alert("Erro na Chave API:\n" + result.message);
      }
    } catch (e: any) {
      showToast(e.message || "Erro ao testar chave API.", 'error');
      alert("Erro na Chave API:\n" + (e.message || "Erro desconhecido"));
    } finally {
      setIsTestingKey(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all students (MVP: we assume all users except specialists)
        const usersRef = collection(db, 'users');
        const qUsers = query(usersRef, where('role', '!=', 'specialist'));
        const usersSnap = await getDocs(qUsers);
        
        const studentsData = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserStats));
        setStudents(studentsData);

        // Fetch history for all these students
        // In a real app we would use Cloud Functions for aggregation, or collectionGroup
        // but here we just fetch them since it's an MVP.
        const historyData: (QuizHistoryEntry & { studentId: string })[] = [];
        for (const student of studentsData) {
          if (!student.uid) continue;
          const hRef = collection(db, 'users', student.uid, 'history');
          const hSnap = await getDocs(hRef);
          hSnap.docs.forEach(doc => {
            historyData.push({ id: doc.id, studentId: student.uid!, ...(doc.data() as QuizHistoryEntry) });
          });
        }
        
        // Sort history by date
        historyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setAllHistory(historyData);
      } catch (error) {
        console.error("Error fetching management data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Compute Metrics
  const activeStudents = students.filter(s => s.lastPlayed && (new Date().getTime() - new Date(s.lastPlayed).getTime()) < 30 * 24 * 60 * 60 * 1000).length;
  const totalSessions = allHistory.length;

  // Average weekly cadence
  let totalWeeks = 1;
  if (allHistory.length > 0) {
    const firstDate = new Date(allHistory[0].date).getTime();
    const lastDate = new Date(allHistory[allHistory.length - 1].date).getTime();
    const diffWeeks = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7));
    totalWeeks = diffWeeks;
  }
  const avgSessionsPerWeekPerStudent = students.length > 0 ? (totalSessions / totalWeeks) / students.length : 0;
  
  // Cadence traffic light
  let cadenceColor = "text-emerald-500 bg-emerald-50"; // 2-3
  let cadenceText = "Adequado (Protocolo 2-3x)";
  if (avgSessionsPerWeekPerStudent < 2) {
    cadenceColor = "text-amber-500 bg-amber-50";
    cadenceText = "Abaixo do protocolo";
  } else if (avgSessionsPerWeekPerStudent > 3) {
    cadenceColor = "text-red-500 bg-red-50";
    cadenceText = "Acima do protocolo (Uso excessivo)";
  }

  // Evolution chart (aggregate per week or month, here let's group by day/week for demo)
  // For simplicity, let's group by month-year
  const evolutionMap = new Map<string, { totalScore: number, totalMax: number, count: number }>();
  allHistory.forEach(entry => {
    const date = new Date(entry.date);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    const curr = evolutionMap.get(monthYear) || { totalScore: 0, totalMax: 0, count: 0 };
    curr.totalScore += entry.score;
    curr.totalMax += entry.total;
    curr.count += 1;
    evolutionMap.set(monthYear, curr);
  });

  const evolutionData = Array.from(evolutionMap.entries()).map(([month, data]) => ({
    name: month,
    pct: data.totalMax > 0 ? Math.round((data.totalScore / data.totalMax) * 100) : 0
  }));

  // Generalization Indicator
  let hyperfocusQuestions = 0;
  let hyperfocusCorrect = 0;
  let nonHyperfocusQuestions = 0; // transfer + neutral
  let nonHyperfocusCorrect = 0;

  allHistory.forEach(entry => {
    if (entry.questions && entry.questions.length > 0) {
      entry.questions.forEach((q: any) => {
        const context = q.contextType || "hyperfocus";
        const response = entry.responses?.find((r: any) => r.questionId === q.id);
        const isCorrect = response && (response.answer === q.correctAnswer || (q.options && q.correctAnswerIndex !== undefined && response.answer === q.options[q.correctAnswerIndex]));
        
        if (context === "hyperfocus") {
          hyperfocusQuestions++;
          if (isCorrect) hyperfocusCorrect++;
        } else {
          nonHyperfocusQuestions++;
          if (isCorrect) nonHyperfocusCorrect++;
        }
      });
    }
  });

  const generalizationData = [
    {
      name: 'Dentro do Hiperfoco',
      pct: hyperfocusQuestions > 0 ? Math.round((hyperfocusCorrect / hyperfocusQuestions) * 100) : 0,
      fill: '#6366f1' // indigo
    },
    {
      name: 'Território Neutro/Transferência',
      pct: nonHyperfocusQuestions > 0 ? Math.round((nonHyperfocusCorrect / nonHyperfocusQuestions) * 100) : 0,
      fill: '#10b981' // emerald
    }
  ];

  // LBI Export
  const handleExportLBI = () => {
    if (allHistory.length === 0) {
      alert("Nenhum dado disponível para exportação.");
      return;
    }

    const headers = [
      "Data Atendimento",
      "ID Aluno (Anonimizado)",
      "Disciplina",
      "Sessões Concluídas",
      "Índice de Acertos Geral (%)",
      "Índice Fora do Hiperfoco (%)"
    ];

    const csvRows = allHistory.map(entry => {
      const date = new Date(entry.date).toLocaleDateString('pt-BR');
      const anonId = `Aluno_${entry.studentId.substring(0, 5)}`;
      const pct = Math.round((entry.score / entry.total) * 100) + "%";
      
      let qH = 0, cH = 0, qNH = 0, cNH = 0;
      if (entry.questions) {
        entry.questions.forEach((q: any) => {
          const context = q.contextType || "hyperfocus";
          const response = entry.responses?.find((r: any) => r.questionId === q.id);
          const isCorrect = response && (response.answer === q.correctAnswer || (q.options && q.correctAnswerIndex !== undefined && response.answer === q.options[q.correctAnswerIndex]));
          if (context === "hyperfocus") { qH++; if (isCorrect) cH++; }
          else { qNH++; if (isCorrect) cNH++; }
        });
      }
      const pctNH = qNH > 0 ? Math.round((cNH / qNH) * 100) + "%" : "N/A";

      return [
        date, anonId, entry.subject, 1, pct, pctNH
      ].join(",");
    });

    const csvContent = headers.join(",") + "\n" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registro_lbi_agregado_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-b-[40px] shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-50"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <button 
                onClick={onClose}
                className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors text-sm font-bold"
              >
                <ChevronLeft size={16} /> Voltar para Dashboard
              </button>
              <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
                <Briefcase className="text-amber-400" size={32} />
                Visão de Gestão
              </h1>
              <p className="text-slate-300 font-medium">Painel executivo agregado para Secretaria de Educação</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestApiKey}
                disabled={isTestingKey}
                className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl transition-all font-bold text-sm shadow-md active:scale-95 disabled:opacity-50"
                title="Testar Chave API (Gemini)"
              >
                {isTestingKey ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="text-amber-400" />}
                <span>{isTestingKey ? "Testando..." : "Testar Chave API"}</span>
              </button>

              <button 
                onClick={async () => {
                  if (!user) return;
                  showToast('Gerando dados de teste...', 'success');
                  const mockStats = generateMockDataForStudent(user.uid);
                  await setDoc(doc(db, 'users', user.uid), mockStats.stats);
                  
                  for (const entry of mockStats.history) {
                    await setDoc(doc(db, 'users', user.uid, 'history', entry.id), entry);
                  }
                  
                  for (const badge of mockStats.badges) {
                    await setDoc(doc(db, 'users', user.uid, 'badges', badge.id), badge);
                  }
                  
                  for (const comment of mockStats.comments) {
                    await setDoc(doc(db, 'users', user.uid, 'comments', comment.id), comment);
                  }
                  
                  for (const assignment of mockStats.assignments) {
                    await setDoc(doc(db, 'users', user.uid, 'assignments', assignment.id), assignment);
                  }
                  showToast('Perfil fictício completo gerado com sucesso!', 'success');
                }}
                className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition-colors"
                title="Gerar Dados de Teste"
              >
                <Database size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
            <p className="text-slate-500 mt-4 font-medium">Carregando dados agregados...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-500 font-bold text-sm uppercase tracking-wider">Alunos Ativos (30d)</div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Users size={20} /></div>
                </div>
                <div className="text-4xl font-black text-slate-800">{activeStudents}</div>
                <div className="text-sm font-medium text-slate-400 mt-2">De {students.length} matriculados nesta unidade</div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-500 font-bold text-sm uppercase tracking-wider">Total de Sessões</div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Activity size={20} /></div>
                </div>
                <div className="text-4xl font-black text-slate-800">{totalSessions}</div>
                <div className="text-sm font-medium text-slate-400 mt-2">Missões concluídas globalmente</div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-500 font-bold text-sm uppercase tracking-wider">Cadência Média</div>
                  <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><Calendar size={20} /></div>
                </div>
                <div className="text-4xl font-black text-slate-800">{avgSessionsPerWeekPerStudent.toFixed(1)} <span className="text-lg text-slate-400">/sem</span></div>
                <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md inline-block mt-2 ${cadenceColor}`}>
                  {cadenceText}
                </div>
              </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <TrendingUp className="text-indigo-500" size={18} /> 
                  Evolução Média de Acertos (Global)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolutionData}>
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value}%`, 'Acertos Média']}
                      />
                      <Line type="monotone" dataKey="pct" stroke="#1e293b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Brain className="text-emerald-500" size={18} />
                  Indicador de Generalização (AEE)
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={generalizationData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value}%`, 'Taxa de Acerto']}
                      />
                      <Bar dataKey="pct" radius={[8, 8, 0, 0]} maxBarSize={60}>
                        {generalizationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-slate-500 mt-4 text-center font-medium bg-slate-50 p-2 rounded-xl">
                  Mede a capacidade dos alunos de transferir conhecimento do hiperfoco para cenários neutros.
                </div>
              </motion.div>
            </div>

            {/* Compliance LBI Block */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="inline-flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-300">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    Compliance Regulatório
                  </div>
                  <h3 className="text-2xl font-black">Registro de Atendimento (LBI)</h3>
                  <p className="text-slate-400 text-sm max-w-2xl">
                    Base para comprovação de oferta de Atendimento Educacional Especializado (AEE) conforme 
                    Lei Brasileira de Inclusão (Lei 13.146/2015). Gera arquivo CSV anonimizado para sistemas do MEC/Censo.
                  </p>
                </div>
                
                <button 
                  onClick={handleExportLBI}
                  className="shrink-0 w-full md:w-auto px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/50"
                >
                  <FileDown size={20} />
                  Exportar CSV Consolidado
                </button>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Privacy Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 px-6 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
          <Shield size={14} className="text-slate-400" />
          Relatório agregado e anonimizado — LGPD (Lei 13.709/2018). Dados individuais acessíveis apenas na Área do Especialista.
        </div>
      </div>
    </div>
  );
}
