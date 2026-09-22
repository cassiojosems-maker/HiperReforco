import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, CheckCircle2, Search, Lightbulb, Smile } from 'lucide-react';
import { InterestQuestion, InterestSurveyResult } from '../types';
import { generateInterestSurvey, analyzeInterests } from '../services/geminiService';
import { cn } from '../lib/utils';

interface InterestSurveyProps {
  grade: string;
  onSelectTheme: (theme: string, gender: string) => void;
  onClose: () => void;
}

export default function InterestSurvey({ grade, onSelectTheme, onClose }: InterestSurveyProps) {
  const [genderStep, setGenderStep] = useState(true);
  const [gender, setGender] = useState<'masculino' | 'feminino' | 'outro' | null>(null);
  const [questions, setQuestions] = useState<InterestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1); // -1 is loading
  const [answers, setAnswers] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<InterestSurveyResult | null>(null);

  useEffect(() => {
    if (!genderStep) {
      async function loadSurvey() {
        // Pass gender to make the survey generation more personalized if needed
        const data = await generateInterestSurvey(grade, gender || 'neutro');
        setQuestions(data);
        setCurrentIndex(0);
      }
      loadSurvey();
    }
  }, [grade, genderStep, gender]);

  const handleAnswer = async (category: string) => {
    const newAnswers = [...answers, category];
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsAnalyzing(true);
      const data = await analyzeInterests(newAnswers);
      setResults(data);
      setIsAnalyzing(false);
    }
  };

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 bg-gradient-to-r from-indigo-600 to-primary text-white relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-yellow-300 fill-yellow-300" size={24} />
              <h2 className="text-2xl font-black font-display tracking-tight">Descobridor de Hiperfoco</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowRight className="rotate-180" />
            </button>
          </div>
          <p className="text-indigo-100 font-medium">Vamos encontrar os temas que mais te encantam!</p>
          
          {genderStep ? null : currentIndex >= 0 && !results && (
            <div className="mt-6 w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${progress}%` }}
                className="h-full bg-yellow-300 rounded-full"
              />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {genderStep ? (
              <motion.div 
                key="gender"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-3 text-center mb-8">
                  <div className="inline-flex p-4 bg-pink-50 rounded-full text-pink-500 mb-2">
                    <Smile size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 leading-tight">
                    Antes de começarmos...
                  </h3>
                  <p className="text-slate-500 font-medium">Como você se identifica?</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(['masculino', 'feminino', 'outro'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setGender(g);
                        setGenderStep(false);
                      }}
                      className="w-full text-center p-6 bg-white border-2 border-slate-100 hover:border-primary/30 hover:bg-primary/5 rounded-[24px] transition-all group"
                    >
                      <span className="text-lg font-bold text-slate-700 uppercase tracking-wide group-hover:text-primary transition-colors">
                        {g}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : currentIndex === -1 ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-64 flex flex-col items-center justify-center space-y-4"
              >
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 font-bold">Preparando perguntas mágicas...</p>
              </motion.div>
            ) : results ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2 mb-8">
                  <div className="inline-flex p-4 bg-emerald-50 rounded-full text-emerald-500 mb-2">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">Encontramos sugestões para você!</h3>
                  <p className="text-slate-500">Com base nas suas respostas, aqui estão os temas que você pode amar:</p>
                </div>

                <div className="grid gap-4">
                  {results.suggestedThemes.map((theme, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectTheme(theme.name, gender || 'neutro')}
                      className="group flex items-start gap-4 p-6 bg-slate-50 hover:bg-primary/5 rounded-[32px] border-2 border-transparent hover:border-primary/20 transition-all text-left"
                    >
                      <div className="text-4xl p-3 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                        {theme.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-slate-800 group-hover:text-primary transition-colors">{theme.name}</h4>
                        <p className="text-slate-500 text-sm leading-relaxed">{theme.description}</p>
                      </div>
                      <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="text-primary" />
                      </div>
                    </button>
                  ))}
                  
                  <button
                    onClick={() => onSelectTheme('Genérico', gender || 'neutro')}
                    className="p-4 text-center text-slate-400 hover:text-slate-600 text-sm font-bold uppercase tracking-widest mt-4 transition-colors"
                  >
                    Nenhum destes, prefiro um tema genérico
                  </button>
                </div>
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div 
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-64 flex flex-col items-center justify-center space-y-6 text-center"
              >
                <div className="relative">
                  <Search size={64} className="text-primary animate-pulse" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-4 border-dashed border-primary/20 rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Analisando suas preferências...</h3>
                  <p className="text-slate-500 max-w-sm">Nossa IA está cruzando seus interesses para encontrar os melhores hiperfocos!</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm">
                    {currentIndex + 1}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-800 leading-tight">
                    {questions[currentIndex].text}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {questions[currentIndex].options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(option.category)}
                      className="w-full text-left p-6 bg-white border-2 border-slate-100 hover:border-primary/30 hover:bg-primary/5 rounded-[24px] transition-all flex items-center justify-between group"
                    >
                      <span className="text-lg font-medium text-slate-700 group-hover:text-primary transition-colors">{option.text}</span>
                      <ArrowRight size={20} className="text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
            <Lightbulb size={18} />
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Responda o que você mais gosta de fazer ou ver. Não existe resposta certa ou errada!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
