import React, { useState, useRef } from 'react';
import { QuizConfig, Difficulty, LearningTrail, CachedQuiz } from '../types';
import { BookOpen, Target, Layers, Hash, Play, Zap, GraduationCap, Map, ChevronRight, Star, PlusCircle, HelpCircle, FileText, Upload, X, Loader2, Trash2, WifiOff, Sparkles, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import { checkInappropriateContent, analyzeDocumentContent } from '../services/geminiService';
import { auth, db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import InterestSurvey from './InterestSurvey';
import { getHyperfocusRatio } from '../lib/utils';

interface HelpTooltipProps {
  text: string;
}

function HelpTooltip({ text }: HelpTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-300 hover:text-primary transition-colors"
      >
        <HelpCircle size={14} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-800 text-white text-[10px] leading-relaxed rounded-xl shadow-xl z-50 pointer-events-none"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface QuizSetupProps {
  onStart: (config: QuizConfig) => void;
  isLoading: boolean;
  activeTrail: LearningTrail | null;
  onStartTrail: (trail: LearningTrail) => void;
  onDeleteTrail?: () => void;
  cachedQuizzes?: CachedQuiz[];
  onStartCachedQuiz?: (quiz: CachedQuiz) => void;
  isOffline?: boolean;
  defaultGender?: 'masculino' | 'feminino' | 'outro';
  completedQuizzes?: number;
}

const subjects = [
  'Português',
  'Matemática',
  'Raciocínio Lógico',
  'História',
  'Geografia',
  'Ciências',
  'Inglês',
  'Artes'
];

const grades = [
  '1º ano', '2º ano', '3º ano', '4º ano', '5º ano',
  '6º ano', '7º ano', '8º ano', '9º ano'
];

export default function QuizSetup({ 
  onStart, 
  isLoading, 
  activeTrail, 
  onStartTrail, 
  onDeleteTrail, 
  cachedQuizzes = [],
  onStartCachedQuiz,
  isOffline = false,
  defaultGender = 'masculino',
  completedQuizzes = 0
}: QuizSetupProps) {
  const [subject, setSubject] = useState(subjects[0]);
  const [grade, setGrade] = useState(grades[6]); // Default 7º ano
  const [gender, setGender] = useState<'masculino' | 'feminino' | 'outro'>(defaultGender);
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('média');
  const [count, setCount] = useState(5);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [materialMode, setMaterialMode] = useState<'file' | 'text'>('file');
  const [materialContext, setMaterialContext] = useState<QuizConfig['materialContext']>(undefined);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isValidatingContent, setIsValidatingContent] = useState(false);
  const [saveToArchive, setSaveToArchive] = useState(true);
  const [showInterestSurvey, setShowInterestSurvey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation: Extension
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      alert("Formato não suportado. Por favor envie PDF, DOCX, TXT ou MD.");
      removeFile();
      return;
    }

    // Client-side validation: Size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("O arquivo é muito grande. O limite máximo é de 5MB.");
      removeFile();
      return;
    }

    setIsExtracting(true);
    setMaterialFile(file);

    try {
      let extractedText = '';
      let inlineData: any = null;

      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value.trim().replace(/\s+/g, ' ');
        setMaterialContext({
          fileName: file.name,
          text: extractedText
        });
      } else if (fileName.endsWith('.pdf')) {
        // Read file as base64 for Gemini
        const reader = new FileReader();
        const pdfPromise = new Promise<{ data: string, mimeType: string }>((resolve) => {
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            const data = {
              data: base64String,
              mimeType: 'application/pdf'
            };
            setMaterialContext({
              fileName: file.name,
              inlineData: data
            });
            resolve(data);
          };
          reader.readAsDataURL(file);
        });
        inlineData = await pdfPromise;
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        extractedText = await file.text();
        extractedText = extractedText.trim().replace(/\s+/g, ' ');
        setMaterialContext({
          fileName: file.name,
          text: extractedText
        });
      }

      // Automatic detection
      setIsExtracting(true); // Keep it true or visual indication
      const analysis = await analyzeDocumentContent(inlineData ? { inlineData } : extractedText);
      
      if (analysis.subject) setSubject(analysis.subject);
      
      if (analysis.topic) {
        setTopic(analysis.topic);
      } else {
        // Fallback default topic if the AI completely misbehaves or document is illegible
        setTopic(fileName.replace(/\.[^/.]+$/, "")); 
      }

    } catch (err) {
      console.error("Erro ao ler o arquivo", err);
      alert("Erro ao ler o arquivo. Tente novamente.");
      removeFile();
    } finally {
      setIsExtracting(false);
    }
  };

  const removeFile = () => {
    setMaterialFile(null);
    setMaterialContext(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePastedTextAnalysis = async (text: string) => {
    if (!text.trim()) {
      setMaterialContext(undefined);
      return;
    }
    
    setIsExtracting(true);
    try {
      const cleanText = text.trim().replace(/\s+/g, ' ');
      setMaterialContext({
        fileName: 'Texto Colado.txt',
        text: cleanText
      });

      const analysis = await analyzeDocumentContent(cleanText);
      if (analysis.subject) setSubject(analysis.subject);
      if (analysis.topic) setTopic(analysis.topic);
    } catch (err) {
      console.error("Erro ao analisar texto colado", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    if (focus.trim()) {
      setIsValidatingContent(true);
      const isSafe = await checkInappropriateContent(focus);
      setIsValidatingContent(false);
      
      if (!isSafe) {
        alert("Por favor, escolha um hiperfoco ou tema de estudo com palavras apropriadas e respeitosas.");
        return;
      }
    }

    if (materialFile && saveToArchive && auth.currentUser) {
      // Async background upload so we don't delay the quiz generation
      const userId = auth.currentUser.uid;
      const fileRef = ref(storage, `users/${userId}/materials/${Date.now()}_${materialFile.name}`);
      uploadBytes(fileRef, materialFile).then(async (snapshot) => {
        const downloadURL = await getDownloadURL(snapshot.ref);
        await addDoc(collection(db, `users/${userId}/materials`), {
          userId,
          fileName: materialFile.name,
          downloadURL,
          uploadedAt: new Date().toISOString(),
          size: materialFile.size,
          type: materialFile.type
        });
      }).catch((err) => {
        console.error("Erro ao salvar arquivo no arquivo:", err);
      });
    }

    onStart({ subject, topic, focus: focus || 'Genérico', grade, difficulty, count, materialContext, gender });
  };


  const handleCreateTrail = async () => {
    if (!topic.trim() || !focus.trim()) {
      alert("Preencha o tema e o hiperfoco para criar uma trilha!");
      return;
    }

    setIsValidatingContent(true);
    const isSafe = await checkInappropriateContent(focus);
    setIsValidatingContent(false);
    
    if (!isSafe) {
      alert("Por favor, escolha um hiperfoco ou tema de estudo com palavras apropriadas e respeitosas.");
      return;
    }

    const newTrail: LearningTrail = {
      id: Math.random().toString(36).substr(2, 9),
      subject,
      topic,
      focus,
      grade,
      currentStep: 0,
      totalSteps: 10,
      status: 'active'
    };
    onStartTrail(newTrail);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-2 sm:p-6 space-y-6"
    >
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">HiperReforço</h1>
        <p className="text-slate-500">Transformando seu hiperfoco em super aprendizado!</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 sm:p-8 rounded-3xl space-y-6 bg-white border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BookOpen size={18} className="text-primary" />
              Matéria
            </label>
            <select 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input-field"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <GraduationCap size={18} className="text-primary" />
              Ano Escolar
            </label>
            <select 
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="input-field"
            >
              {grades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Zap size={18} className="text-amber-500" />
            Qual o seu hiperfoco hoje?
            <HelpTooltip text="O hiperfoco é o tema que você mais gosta no momento. Usaremos ele para criar exemplos e histórias que tornam o aprendizado mais divertido!" />
          </label>
          <div className="relative group">
            <input 
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Ex: Dinossauros, Minecraft, Harry Potter..."
              className="input-field border-amber-100 focus:border-amber-500 pr-32"
            />
            <button
              type="button"
              onClick={() => setShowInterestSurvey(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all text-[10px] font-black uppercase tracking-wider"
            >
              <Sparkles size={12} />
              Descobrir
            </button>
          </div>
          {!focus.trim() && (
            <p className="text-[10px] text-slate-500 font-medium bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
              💡 <span className="font-bold">Dica:</span> Se você deixar vazio, faremos um <span className="text-blue-700 font-black">SIMULADO DE PROVA</span> igualzinho aos da escola, com temas variados para você ficar craque em tudo!
            </p>
          )}
          {focus.trim() && (
            <div className="flex flex-col gap-2">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[10px] bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 font-bold border border-amber-100 self-start"
              >
                <Star size={12} className="fill-amber-500 text-amber-500" />
                Explicações mágicas com {focus} ativadas!
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[10px] text-slate-500 flex items-center gap-1.5 px-2"
              >
                <span>Fase de progressão: {Math.round(getHyperfocusRatio(completedQuizzes) * 100)}% hiperfoco / {Math.round((1 - getHyperfocusRatio(completedQuizzes)) * 100)}% neutro (aluno com {completedQuizzes} missões concluídas)</span>
                <HelpTooltip text="A migração progressiva do hiperfoco para temas neutros é uma salvaguarda pedagógica (não um defeito), para garantir o desenvolvimento de competências em diferentes contextos." />
              </motion.div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Target size={18} className="text-primary" />
            Tema Específico
            <HelpTooltip text="É o assunto da escola que você quer estudar. Pode ser algo que caiu na prova ou que você achou difícil." />
          </label>
          <input 
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: Revolução Francesa, Equações de 1º grau..."
            className="input-field"
            required
          />
        </div>

        <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileText size={18} className="text-primary" />
              <span>Material de Apoio (Opcional)</span>
              <HelpTooltip text="Anexe uma apostila ou cole um resumo. O quiz será gerado usando as informações deste conteúdo!" />
            </label>
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setMaterialMode('file')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${materialMode === 'file' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
              >
                ARQUIVO
              </button>
              <button
                type="button"
                onClick={() => setMaterialMode('text')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${materialMode === 'text' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
              >
                TEXTO
              </button>
            </div>
          </div>
          
          <div className="mt-3">
            {materialMode === 'file' ? (
              <>
                {!materialFile ? (
                  <div 
                    onClick={() => !isExtracting && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors ${
                      isExtracting 
                        ? 'border-slate-200 bg-slate-50 cursor-wait' 
                        : 'border-slate-300 hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    {isExtracting ? (
                      <>
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                          <Loader2 className="animate-spin" size={20} />
                        </div>
                        <div className="text-sm font-medium text-primary">Processando material...</div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                          <Upload size={20} />
                        </div>
                        <div className="text-sm font-medium text-slate-600">Clique para enviar um arquivo</div>
                        <div className="text-xs text-slate-400">PDF, DOCX, TXT ou MD</div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-white border border-primary/20 p-3 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-bold text-slate-700 truncate">{materialFile.name}</div>
                        <div className="text-xs text-slate-400">Arquivo pronto para uso</div>
                      </div>
                    </div>
                    <button type="button" onClick={removeFile} className="p-2 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                  }}
                  onBlur={() => handlePastedTextAnalysis(pastedText)}
                  className="input-field resize-none text-sm font-normal py-3"
                  placeholder="Cole aqui o seu resumo, anotações da aula ou trechos do livro..."
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-400">
                    O HiperReforço analisará o texto para sugerir a Matéria e o Tema automaticamente.
                  </p>
                  {isExtracting && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Analisando...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt,.md" 
              className="hidden"
            />
            {materialFile && materialMode === 'file' && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer text-sm text-slate-600">
                <input 
                  type="checkbox" 
                  checked={saveToArchive}
                  onChange={(e) => setSaveToArchive(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                Salvar este material em Meus Arquivos
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Layers size={18} className="text-primary" />
              Complexidade
              <HelpTooltip text="Baixa: conceitos básicos. Média: nível escolar padrão. Alta: desafios extras para quem quer ir além!" />
            </label>
            <div className="flex gap-2">
              {(['baixa', 'média', 'alta'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    difficulty === d 
                      ? 'bg-primary text-white shadow-md' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Hash size={18} className="text-primary" />
              Nº de Questões
            </label>
            <input 
              type="number"
              min="1"
              max="20"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button 
            type="submit" 
            disabled={isLoading || isValidatingContent || !topic.trim() || isOffline}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
          >
            {isLoading || isValidatingContent ? (
              <>
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isValidatingContent ? 'Aprovando tema...' : ''}
              </>
            ) : isOffline ? (
              <>
                <WifiOff size={20} />
                Gerador Offline
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" />
                Começar Desafio com Meu Hiperfoco 🚀
              </>
            )}
          </button>

          <button 
            type="button"
            onClick={(e) => {
              setFocus('');
              // Small delay to ensure state update if needed, though e.preventDefault + direct call is safer
              setTimeout(() => {
                const form = (e.target as HTMLElement).closest('form');
                form?.requestSubmit();
              }, 50);
            }}
            disabled={isLoading || isValidatingContent || !topic.trim() || isOffline}
            className="w-full py-4 bg-white border-2 border-primary text-primary font-black rounded-3xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <GraduationCap size={20} />
            Apenas Simulado de Prova (Sem Hiperfoco) 📝
          </button>
          
          {!activeTrail && (
            <button 
              type="button" 
              onClick={handleCreateTrail}
              disabled={isLoading || isValidatingContent || !topic.trim() || !focus.trim() || isOffline}
              className="btn-secondary w-full flex items-center justify-center gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:grayscale"
            >
              <PlusCircle size={20} />
              Criar Trilha de Estudos 🗺️
            </button>
          )}
        </div>

        {isOffline && (
          <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
              <WifiOff size={18} />
            </div>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              Você está desconectado. Para continuar estudando agora, use um dos **Quizzes Salvos** no topo da página. Eles funcionam sem internet!
            </p>
          </div>
        )}
      </form>

      <AnimatePresence>
        {showInterestSurvey && (
          <InterestSurvey 
            grade={grade} 
            onSelectTheme={(theme, selectedGender) => {
              setFocus(theme);
              setGender(selectedGender as 'masculino' | 'feminino' | 'outro');
              setShowInterestSurvey(false);
            }}
            onClose={() => setShowInterestSurvey(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
