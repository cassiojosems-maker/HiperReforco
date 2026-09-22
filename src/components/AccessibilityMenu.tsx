import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Accessibility, X, Type, Palette, Move, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { useAccessibility } from '../contexts/AccessibilityContext';

export default function AccessibilityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    fontSize, setFontSize, 
    contrast, setContrast, 
    spacing, setSpacing, 
    focusMode, setFocusMode,
    resetSettings 
  } = useAccessibility();

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
        aria-label="Menu de Acessibilidade"
      >
        {isOpen ? <X size={28} /> : <Accessibility size={28} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 glass-card p-6 rounded-[32px] shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Accessibility size={20} className="text-primary" />
                Acessibilidade
              </h3>
              <button 
                onClick={resetSettings}
                className="p-2 text-slate-400 hover:text-primary transition-colors"
                title="Resetar Configurações"
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {/* Focus Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-slate-700">
                <EyeOff size={20} className={focusMode ? 'text-primary' : 'text-slate-400'} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Modo Foco</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Reduz distrações visuais</span>
                </div>
              </div>
              <button
                onClick={() => setFocusMode(!focusMode)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  focusMode ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  focusMode ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Font Size */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Type size={14} /> Tamanho da Fonte
              </label>
              <div className="flex gap-2">
                {(['normal', 'large', 'extra-large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      fontSize === size 
                        ? 'bg-primary text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contrast */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Palette size={14} /> Contraste e Cores
              </label>
              <div className="flex gap-2">
                {(['normal', 'high', 'soft'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setContrast(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      contrast === c 
                        ? 'bg-primary text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c === 'normal' ? 'Padrão' : c === 'high' ? 'Alto' : 'Suave'}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacing */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Move size={14} /> Espaçamento (Foco)
              </label>
              <div className="flex gap-2">
                {(['normal', 'relaxed', 'wide'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpacing(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      spacing === s 
                        ? 'bg-primary text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s === 'normal' ? 'Padrão' : s === 'relaxed' ? 'Médio' : 'Amplo'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Dica: O **Modo Foco** e o espaçamento **Amplo** ajudam muito crianças com TDAH a reduzir a sobrecarga visual e manter a concentração!
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
