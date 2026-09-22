import React, { useState, useEffect } from 'react';
import { Question } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, Trophy, Timer, PauseCircle, PlayCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface QuizGameProps {
  questions: Question[];
  onComplete: (score: number, wrongQuestions: { text: string; explanation: string }[], skippedQuestions: { text: string }[], responses?: { questionId: string; answer: string; isSkipped?: boolean }[], durations?: { questionText: string; duration: number }[]) => void;
  onSaveProgress?: (currentIndex: number, score: number, wrongQuestions: any[], skippedIndices: number[], responses: any[], durations: any[]) => void;
  showFeedback?: boolean;
  isEducatorView?: boolean;
  initialState?: {
    currentIndex: number;
    score: number;
    wrongQuestions: { text: string; explanation: string }[];
    skippedQuestionIndices: number[];
    responses: { questionId: string; answer: string; isSkipped?: boolean }[];
    durations: { questionText: string; duration: number }[];
  };
}

export default function QuizGame({ 
  questions, 
  onComplete, 
  onSaveProgress,
  showFeedback = true,
  isEducatorView = false,
  initialState
}: QuizGameProps) {
  const [currentIndex, setCurrentIndex] = useState(initialState?.currentIndex || 0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [essayResponse, setEssayResponse] = useState('');
  const [essayError, setEssayError] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(initialState?.score || 0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedBeforePause, setElapsedBeforePause] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<{ text: string; explanation: string }[]>(initialState?.wrongQuestions || []);
  const [skippedQuestionIndices, setSkippedQuestionIndices] = useState<number[]>(initialState?.skippedQuestionIndices || []);
  const [allResponses, setAllResponses] = useState<{ questionId: string; answer: string; isSkipped?: boolean }[]>(initialState?.responses || []);
  const [questionDurations, setQuestionDurations] = useState<{ questionText: string; duration: number }[]>(initialState?.durations || []);
  const { focusMode } = useAccessibility();

  const currentQuestion = questions[currentIndex];

  const handlePause = () => {
    setElapsedBeforePause(prev => prev + (Date.now() - startTime));
    setIsPaused(true);
  };

  const handleResume = () => {
    setStartTime(Date.now());
    setIsPaused(false);
  };

  const handleAnswer = (index: number) => {
    if (isAnswered) return;
    
    const endTime = Date.now();
    const duration = Math.round((elapsedBeforePause + (endTime - startTime)) / 1000);
    
    setSelectedOption(index);
    setIsAnswered(true);
    
    const isCorrect = index === currentQuestion.correctAnswerIndex;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    } else {
      setWrongQuestions(prev => [...prev, { text: currentQuestion.text, explanation: currentQuestion.explanation }]);
    }

    setQuestionDurations(prev => [...prev, { questionText: currentQuestion.text, duration }]);
    setAllResponses(prev => [...prev, { 
      questionId: currentQuestion.id || String(currentIndex), 
      answer: index >= 0 ? currentQuestion.options[index] : 'Sem resposta' 
    }]);

    if (!showFeedback) {
      setTimeout(handleNext, 600);
    }
  };

  const handleSubmitEssay = () => {
    if (isAnswered) return;
    
    if (essayResponse.trim() === '') {
      setEssayError(true);
      return;
    }
    setEssayError(false);
    
    const endTime = Date.now();
    const duration = Math.round((elapsedBeforePause + (endTime - startTime)) / 1000);
    
    setIsAnswered(true);
    setQuestionDurations(prev => [...prev, { questionText: currentQuestion.text, duration }]);
    setAllResponses(prev => [...prev, { 
      questionId: currentQuestion.id || String(currentIndex), 
      answer: essayResponse
    }]);

    if (!showFeedback) {
      setTimeout(handleNext, 600);
    }
  };

  const handleSkip = () => {
    if (isAnswered) return;
    
    setSkippedQuestionIndices(prev => [...prev, currentIndex]);
    setAllResponses(prev => [...prev, { 
      questionId: currentQuestion.id || String(currentIndex), 
      answer: 'Pulada',
      isSkipped: true
    }]);

    handleNextAction();
  };

  const handleNextAction = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setEssayResponse('');
      setEssayError(false);
      setIsAnswered(false);
      setStartTime(Date.now());
      setElapsedBeforePause(0);
    } else {
      const skippedData = skippedQuestionIndices.concat(
        // Add current index if it was just skipped and not yet in the array due to state update timing
        allResponses.some(r => r.questionId === (currentQuestion.id || String(currentIndex)) && r.isSkipped)
        ? [] : [] // This logic is handled by the state finalization in the useEffect or next turn
      ).map(idx => ({ text: questions[idx].text }));

      // Map unique skipped questions based on final indices
      const finalSkipped = Array.from(new Set([...skippedQuestionIndices])).map(idx => ({ text: questions[idx].text }));
      
      onComplete(score, wrongQuestions, finalSkipped, allResponses, questionDurations);
    }
  };

  const handleNext = () => {
    handleNextAction();
  };

  const saveAndExit = () => {
    if (onSaveProgress) {
      onSaveProgress(currentIndex, score, wrongQuestions, skippedQuestionIndices, allResponses, questionDurations);
    }
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

  if (isPaused) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[40px] max-w-md w-full text-center space-y-8 shadow-2xl flex flex-col items-center justify-center"
        >
          <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <PauseCircle size={48} />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-800">Momento de Pausa</h2>
            <p className="text-slate-500 font-medium">Respire fundo, beba uma água e descanse a mente. O tempo está pausado.</p>
          </div>
          <button 
            onClick={handleResume}
            className="btn-primary w-full py-4 text-lg mt-4 flex items-center justify-center gap-2"
          >
            <PlayCircle size={24} />
            Continuar Desafio
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header Info */}
      <div className={cn("flex items-center justify-between mb-8 transition-opacity duration-500", focusMode && "opacity-20")}>
        <div className="flex items-center gap-4">
          <div className={cn("bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2 transition-all", focusMode && "bg-transparent shadow-none border-transparent")}>
            <Trophy size={18} className="text-yellow-500" />
            <span className="font-bold text-slate-700">{score} pts</span>
          </div>
        </div>
        <div className="text-sm font-bold text-slate-400">
          QUESTÃO {currentIndex + 1} DE {questions.length}
        </div>
        <div className="flex gap-4 items-center">
          <button 
            onClick={handlePause}
            className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1"
            title="Pausar Desafio"
          >
            <PauseCircle size={16} /> Pausar
          </button>
          <button 
            onClick={saveAndExit}
            className="text-xs font-black text-primary uppercase tracking-widest hover:underline"
          >
            Parar e Salvar
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className={cn("w-full h-3 bg-slate-100 rounded-full mb-12 overflow-hidden transition-all", focusMode && "h-1 bg-slate-200")}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn("h-full bg-primary", focusMode && "bg-slate-400")}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-8"
        >
          {isEducatorView && (
            <div className="flex gap-2">
              {(!currentQuestion.contextType || currentQuestion.contextType === 'hyperfocus') && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  🚀 Tema de Interesse
                </span>
              )}
              {currentQuestion.contextType === 'transfer' && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  🌉 Missão de Transferência
                </span>
              )}
              {currentQuestion.contextType === 'neutral' && (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider">
                  🎯 Território Neutro
                </span>
              )}
            </div>
          )}

          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">
            {currentQuestion.text}
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {currentQuestion.type === 'essay' ? (
              <div className="space-y-4">
                <textarea
                  value={essayResponse}
                  onChange={(e) => {
                    setEssayResponse(e.target.value);
                    setEssayError(false);
                  }}
                  disabled={isAnswered}
                  placeholder="Digite sua resposta aqui..."
                  className={cn("input-field min-h-[150px] text-lg p-6 bg-white border-2 rounded-3xl", essayError ? "border-red-300" : "border-slate-100")}
                />
                {essayError && <p className="text-red-500 font-bold ml-2">Por favor, escreva uma resposta antes de enviar.</p>}
                {!isAnswered && (
                  <div className="flex gap-4">
                    <button 
                      onClick={handleSkip}
                      className="btn-secondary flex-1 py-4 text-lg"
                    >
                      Pular Questão
                    </button>
                    <button 
                      onClick={handleSubmitEssay}
                      className="btn-primary flex-2 py-4 text-lg"
                    >
                      Enviar Resposta
                    </button>
                  </div>
                )}
              </div>
            ) : (
              currentQuestion.options.map((option, index) => {
                const isCorrect = index === currentQuestion.correctAnswerIndex;
                const isSelected = index === selectedOption;
                
                let variantClass = "bg-white border-slate-100 hover:border-primary/30";
                if (isAnswered && showFeedback) {
                  if (isCorrect) variantClass = "bg-emerald-50 border-emerald-500 text-emerald-700";
                  else if (isSelected) variantClass = "bg-red-50 border-red-500 text-red-700";
                  else variantClass = "bg-white border-slate-100 opacity-50";
                } else if (isAnswered && !showFeedback && isSelected) {
                  variantClass = "bg-primary/20 border-primary shadow-inner";
                }

                return (
                  <motion.button
                    key={index}
                    animate={
                      isAnswered && showFeedback && isCorrect
                        ? {
                            scale: [1, 1.02, 1],
                            boxShadow: [
                              "0px 0px 0px rgba(16, 185, 129, 0)",
                              "0px 0px 25px rgba(16, 185, 129, 0.6)",
                              "0px 0px 0px rgba(16, 185, 129, 0)",
                            ],
                            transition: { duration: 0.6 }
                          }
                        : isAnswered && showFeedback && isSelected && !isCorrect
                        ? {
                            x: [-8, 8, -8, 8, -4, 4, 0],
                            transition: { duration: 0.5 }
                          }
                        : {}
                    }
                    whileTap={!isAnswered ? { scale: 0.98 } : {}}
                    onClick={() => handleAnswer(index)}
                    disabled={isAnswered}
                    className={cn(
                      "w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center justify-between group",
                      variantClass,
                      !isAnswered && "hover:translate-x-2"
                    )}
                  >
                    <span className="text-lg font-medium">{option}</span>
                    {isAnswered && showFeedback && isCorrect && <CheckCircle2 className="text-emerald-500" />}
                    {isAnswered && showFeedback && isSelected && !isCorrect && <XCircle className="text-red-500" />}
                  </motion.button>
                );
              })
            )}
            
            {!isAnswered && currentQuestion.type !== 'essay' && (
              <button 
                onClick={handleSkip}
                className="text-sm font-bold text-slate-400 hover:text-primary transition-colors text-center py-2 underline"
              >
                Não sei a resposta, quero pular
              </button>
            )}
          </div>

          {isAnswered && showFeedback && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="text-slate-600 leading-relaxed italic prose prose-slate prose-sm max-w-none">
                  <ReactMarkdown>{currentQuestion.explanation}</ReactMarkdown>
                </div>
              </div>

              <button 
                onClick={handleNext}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {currentIndex === questions.length - 1 ? 'Ver Resultado' : 'Próxima Questão'}
                <ArrowRight size={20} />
              </button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
