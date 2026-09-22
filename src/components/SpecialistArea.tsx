import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import logoUrl from '../assets/images/logo.png';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserCheck, 
  MessageSquare, 
  Send, 
  Search, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Edit2, 
  ClipboardList, 
  Trash2, 
  Check, 
  RefreshCw, 
  FileText, 
  Upload, 
  X, 
  ClipboardCheck, 
  Sparkles, 
  AlertCircle, 
  ShieldAlert, 
  Info, 
  Bell 
} from 'lucide-react';
import { Question, SpecialistAssignment, QuestionType, QuizConfig, ChildProfile } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  limit 
} from 'firebase/firestore';
import { generateQuizQuestions, analyzeDocumentContent } from '../services/geminiService';
import * as mammoth from 'mammoth';
import { showToast } from '../lib/useToast';

interface SpecialistAreaProps {
  onClose: () => void;
  specialistId: string;
  specialistName: string;
  user: User | null;
  profiles?: ChildProfile[];
  ownerUid?: string;
}

export interface AuthorizedStudent {
  uid: string;
  name: string;
  email?: string;
  level: number;
  lastPlayed: string;
  xp: number;
  totalQuestions: number;
  streak: number;
  avatarUrl?: string;
  assignedSpecialist?: string;
  specialistId?: string;
  hyperfocus?: string;
}

export default function SpecialistArea({ 
  onClose, 
  specialistId, 
  specialistName, 
  user 
}: SpecialistAreaProps) {
  const [view, setView] = useState<'students' | 'pending' | 'history' | 'create'>('students');
  const [search, setSearch] = useState('');
  const [comment, setComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  // Real authorized students state
  const [authorizedStudents, setAuthorizedStudents] = useState<AuthorizedStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Real pending assignments state
  const [pendingAssignments, setPendingAssignments] = useState<(SpecialistAssignment & { studentName: string; studentUid: string })[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Real completed history assignments state
  const [completedAssignments, setCompletedAssignments] = useState<(SpecialistAssignment & { studentName: string; studentUid: string; score?: number; total?: number })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected student individual history
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<any[]>([]);

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

  // 1. Fetch only REAL authorized students for the authenticated specialist
  useEffect(() => {
    if (!specialistId) {
      setAuthorizedStudents([]);
      setLoadingStudents(false);
      return;
    }

    setLoadingStudents(true);
    setLoadError(null);

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('assignedSpecialist', '==', specialistId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AuthorizedStudent[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const studentName = data.displayName || 
          data.activeProfile?.name || 
          (Array.isArray(data.profiles) && data.profiles[0]?.name) || 
          `Aluno (${docSnap.id.substring(0, 6)})`;

        const studentFocus = data.focus || 
          data.activeProfile?.focus || 
          (Array.isArray(data.profiles) && data.profiles[0]?.focus) || 
          '';

        return {
          uid: docSnap.id,
          name: studentName,
          email: data.email,
          level: typeof data.level === 'number' ? data.level : 1,
          lastPlayed: data.lastPlayed ? new Date(data.lastPlayed).toLocaleDateString('pt-BR') : '—',
          xp: typeof data.xp === 'number' ? data.xp : 0,
          totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : 0,
          streak: typeof data.streak === 'number' ? data.streak : 0,
          avatarUrl: data.avatarUrl || data.activeProfile?.avatarUrl,
          assignedSpecialist: data.assignedSpecialist,
          specialistId: data.specialistId,
          hyperfocus: studentFocus
        };
      });

      setAuthorizedStudents(list);
      setLoadingStudents(false);
    }, (err) => {
      console.error("Erro ao carregar alunos vinculados ao especialista:", err);
      setLoadError("Não foi possível carregar os alunos vinculados. Verifique se seu perfil de especialista possui as permissões necessárias.");
      setLoadingStudents(false);
    });

    return () => unsubscribe();
  }, [specialistId]);

  // Synchronize selected student
  useEffect(() => {
    if (authorizedStudents.length > 0) {
      if (!selectedStudentId || !authorizedStudents.find(s => s.uid === selectedStudentId)) {
        setSelectedStudentId(authorizedStudents[0].uid);
      }
    } else {
      setSelectedStudentId(null);
    }
  }, [authorizedStudents, selectedStudentId]);

  const selectedStudent = authorizedStudents.find(s => s.uid === selectedStudentId) || null;

  // Auto-populate hyperfocus when selected student changes
  useEffect(() => {
    if (selectedStudent?.hyperfocus && !focus) {
      setFocus(selectedStudent.hyperfocus);
    }
  }, [selectedStudent]);

  const filteredStudents = authorizedStudents.filter(student =>
    student.name.toLowerCase().includes(search.toLowerCase().trim()) ||
    (student.email && student.email.toLowerCase().includes(search.toLowerCase().trim()))
  );

  // 2. Fetch REAL pending assignments across all authorized students
  useEffect(() => {
    if (authorizedStudents.length === 0) {
      setPendingAssignments([]);
      setLoadingPending(false);
      return;
    }

    setLoadingPending(true);
    const unsubs: (() => void)[] = [];
    const assignmentsMap = new Map<string, SpecialistAssignment & { studentName: string; studentUid: string }>();

    authorizedStudents.forEach(student => {
      const assignRef = collection(db, 'users', student.uid, 'assignments');
      const q = query(assignRef, where('status', '==', 'pending'));
      
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data() as SpecialistAssignment;
          if (data.specialistId === specialistId) {
            assignmentsMap.set(docSnap.id, {
              ...data,
              id: docSnap.id,
              studentName: student.name,
              studentUid: student.uid
            });
          }
        });

        // Clean up documents removed or changed status
        const currentDocIds = new Set(snapshot.docs.map(d => d.id));
        for (const [id, item] of assignmentsMap.entries()) {
          if (item.studentUid === student.uid && !currentDocIds.has(id)) {
            assignmentsMap.delete(id);
          }
        }

        const sorted = Array.from(assignmentsMap.values()).sort(
          (a, b) => new Date(b.assignedAt || 0).getTime() - new Date(a.assignedAt || 0).getTime()
        );
        setPendingAssignments(sorted);
        setLoadingPending(false);
      }, (error) => {
        console.error(`Erro ao carregar pendências do aluno ${student.uid}:`, error);
        setLoadingPending(false);
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [authorizedStudents, specialistId]);

  // 3. Fetch REAL completed assignments (Histórico) across all authorized students
  useEffect(() => {
    if (authorizedStudents.length === 0) {
      setCompletedAssignments([]);
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    const unsubs: (() => void)[] = [];
    const historyMap = new Map<string, SpecialistAssignment & { studentName: string; studentUid: string; score?: number; total?: number }>();

    authorizedStudents.forEach(student => {
      const assignRef = collection(db, 'users', student.uid, 'assignments');
      const q = query(assignRef, where('status', '==', 'completed'));
      
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data() as SpecialistAssignment;
          if (data.specialistId === specialistId) {
            let correctCount = 0;
            if (Array.isArray(data.studentResponses)) {
              correctCount = data.studentResponses.filter(r => r.isCorrect).length;
            }
            const totalCount = Array.isArray(data.questions) ? data.questions.length : 0;

            historyMap.set(docSnap.id, {
              ...data,
              id: docSnap.id,
              studentName: student.name,
              studentUid: student.uid,
              score: correctCount,
              total: totalCount || 5
            });
          }
        });

        const sorted = Array.from(historyMap.values()).sort(
          (a, b) => new Date(b.completedAt || b.assignedAt || 0).getTime() - new Date(a.completedAt || a.assignedAt || 0).getTime()
        );
        setCompletedAssignments(sorted);
        setLoadingHistory(false);
      }, (error) => {
        console.error(`Erro ao carregar histórico do aluno ${student.uid}:`, error);
        setLoadingHistory(false);
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [authorizedStudents, specialistId]);

  // 4. Fetch selected student individual activity history
  useEffect(() => {
    if (!selectedStudent) {
      setSelectedStudentHistory([]);
      return;
    }

    const assignRef = collection(db, 'users', selectedStudent.uid, 'assignments');
    const q = query(assignRef, where('status', '==', 'completed'), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => {
        const data = d.data() as SpecialistAssignment;
        let correctCount = 0;
        if (Array.isArray(data.studentResponses)) {
          correctCount = data.studentResponses.filter(r => r.isCorrect).length;
        }
        return {
          id: d.id,
          topic: data.topic,
          subject: data.subject,
          date: data.completedAt || data.assignedAt,
          score: correctCount,
          total: Array.isArray(data.questions) ? data.questions.length : 5
        };
      });

      items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setSelectedStudentHistory(items.slice(0, 5));
    }, (err) => {
      console.error("Erro ao carregar atividades do aluno selecionado:", err);
      setSelectedStudentHistory([]);
    });

    return () => unsub();
  }, [selectedStudent]);

  // 5. Handle remind student: execute real supported operation
  const handleRemindStudent = async (assignmentId: string, studentUid: string, topicName: string, subjectName: string) => {
    const isAuthorized = authorizedStudents.some(s => s.uid === studentUid);
    if (!isAuthorized) {
      showToast("Operação não autorizada para este aluno.", "error");
      return;
    }

    try {
      // 1. Update assignment doc with remindedAt timestamp
      const assignmentRef = doc(db, 'users', studentUid, 'assignments', assignmentId);
      await updateDoc(assignmentRef, {
        remindedAt: new Date().toISOString()
      });

      // 2. Post recommendation orientation comment for student
      const commentsRef = collection(db, 'users', studentUid, 'comments');
      await addDoc(commentsRef, {
        specialistId,
        specialistName,
        studentId: studentUid,
        content: `Lembrete de Atividade: A missão de ${subjectName} sobre "${topicName}" está aguardando você!`,
        date: new Date().toISOString(),
        category: 'recommendation'
      });

      showToast("Lembrete registrado com sucesso no portal do aluno!", "success");
    } catch (error: any) {
      console.error("Erro ao enviar lembrete:", error);
      showToast("Erro ao registrar lembrete. Verifique as permissões de acesso.", "error");
    }
  };

  // Material extraction helpers
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
      const completedCount = selectedStudent?.totalQuestions || 0;
      const response = await generateQuizQuestions({
        subject: selectedSubject,
        topic,
        focus,
        grade,
        difficulty: 'média',
        count: 5,
        materialContext
      }, undefined, completedCount);

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

  // 6. Assign activity with strict specialist-student link validation
  const handleAssignToStudent = async () => {
    if (questions.length === 0 || !selectedStudent) return;
    
    // Strict link validation against authorized students
    const isAuthorized = authorizedStudents.some(s => s.uid === selectedStudent.uid);
    if (!isAuthorized) {
      showToast("Erro de segurança: Aluno não autorizado ou não vinculado ao especialista.", "error");
      alert("Atribuição não permitida: O estudante selecionado não possui vínculo pedagógico ativo com este especialista.");
      return;
    }

    setIsSending(true);
    try {
      // Server verification before writing
      const studentDocRef = doc(db, 'users', selectedStudent.uid);
      const studentSnap = await getDoc(studentDocRef);
      if (!studentSnap.exists()) {
        throw new Error("Estudante não encontrado no banco de dados.");
      }
      const studentData = studentSnap.data();
      if (studentData.assignedSpecialist !== specialistId && studentData.specialistId !== specialistId) {
        throw new Error("Vínculo especialista-aluno não confirmado no servidor.");
      }

      const assignment: Omit<SpecialistAssignment, 'id'> = {
        specialistId,
        specialistName,
        studentId: selectedStudent.uid,
        subject: selectedSubject,
        topic,
        questions,
        status: 'pending',
        assignedAt: new Date().toISOString()
      };
      
      const assignmentsRef = collection(db, 'users', selectedStudent.uid, 'assignments');
      await addDoc(assignmentsRef, assignment);
      
      showToast(`Atividade atribuída com sucesso para ${selectedStudent.name}!`, "success");
      alert(`Atividade enviada com sucesso para ${selectedStudent.name}!`);
      setView('pending');
      setQuestions([]);
      setTopic('');
    } catch (error: any) {
      console.error("Erro ao atribuir atividade ao aluno:", error);
      alert(`Erro ao atribuir atividade: ${error.message || "Permissão negada"}`);
      showToast("Erro ao enviar atividade.", "error");
    } finally {
      setIsSending(false);
    }
  };

  // 7. Send orientation with link verification
  const handleSendComment = async () => {
    if (!comment.trim() || !selectedStudent) return;

    const isAuthorized = authorizedStudents.some(s => s.uid === selectedStudent.uid);
    if (!isAuthorized) {
      alert("Operação negada: o aluno não está vinculado ao seu perfil.");
      return;
    }

    setIsSending(true);
    try {
      const commentData = {
        specialistId,
        specialistName,
        studentId: selectedStudent.uid,
        content: comment.trim(),
        date: new Date().toISOString(),
        category: 'pedagogical' as const
      };
      
      const commentsRef = collection(db, 'users', selectedStudent.uid, 'comments');
      await addDoc(commentsRef, commentData);
      setComment('');
      showToast("Orientação pedagógica enviada com sucesso!", "success");
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
      {/* Header */}
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Área do Especialista</h1>
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                Auditado
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">Gestão pedagógica e acompanhamento clínico com vínculo autorizado.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setView('students')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'students' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Alunos ({authorizedStudents.length})
            </button>
            <button 
              onClick={() => setView('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Atividades Pendentes ({pendingAssignments.length})
            </button>
            <button 
              onClick={() => setView('history')}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${view === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Histórico ({completedAssignments.length})
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
        {/* VIEW: STUDENTS */}
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
                <h3 className="font-bold text-slate-800">Alunos Vinculados</h3>
                <span className="text-xs font-bold text-slate-400">Total: {authorizedStudents.length}</span>
              </div>

              {loadingStudents ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs text-slate-500 font-medium">Consultando alunos vinculados...</span>
                </div>
              ) : loadError ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldAlert size={18} />
                    <span>Erro de Acesso</span>
                  </div>
                  <p className="text-xs">{loadError}</p>
                </div>
              ) : authorizedStudents.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <UserCheck size={24} />
                  </div>
                  <div className="font-bold text-slate-700">Nenhum aluno vinculado</div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Você não possui estudantes atribuídos ao seu UID (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">{specialistId}</code>).
                  </p>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 text-left space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <Info size={14} />
                      Modelo de Vínculo Seguro:
                    </div>
                    <div>
                      O vínculo especialista-aluno é configurado administrativamente no documento do aluno em <code className="font-mono">users/{'{studentUid}'}</code> atribuindo <code className="font-mono">assignedSpecialist = "{specialistId}"</code>.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar aluno vinculado..." 
                      className="input-field pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-sm">
                        Nenhum aluno encontrado na busca.
                      </div>
                    ) : (
                      filteredStudents.map(student => (
                        <button 
                          key={student.uid} 
                          onClick={() => setSelectedStudentId(student.uid)}
                          className={`w-full text-left p-4 border rounded-2xl transition-all group shadow-sm ${
                            selectedStudent?.uid === student.uid ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 pr-2">
                              <div className={`font-bold truncate ${selectedStudent?.uid === student.uid ? 'text-indigo-600' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                                {student.name}
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                Nível {student.level} • Último acesso: {student.lastPlayed}
                              </div>
                              {student.hyperfocus && (
                                <div className="text-[11px] text-indigo-500 font-medium truncate mt-0.5">
                                  Hiperfoco: {student.hyperfocus}
                                </div>
                              )}
                            </div>
                            <span className="shrink-0 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md uppercase">
                              Vinculado
                            </span>
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
                <div className="glass-card p-8 rounded-[32px] text-center text-slate-500 space-y-4">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <UserCheck size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-700">Selecione um Aluno Vinculado</h4>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Para visualizar prontuário, atividades realizadas ou atribuir novas tarefas, selecione um aluno na lista ao lado.
                  </p>
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
                        <div className="text-xs text-slate-500">
                          UID: <code className="font-mono text-slate-600">{selectedStudent.uid}</code>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase">
                      Vínculo Ativo
                    </span>
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

                  {/* Real activities from Firestore */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-700">Atividades Concluídas Recentes</h4>
                    {selectedStudentHistory.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs border border-slate-100">
                        Nenhuma atividade concluída registrada para este aluno ainda.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedStudentHistory.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <ClipboardCheck size={16} />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-800">{item.topic || item.subject || 'Atividade'}</div>
                                <div className="text-xs text-slate-400">
                                  {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-black text-emerald-600">
                              {item.score}/{item.total} acertos
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pedagogical orientation form */}
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <MessageSquare size={18} className="text-indigo-500" />
                      Enviar Comentário / Orientação Pedagógica
                    </label>
                    <textarea 
                      className="input-field min-h-[120px] resize-none"
                      placeholder="Escreva uma orientação aos pais ou ao aluno..."
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

        {/* VIEW: HISTORY (Real completed activities) */}
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
                  <h2 className="font-bold text-slate-800">Histórico de Atividades Concluídas</h2>
                  <p className="text-xs text-slate-500">Registros reais de atividades concluídas por alunos vinculados a você.</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-[32px] space-y-4">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 text-indigo-600 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium text-slate-500">Consultando atividades concluídas...</span>
                </div>
              ) : completedAssignments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <FileText size={24} />
                  </div>
                  <div className="font-bold text-slate-700">Nenhuma atividade concluída registrada</div>
                  <p className="text-xs text-slate-400">
                    Quando os alunos vinculados finalizarem atividades pendentes, os resultados detalhados serão exibidos aqui.
                  </p>
                </div>
              ) : (
                completedAssignments.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <FileText size={18} className="text-emerald-500" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {item.studentName} — {item.topic}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {item.subject} • Concluído em: {item.completedAt ? new Date(item.completedAt).toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-emerald-600">{item.score}/{item.total}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Acertos</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW: PENDING (Real pending assignments) */}
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
                  <p className="text-xs text-slate-500">Atividades enviadas que aguardam resolução pelos estudantes vinculados.</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-[32px] space-y-4">
              <div className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-700">
                <Info size={16} className="shrink-0" />
                <span>
                  O botão <strong>Lembrar Aluno</strong> registra um lembrete com destaque visual na tela inicial do estudante e emite uma recomendação pedagógica em seu prontuário.
                </span>
              </div>

              {loadingPending ? (
                <div className="flex flex-col items-center justify-center py-12 text-indigo-600 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm font-medium text-slate-500">Carregando atividades pendentes...</span>
                </div>
              ) : pendingAssignments.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <RefreshCw size={24} />
                  </div>
                  <div className="font-bold text-slate-700">Nenhuma atividade pendente no momento</div>
                  <p className="text-xs text-slate-400">
                    Todas as atividades enviadas para seus alunos já foram respondidas ou você ainda não atribuiu novas tarefas.
                  </p>
                </div>
              ) : (
                pendingAssignments.map(item => {
                  const wasRemindedRecently = item.remindedAt && (new Date().getTime() - new Date(item.remindedAt).getTime() < 24 * 60 * 60 * 1000);
                  
                  return (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <RefreshCw size={18} className="text-amber-500" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{item.studentName} — {item.topic}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {item.subject} • Enviado em: {new Date(item.assignedAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemindStudent(item.id, item.studentUid, item.topic, item.subject)}
                        disabled={!!wasRemindedRecently}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                          wasRemindedRecently 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-not-allowed'
                            : 'text-indigo-600 hover:bg-white border-indigo-200 bg-white shadow-sm'
                        }`}
                      >
                        <Bell size={13} />
                        {wasRemindedRecently ? 'Lembrete enviado ✓' : 'Lembrar Aluno'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW: CREATE ACTIVITY */}
        {view === 'create' && (
          <motion.div 
            key="create"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="glass-card p-6 md:p-8 rounded-[32px] space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                    <Edit2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Construir Atividade Dirigida</h2>
                    <p className="text-sm text-slate-500">Gere com IA pedagógica e edite conforme necessário antes da atribuição.</p>
                  </div>
                </div>

                {selectedStudent && (
                  <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 font-bold flex items-center gap-2">
                    <UserCheck size={16} />
                    <span>Destino: {selectedStudent.name}</span>
                  </div>
                )}
              </div>

              {authorizedStudents.length === 0 ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    <ShieldAlert size={18} />
                    Nenhum Aluno Vinculado Disponível
                  </div>
                  <p className="text-xs">
                    Para criar e atribuir atividades, é obrigatório possuir pelo menos um aluno vinculado ao seu perfil de especialista. O vínculo é configurado administrativamente no Firestore através do campo <code className="font-mono">assignedSpecialist</code>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  {/* Student selector */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Aluno Destinatário (Vínculo Autorizado)</label>
                    <select 
                      className="input-field font-bold text-slate-800"
                      value={selectedStudentId || ''}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                    >
                      {authorizedStudents.map(student => (
                        <option key={student.uid} value={student.uid}>
                          {student.name} ({student.email || student.uid})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Material de apoio */}
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

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      Hiperfoco / Ponto de Engajamento ({selectedStudent?.name || 'Aluno'})
                    </label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Ex: Minecraft, Dinossauros, Espaço Sideral..." 
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
              )}

              {/* Question list editor */}
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
