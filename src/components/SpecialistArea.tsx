import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import logoUrl from '../assets/images/logo.png';
import { motion, AnimatePresence } from 'motion/react';
import { UserCheck, MessageSquare, Send, Search, ArrowLeft, Loader2, Plus, Edit2, ClipboardList, Trash2, Check, RefreshCw, FileText, Upload, X, ClipboardCheck, Sparkles, AlertCircle } from 'lucide-react';
import { UserStats, SpecialistComment, Question, SpecialistAssignment, QuestionType, QuizConfig, ChildProfile } from '../types';
import { db } from '../firebase';
import { collection, addDoc, doc, setDoc, updateDoc, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { generateQuizQuestions, analyzeDocumentContent } from '../services/geminiService';
import * as mammoth from 'mammoth';
import { showToast } from '../lib/useToast';

interface SpecialistAreaProps {
  onClose: () => void;
  specialistId: string;
  specialistName: string;
  user: User | null;
  profiles: ChildProfile[];
  ownerUid: string;
}

interface StudentProfileItem {
  id: string;
  name: string;
  level: number;
  lastPlayed: string;
  xp: number;
  totalQuestions: number;
  streak: number;
  avatarUrl?: string;
  raw: ChildProfile;
}

export default function SpecialistArea({ 
  onClose, 
  specialistId, 
  specialistName, 
  user, 
  profiles = [], 
  ownerUid 
}: SpecialistAreaProps) {
  const [view, setView] = useState<'students' | 'pending' | 'history' | 'create'>('students');
  const [search, setSearch] = useState('');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsByStatus, setAssignmentsByStatus] = useState<SpecialistAssignment[]>([]);
  
  // Create flow states
  const [topic, setTopic] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Português');
  const [focus, setFocus] = useState('');
  const [grade, setGrade] = useState('7º ano');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [materialMode, setMaterialMode] = useState<'file' | 'text'>('file');
  const [materialContext, setMaterialContext] = useState<QuizConfig['materialContext']>(undefined);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Derive students list from profiles
  const studentsList: StudentProfileItem[] = (profiles || []).map(p => ({
    id: p.id,
    name: p.name,
    level: p.level ?? 1,
    lastPlayed: p.lastPlayed ? new Date(p.lastPlayed).toLocaleDateString('pt-BR') : '—',
    xp: p.xp ?? 0,
    totalQuestions: p.totalQuestions ?? 0,
    streak: p.streak ?? 0,
    avatarUrl: p.avatarUrl,
    raw: p
  }));

  const filteredStudents = studentsList.filter(student =>
    student.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (studentsList.length > 0) {
      if (!selectedStudentId || !studentsList.find(s => s.id === selectedStudentId)) {
        setSelectedStudentId(studentsList[0].id);
      }
    } else {
      setSelectedStudentId(null);
    }
  }, [studentsList, selectedStudentId]);

  const selectedStudent = studentsList.find(s => s.id === selectedStudentId) || null;

  // Real-time pending assignments from users/{ownerUid}/assignments
  useEffect(() => {
    if (!ownerUid) {
      setAssignmentsByStatus([]);
      setLoadingAssignments(false);
      return;
    }

    setLoadingAssignments(true);
    const assignmentsRef = collection(db, 'users', ownerUid, 'assignments');
    const q = query(assignmentsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpecialistAssignment));
      docs.sort((a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime());
      setAssignmentsByStatus(docs);
      setLoadingAssignments(false);
    }, (error) => {
      console.error("Erro ao carregar atividades pendentes:", error);
      setLoadingAssignments(false);
    });

    return () => unsubscribe();
  }, [ownerUid]);

  // Handle remind student: write comment in users/{ownerUid}/comments and update assignment remindedAt
  const handleRemindStudent = async (assignmentId: string, topicName: string, studentId?: string) => {
    if (!ownerUid) return;
    try {
      const commentData = {
        specialistId,
        specialistName,
        studentId: studentId || '',
        content: `Lembrete: você tem a atividade de ${topicName} pendente.`,
        date: new Date().toISOString(),
        category: 'recommendation' as const
      };
      await addDoc(collection(db, 'users', ownerUid, 'comments'), commentData);

      const assignmentRef = doc(db, 'users', ownerUid, 'assignments', assignmentId);
      await updateDoc(assignmentRef, {
        remindedAt: new Date().toISOString()
      });

      alert("Lembrete enviado ao aluno com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar lembrete:", error);
      alert("Erro ao enviar lembrete para o aluno. Tente novamente.");
    }
  };

  // Selected student history
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!ownerUid || !selectedStudent?.id) {
      setSelectedStudentHistory([]);
      return;
    }
    const historyRef = collection(db, 'users', ownerUid, 'history');
    const q = query(historyRef, orderBy('date', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allHistory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const studentHistory = allHistory.filter((item: any) => !item.profileId || item.profileId === selectedStudent.id);
      setSelectedStudentHistory(studentHistory.slice(0, 5));
    }, (err) => {
      console.error("Erro ao carregar histórico do aluno:", err);
    });
    return () => unsubscribe();
  }, [ownerUid, selectedStudent?.id]);

  // Overall history for history tab
  const [historyList, setHistoryList] = useState<any[]>([]);

  useEffect(() => {
    if (!ownerUid) {
      setHistoryList([]);
      return;
    }
    const historyRef = collection(db, 'users', ownerUid, 'history');
    const q = query(historyRef, orderBy('date', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => {
        const data = doc.data();
        const studentProfile = profiles.find(p => p.id === data.profileId);
        return {
          id: doc.id,
          student: studentProfile ? studentProfile.name : (data.profileName || 'Aluno'),
          topic: data.topic || data.subject || 'Atividade',
          date: data.date || new Date().toISOString(),
          score: data.score ?? 0,
          total: data.total ?? (data.wrongQuestions ? data.wrongQuestions.length + (data.score ?? 0) : 10)
        };
      });
      setHistoryList(entries);
    }, (err) => {
      console.error("Erro ao carregar histórico:", err);
    });
    return () => unsubscribe();
  }, [ownerUid, profiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setMaterialFile(file);

    try {
      const fileName = file.name.toLowerCase();
      let extractedText = '';

      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value.trim().replace(/\s+/g, ' ');
        setMaterialContext({ fileName: file.name, text: extractedText });
      } else if (fileName.endsWith('.pdf')) {
        const reader = new FileReader();
        const pdfPromise = new Promise<{ data: string, mimeType: string }>((resolve) => {
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            const data = { data: base64String, mimeType: 'application/pdf' };
            setMaterialContext({ fileName: file.name, inlineData: data });
            resolve(data);
          };
          reader.readAsDataURL(file);
        });
        await pdfPromise;
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        const text = await file.text();
        extractedText = text.trim();
        setMaterialContext({ fileName: file.name, text: extractedText });
      }

      // Try to auto-detect topic if content is extracted
      if (extractedText || materialContext?.inlineData) {
        const analysis = await analyzeDocumentContent(extractedText || '(PDF Content)');
        if (analysis.topic) setTopic(analysis.topic);
      }
    } catch (error) {
      console.error("Error extracting material:", error);
      alert("Erro ao processar o material. Tente outro arquivo ou cole o texto.");
    } finally {
      setIsExtracting(false);
    }
  };

  const removeFile = () => {
    setMaterialFile(null);
    setMaterialContext(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePastedTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPastedText(text);
    if (text.length > 50) {
      setMaterialContext({ fileName: 'Texto Colado', text });
      // Optional: Auto-detect topic
      if (text.length > 100) {
        try {
          const analysis = await analyzeDocumentContent(text);
          if (analysis.topic) setTopic(analysis.topic);
        } catch (e) {
          console.error("Analysis error:", e);
        }
      }
    } else {
      setMaterialContext(undefined);
    }
  };

  const handleGenerateAiQuestions = async () => {
    if (!topic || !focus) return;
    setIsAiGenerating(true);
    try {
      const completedQuizzes = selectedStudentHistory.length || selectedStudent?.totalQuestions || 0;
      const response = await generateQuizQuestions({
        subject: selectedSubject,
        topic,
        focus,
        grade,
        difficulty: 'média',
        count: 5,
        materialContext
      }, undefined, completedQuizzes);
      // Ensure all questions have a type
      const questionsWithType = response.questions.map(q => ({ ...q, type: 'multiple_choice' as QuestionType }));
      setQuestions(questionsWithType);
    } catch (error) {
      console.error("AI Generation error:", error);
      alert("Erro ao gerar questões. Tente novamente.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleUpdateQuestion = (index: number, updates: Partial<Question>) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      newQuestions[index] = { ...newQuestions[index], ...updates };
      return newQuestions;
    });
  };

  const handleAssignToStudent = async () => {
    if (questions.length === 0 || !selectedStudent) return;
    if (!ownerUid) {
      alert("Usuário não autenticado.");
      return;
    }
    setIsSending(true);
    try {
      const assignment: Omit<SpecialistAssignment, 'id'> = {
        specialistId,
        specialistName,
        studentId: selectedStudent.id,
        subject: selectedSubject,
        topic,
        questions,
        status: 'pending',
        assignedAt: new Date().toISOString()
      };
      
      const assignmentsRef = collection(db, 'users', ownerUid, 'assignments');
      await addDoc(assignmentsRef, assignment);
      
      alert(`Atividade enviada com sucesso para ${selectedStudent.name}!`);
      setView('students');
      setQuestions([]);
      setTopic('');
    } catch (error) {
      console.error("Erro ao atribuir atividade ao aluno:", error);
      alert("Erro ao enviar a atividade para o aluno. Tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendComment = async () => {
    if (!comment.trim() || !selectedStudent) return;
    if (!ownerUid) {
      alert("Usuário não autenticado.");
      return;
    }
    setIsSending(true);
    try {
      const commentData = {
        specialistId,
        specialistName,
        studentId: selectedStudent.id,
        content: comment,
        date: new Date().toISOString(),
        category: 'pedagogical' as const
      };
      
      const commentsRef = collection(db, 'users', ownerUid, 'comments');
      await addDoc(commentsRef, commentData);
      setComment('');
      alert("Orientação enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar orientação:", error);
      alert("Erro ao enviar orientação. Tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-20"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-indigo-50 p-2 shrink-0">
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Área do Especialista</h1>
            <p className="text-slate-500 text-sm font-medium">Gestão pedagógica e acompanhamento clínico.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setView('students')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'students' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Alunos
            </button>
            <button 
              onClick={() => setView('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Atividades Pendentes
            </button>
            <button 
              onClick={() => setView('history')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Histórico
            </button>
            <button 
              onClick={() => setView('create')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'create' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Criar Atividade
            </button>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-colors"
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'students' && (
          <motion.div 
            key="students"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Student List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-800">Meus Alunos</h3>
              </div>

              {profiles.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-100">
                  Nenhum perfil de aluno cadastrado. Crie um perfil na tela de seleção para começar.
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar aluno..." 
                      className="input-field pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-sm">
                        Nenhum aluno encontrado.
                      </div>
                    ) : (
                      filteredStudents.map(student => (
                        <button 
                          key={student.id} 
                          onClick={() => setSelectedStudentId(student.id)}
                          className={`w-full text-left p-4 border rounded-2xl transition-all group shadow-sm ${
                            selectedStudent?.id === student.id ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className={`font-bold ${selectedStudent?.id === student.id ? 'text-indigo-600' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                {student.name}
                              </div>
                              <div className="text-xs text-slate-400">Nível {student.level} • Último acesso: {student.lastPlayed}</div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Student Detail & Feedback */}
            <div className="lg:col-span-8 space-y-6">
              {!selectedStudent ? (
                <div className="glass-card p-8 rounded-[32px] text-center text-slate-500">
                  Nenhum perfil de aluno cadastrado. Crie um perfil na tela de seleção para começar.
                </div>
              ) : (
                <div className="glass-card p-6 md:p-8 rounded-[32px] space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 overflow-hidden">
                        {selectedStudent.avatarUrl ? (
                          <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserCheck size={24} />
                        )}
                      </div>
                      <div>
                        <div className="text-xl font-bold text-slate-900">{selectedStudent.name}</div>
                        <div className="text-sm text-slate-500">Perfil: Nível {selectedStudent.level}</div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase">Ativo</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-500 uppercase">Total XP</div>
                      <div className="text-xl font-black text-indigo-600">{selectedStudent.xp}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-500 uppercase">Questões</div>
                      <div className="text-xl font-black text-indigo-600">{selectedStudent.totalQuestions}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-500 uppercase">Ofensiva</div>
                      <div className="text-xl font-black text-amber-500">{selectedStudent.streak} 🔥</div>
                    </div>
                  </div>

                  {selectedStudentHistory.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-700">Últimas Atividades do Aluno</h4>
                      <div className="space-y-2">
                        {selectedStudentHistory.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <ClipboardCheck size={16} />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-800">{item.topic || item.subject || 'Atividade'}</div>
                                <div className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString('pt-BR')}</div>
                              </div>
                            </div>
                            <div className="text-sm font-black text-emerald-600">
                              {item.score}/{item.total}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <MessageSquare size={18} className="text-indigo-500" />
                      Enviar Comentário / Orientação
                    </label>
                    <textarea 
                      className="input-field min-h-[120px] resize-none"
                      placeholder="Oriente os pais ou o aluno..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    ></textarea>
                    <button 
                      onClick={handleSendComment}
                      disabled={isSending || !comment.trim()}
                      className="btn-primary w-full flex items-center justify-center gap-2 bg-indigo-600"
                    >
                      {isSending ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                      Enviar Orientação
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Histórico de Atividades</h2>
                  <p className="text-xs text-slate-500">Registros de atividades concluídas pelos alunos.</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-[32px] space-y-4">
              {historyList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhuma atividade concluída registrada no momento.
                </div>
              ) : (
                historyList.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <FileText size={18} className="text-emerald-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{item.student} - {item.topic}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concluído em: {new Date(item.date).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-600">{item.score}/{item.total}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Pontuação</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {view === 'pending' && (
          <motion.div 
            key="pending"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800">Atividades Pendentes</h2>
                  <p className="text-xs text-slate-500">Atividades enviadas que ainda não foram respondidas.</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-[32px] space-y-4">
              {loadingAssignments ? (
                <div className="flex flex-col items-center justify-center py-12 text-indigo-600 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium text-slate-500">Carregando atividades pendentes...</span>
                </div>
              ) : assignmentsByStatus.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhuma atividade pendente no momento.
                </div>
              ) : (
                assignmentsByStatus.map(item => {
                  const wasRemindedRecently = (item as any).remindedAt && (new Date().getTime() - new Date((item as any).remindedAt).getTime() < 24 * 60 * 60 * 1000);
                  const studentProfile = profiles.find(p => p.id === item.studentId);
                  const studentDisplayName = studentProfile ? studentProfile.name : (item as any).studentName || 'Aluno';
                  
                  return (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <RefreshCw size={18} className="text-amber-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{studentDisplayName} - {item.topic}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.subject} • Enviado em: {new Date(item.assignedAt).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemindStudent(item.id, item.topic, item.studentId)}
                      disabled={wasRemindedRecently}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        wasRemindedRecently 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-not-allowed'
                          : 'text-indigo-600 hover:bg-white border-indigo-100'
                      }`}
                    >
                      {wasRemindedRecently ? 'Lembrete enviado ✓' : 'Lembrar Aluno'}
                    </button>
                  </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {view === 'create' && (
          <motion.div 
            key="create"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="glass-card p-6 md:p-8 rounded-[32px] space-y-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                  <Edit2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Construir Atividade Dirigida</h2>
                  <p className="text-sm text-slate-500">Gere com IA e edite conforme necessário.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="space-y-4 md:col-span-2">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={16} className="text-indigo-500" />
                      Material de Apoio (Opcional)
                    </label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setMaterialMode('file')}
                        className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-all ${materialMode === 'file' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Arquivo
                      </button>
                      <button 
                        onClick={() => setMaterialMode('text')}
                        className={`text-[10px] px-3 py-1 rounded-lg font-bold transition-all ${materialMode === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Texto Colado
                      </button>
                    </div>
                  </div>

                  {materialMode === 'file' ? (
                    <div className="relative">
                      {!materialFile ? (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isExtracting}
                          className="w-full group py-8 px-6 bg-white border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-[24px] flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98]"
                        >
                          {isExtracting ? (
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                          ) : (
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              <Upload size={24} />
                            </div>
                          )}
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-700">Escolha um arquivo para basear o quiz</p>
                            <p className="text-xs text-slate-400 mt-1">DOCX, TXT, PDF ou MD (Máx 5MB)</p>
                          </div>
                        </button>
                      ) : (
                        <div className="p-4 bg-white border-2 border-indigo-100 rounded-[24px] flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                              <FileText size={20} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-800 truncate">{materialFile.name}</div>
                              <div className="text-[10px] text-slate-400 uppercase font-black">Pronto para processar</div>
                            </div>
                          </div>
                          <button 
                            onClick={removeFile}
                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".docx,.pdf,.txt,.md"
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={pastedText}
                        onChange={handlePastedTextChange}
                        placeholder="Cole aqui o texto do material de apoio (capítulo do livro, artigo, etc)..."
                        className="input-field min-h-[120px] text-sm resize-none"
                      />
                      <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                          {pastedText.length} caracteres
                        </p>
                        {pastedText.length > 0 && (
                          <button 
                            onClick={() => { setPastedText(''); setMaterialContext(undefined); }}
                            className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                          >
                            Limpar Texto
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Matéria</label>
                  <select 
                    className="input-field"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="Português">Português</option>
                    <option value="Matemática">Matemática</option>
                    <option value="Raciocínio Lógico">Raciocínio Lógico</option>
                    <option value="História">História</option>
                    <option value="Geografia">Geografia</option>
                    <option value="Ciências">Ciências</option>
                    <option value="Inglês">Inglês</option>
                    <option value="Artes">Artes</option>
                    <option value="Personalizada">Personalizada</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Assunto Pedagógico</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Ex: Equações, Egito Antigo..." 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Hiperfoco do Aluno ({selectedStudent?.name || 'Aluno'})</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Ex: Minecraft, Dinossauros..." 
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <button 
                    onClick={handleGenerateAiQuestions}
                    disabled={isAiGenerating || !topic || !focus}
                    className="w-full btn-secondary py-4 flex items-center justify-center gap-3 border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50 shadow-sm"
                  >
                    {isAiGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Processando Material e Criando Questões...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} className="text-indigo-500" />
                        <span className="font-bold">{questions.length > 0 ? 'Regerar Questões com este Material' : 'Gerar Atividade com IA'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {questions.length > 0 && (
                <div className="space-y-8 pt-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <h3 className="font-bold text-slate-800 text-lg">Questões da Atividade</h3>
                    <div className="text-xs text-slate-400 font-bold uppercase">{questions.length} itens</div>
                  </div>

                  <div className="space-y-12">
                    {questions.map((q, qIndex) => (
                      <div key={qIndex} className="space-y-6 relative pl-8 border-l-2 border-indigo-100 pb-8">
                        <div className="absolute -left-[11px] top-0 w-5 h-5 bg-indigo-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                          {qIndex + 1}
                        </div>

                        <div className="flex flex-wrap gap-2 items-center">
                          {(!q.contextType || q.contextType === 'hyperfocus') && (
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                              🚀 Tema de Interesse
                            </span>
                          )}
                          {q.contextType === 'transfer' && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                              🌉 Missão de Transferência
                            </span>
                          )}
                          {q.contextType === 'neutral' && (
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">
                              🎯 Território Neutro
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Enunciado da Questão</label>
                            <select 
                              value={q.type}
                              onChange={(e) => handleUpdateQuestion(qIndex, { type: e.target.value as QuestionType })}
                              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded focus:outline-none"
                            >
                              <option value="multiple_choice">Múltipla Escolha</option>
                              <option value="essay">Dissertativa</option>
                            </select>
                          </div>
                          <textarea 
                            value={q.text}
                            onChange={(e) => handleUpdateQuestion(qIndex, { text: e.target.value })}
                            className="input-field min-h-[80px] text-lg font-medium leading-snug"
                          />
                        </div>

                        {q.type === 'multiple_choice' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.options.map((opt, oIndex) => (
                              <div key={oIndex} className="relative">
                                <input 
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...q.options];
                                    newOpts[oIndex] = e.target.value;
                                    handleUpdateQuestion(qIndex, { options: newOpts });
                                  }}
                                  className={`input-field pl-12 ${q.correctAnswerIndex === oIndex ? 'border-emerald-300 bg-emerald-50/30' : ''}`}
                                />
                                <button 
                                  onClick={() => handleUpdateQuestion(qIndex, { correctAnswerIndex: oIndex })}
                                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                    q.correctAnswerIndex === oIndex ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-200 text-slate-400'
                                  }`}
                                >
                                  {q.correctAnswerIndex === oIndex ? <Check size={14} /> : oIndex + 1}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-sm italic">
                            O aluno verá um campo de texto aberto para responder esta questão.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={handleAssignToStudent}
                    disabled={isSending || !selectedStudent}
                    className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 bg-emerald-600 shadow-xl shadow-emerald-100"
                  >
                    {isSending ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    Finalizar e Atribuir ao Aluno ({selectedStudent?.name || 'Aluno'})
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
