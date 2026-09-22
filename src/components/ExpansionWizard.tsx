import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Map, ArrowRight, ChevronLeft, Bot, Target, Send, Loader2, Key } from 'lucide-react';
import { generateExpansionReport, generateInterestSurvey, analyzeInterests } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ExpansionForm {
  p1_nameAge: string;
  p2_mainFocus: string;
  p3_intensity: string;
  p4_previousFocus: string;
  p5_secondaryFocus: string;
  p6_dislikes: string;
  p7_learningStyles: string[];
  p8_school: string;
  p9_diagnosis: string;
  p10_challenges: string;
}

const LEARNING_STYLES = [
  { id: 'a', label: 'Vídeos e imagens' },
  { id: 'b', label: 'Histórias e narrativas' },
  { id: 'c', label: 'Experimentos e construções' },
  { id: 'd', label: 'Músicas e ritmos' },
  { id: 'e', label: 'Leitura e escrita' },
  { id: 'f', label: 'Jogos e competições' },
  { id: 'g', label: 'Colecionar e catalogar' },
  { id: 'h', label: 'Outro' }
];

export default function ExpansionWizard({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'welcome' | 'form' | 'loading_survey' | 'survey' | 'loading' | 'result'>('welcome');
  const [form, setForm] = useState<ExpansionForm>({
    p1_nameAge: '',
    p2_mainFocus: '',
    p3_intensity: '',
    p4_previousFocus: '',
    p5_secondaryFocus: '',
    p6_dislikes: '',
    p7_learningStyles: [],
    p8_school: '',
    p9_diagnosis: '',
    p10_challenges: ''
  });
  
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [surveyAnswers, setSurveyAnswers] = useState<string[]>([]);
  const [report, setReport] = useState<string>('');

  const handleStyleToggle = (label: string) => {
    setForm(prev => {
      const styles = prev.p7_learningStyles;
      if (styles.includes(label)) {
        return { ...prev, p7_learningStyles: styles.filter(s => s !== label) };
      }
      return { ...prev, p7_learningStyles: [...styles, label] };
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('loading_survey');
    try {
      const generatedSurvey = await generateInterestSurvey(form.p8_school || 'Ensino Fundamental');
      setSurveyQuestions(generatedSurvey);
      setSurveyAnswers(new Array(generatedSurvey.length).fill(''));
      setStep('survey');
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar questionário de interesses.');
      setStep('form');
    }
  };

  const handleFinishSurvey = async () => {
    setStep('loading');
    try {
      const interestsResult = await analyzeInterests(surveyAnswers);
      const generatedReport = await generateExpansionReport(form);
      
      const finalReport = generatedReport + "\n\n" + 
        "## 🌟 Temas Dinâmicos Sugeridos (Questionário de Interesses)\n\n" +
        (interestsResult.suggestedThemes || []).map((t: any) => `### ${t.icon} ${t.name}\n${t.description}`).join('\n\n');

      setReport(finalReport);
      setStep('result');
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar o relatório final. Verifique a chave de API e tente novamente.');
      setStep('survey');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-bold mb-4"
      >
        <ChevronLeft size={20} />
        Voltar
      </button>

      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-8 sm:p-12 rounded-[40px] text-center space-y-8 border-t-4 border-t-indigo-500 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Map size={120} />
            </div>
            
            <div className="w-24 h-24 bg-indigo-100 rounded-3xl mx-auto flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-100/50 relative z-10">
              <Bot size={48} />
            </div>
            
            <div className="space-y-4 relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display">
                E aí — que tal a gente tentar algo diferente hoje? 🚀
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Tenho aqui um jeito de descobrir novos assuntos que podem combinar super bem com o que a criança já curte.
                São só algumas perguntinhas rápidas e eu monto um <strong className="text-indigo-600">mapa de novos territórios</strong> pra explorar.
              </p>
            </div>

            <div className="pt-4 relative z-10">
              <button 
                onClick={() => setStep('form')}
                className="btn-primary py-4 px-10 text-lg shadow-xl shadow-indigo-200"
              >
                Posso começar?
                <ArrowRight size={24} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 sm:p-10 rounded-[40px]"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500">
                <Target size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Questionário Diagnóstico</h2>
                <p className="text-slate-500 text-sm">Responda as perguntas abaixo para o HIPER mapear novas possibilidades.</p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="space-y-8">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">1. Qual é o nome da criança e quantos anos ela tem?</label>
                <input required value={form.p1_nameAge} onChange={e => setForm({...form, p1_nameAge: e.target.value})} className="input-field w-full" placeholder="Ex: Lucas, 8 anos" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">2. Qual é o hiperfoco PRINCIPAL dela agora? (pode ser um assunto, personagem, jogo, animal, veículo, etc.)</label>
                <input required value={form.p2_mainFocus} onChange={e => setForm({...form, p2_mainFocus: e.target.value})} className="input-field w-full" placeholder="Ex: Minecraft e vulcões" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">3. Há quanto tempo ela se interessa por esse tema? E o quanto ele domina as conversas, brincadeiras ou desenhos?</label>
                <textarea required value={form.p3_intensity} onChange={e => setForm({...form, p3_intensity: e.target.value})} className="input-field w-full min-h-[80px]" placeholder="Ex: Há 6 meses, fala disso o dia todo e só desenha vulcões." />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">4. Já existiu algum hiperfoco ANTERIOR que ela amava e hoje não menciona mais? Qual?</label>
                <input value={form.p4_previousFocus} onChange={e => setForm({...form, p4_previousFocus: e.target.value})} className="input-field w-full" placeholder="Ex: Dinossauros" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">5. Existe algum assunto secundário que ela demonstra interesse, mesmo que bem menor?</label>
                <input value={form.p5_secondaryFocus} onChange={e => setForm({...form, p5_secondaryFocus: e.target.value})} className="input-field w-full" placeholder="Ex: Planetário, astronomia" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">6. O que a criança DEFINITIVAMENTE não gosta ou rejeita? (temas, formatos, situações)</label>
                <textarea value={form.p6_dislikes} onChange={e => setForm({...form, p6_dislikes: e.target.value})} className="input-field w-full min-h-[80px]" placeholder="Ex: Atividades muito longas de escrita e esportes com bola" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">7. Como ela aprende melhor? (Marque quantos quiser)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LEARNING_STYLES.map(style => (
                    <label key={style.id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${form.p7_learningStyles.includes(style.label) ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                        checked={form.p7_learningStyles.includes(style.label)}
                        onChange={() => handleStyleToggle(style.label)}
                      />
                      <span className="font-medium text-slate-700">{style.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">8. Qual é o ano escolar/série da criança? Ela está em escola regular, AEE, escola especial ou ensino domiciliar?</label>
                <input required value={form.p8_school} onChange={e => setForm({...form, p8_school: e.target.value})} className="input-field w-full" placeholder="Ex: 3º ano do Fundamental, escola regular com AEE" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">9. A criança tem diagnóstico confirmado? (TDAH, TEA, Altas Habilidades, outro) — opcional.</label>
                <input value={form.p9_diagnosis} onChange={e => setForm({...form, p9_diagnosis: e.target.value})} className="input-field w-full" placeholder="Ex: TEA nível 1 e TDAH" />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">10. Qual é o maior DESAFIO atual no dia a dia dela relacionado ao hiperfoco?</label>
                <textarea value={form.p10_challenges} onChange={e => setForm({...form, p10_challenges: e.target.value})} className="input-field w-full min-h-[80px]" placeholder="Ex: Frustra-se quando precisa mudar de atividade na escola." />
              </div>

              <div className="pt-6 flex justify-end">
                <button type="submit" className="btn-primary py-4 px-8 text-lg w-full sm:w-auto">
                  <Sparkles size={20} />
                  Avançar para Investigação
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'loading_survey' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-16 rounded-[40px] text-center space-y-6 flex flex-col items-center justify-center min-h-[400px]"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-amber-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-800">Preparando Questionário Personalizado...</h3>
              <p className="text-slate-500">A IA está criando perguntas específicas para o perfil da criança.</p>
            </div>
          </motion.div>
        )}

        {step === 'survey' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 sm:p-10 rounded-[40px]"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-500">
                <Target size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">Investigação de Interesses Secundários</h2>
                <p className="text-slate-500 text-sm">Responda para a IA analisar temas de hiperfoco.</p>
              </div>
            </div>

            <div className="space-y-8">
              {surveyQuestions.map((q, idx) => (
                <div key={idx} className="space-y-4">
                  <h3 className="font-bold text-slate-800">
                    <span className="text-amber-500 mr-2">{idx + 1}.</span> 
                    {q.text}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt: any, optIdx: number) => {
                      const isSelected = surveyAnswers[idx] === opt.category;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => {
                            const newAnswers = [...surveyAnswers];
                            newAnswers[idx] = opt.category;
                            setSurveyAnswers(newAnswers);
                          }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
                            isSelected 
                              ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm' 
                              : 'border-slate-100 hover:border-amber-200 text-slate-700'
                          }`}
                        >
                          <div className="font-medium">{opt.text}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-6 flex justify-end">
                <button 
                  onClick={handleFinishSurvey} 
                  disabled={surveyAnswers.some(a => !a)}
                  className="btn-primary py-4 px-8 text-lg w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bot size={20} />
                  Gerar Relatório Final
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'loading' && (

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-16 rounded-[40px] text-center space-y-6 flex flex-col items-center justify-center min-h-[400px]"
          >
            <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Bot size={32} className="text-indigo-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-800">Processando o Perfil...</h3>
              <p className="text-slate-500">Mapeando interesses e construindo pontes temáticas seguras.</p>
            </div>
          </motion.div>
        )}

        {step === 'result' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 sm:p-10 rounded-[40px] space-y-8"
          >
            <div className="markdown-body">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>

            <div className="pt-8 border-t border-slate-100 flex gap-4 justify-end">
              <button 
                onClick={() => setStep('form')}
                className="btn-secondary py-3 px-6"
              >
                Novo Mapeamento
              </button>
              <button 
                onClick={onBack}
                className="btn-primary py-3 px-6"
              >
                Concluir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
