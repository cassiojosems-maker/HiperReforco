import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Image as ImageIcon, Check, Loader2, Upload, Camera } from 'lucide-react';
import { generateAvatarImage } from '../services/geminiService';

interface AvatarCustomizerProps {
  currentAvatar?: string;
  onSave: (url: string) => void;
  onClose: () => void;
}

const PREDEFINED_AVATARS = [
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Felix',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Luna',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Leo',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Milo',
];

export const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({ currentAvatar, onSave, onClose }) => {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || PREDEFINED_AVATARS[0]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedAvatars, setGeneratedAvatars] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const url = await generateAvatarImage(prompt);
      setGeneratedAvatars(prev => [url, ...prev].slice(0, 4));
      setSelectedAvatar(url);
    } catch (error) {
      alert("Erro ao gerar avatar. Tente outro tema!");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ser menor que 2MB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSelectedAvatar(base64String);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl bg-white rounded-[40px] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-display tracking-tight">Sua Marca no Mundo</h2>
              <p className="text-indigo-100 text-sm font-medium opacity-80">Escolha como você quer ser visto!</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-95">
            <X className="w-8 h-8" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Preview & Upload */}
            <div className="lg:col-span-5 flex flex-col items-center gap-6">
              <div className="relative group">
                <div className="w-48 h-48 rounded-[56px] border-8 border-indigo-50 p-2 bg-white overflow-hidden shadow-xl shadow-indigo-100/50 transition-transform group-hover:rotate-2">
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={selectedAvatar}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      src={selectedAvatar} 
                      alt="Preview Avatar" 
                      className="w-full h-full object-cover rounded-[38px]"
                      referrerPolicy="no-referrer"
                    />
                  </AnimatePresence>
                </div>
                <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl shadow-xl border-4 border-white">
                  <Check className="w-5 h-5 font-bold" />
                </div>
              </div>

              <div className="w-full space-y-4">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-4 px-6 bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-[28px] font-bold flex items-center justify-center gap-3 transition-all active:scale-95 group"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                      Enviar Minha Foto
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">Recomendado: 512x512px (PNG ou JPG)</p>
              </div>
            </div>

            {/* Right Column: AI & Presets */}
            <div className="lg:col-span-7 space-y-8">
              {/* Presets */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Personagens Prontos
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 gap-3">
                  {PREDEFINED_AVATARS.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative rounded-3xl p-1 transition-all aspect-square ${
                        selectedAvatar === url ? 'bg-indigo-600 scale-105 shadow-lg shadow-indigo-200' : 'hover:scale-105 bg-slate-50 border-2 border-transparent hover:border-indigo-100'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${i}`} className="w-full h-full rounded-[20px]" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Section */}
              <div className="bg-slate-50/50 rounded-[40px] p-6 border border-slate-100 space-y-4">
                <h3 className="text-sm font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Criador Mágico (IA)
                </h3>
                <div className="flex flex-col gap-4">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ex: 'Um pirata de pixel art com chapéu de gato', 'Um robô cientista amigável'..."
                    className="w-full p-5 rounded-3xl bg-white border-2 border-transparent focus:border-indigo-400 focus:outline-none text-sm transition-all resize-none shadow-sm font-medium"
                    rows={3}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-[24px] font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-100 active:scale-95"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 fill-current" />
                        Gerar Avatar Exclusivo
                      </>
                    )}
                  </button>
                </div>

                {generatedAvatars.length > 0 && (
                  <div className="flex gap-2 pt-2 px-1 overflow-x-auto pb-2 no-scrollbar">
                    {generatedAvatars.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedAvatar(url)}
                        className={`relative rounded-2xl overflow-hidden shrink-0 w-16 h-16 transition-all ${
                          selectedAvatar === url ? 'ring-4 ring-indigo-600 scale-110' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="Generated" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="p-8 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-10 py-3.5 text-slate-500 font-bold hover:text-slate-700 transition-colors uppercase text-xs tracking-widest"
          >
            Pular / Cancelar
          </button>
          <button
            onClick={() => onSave(selectedAvatar)}
            className="w-full sm:w-auto px-12 py-3.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-[24px] transition-all shadow-xl shadow-green-100 uppercase text-xs tracking-widest active:scale-95"
          >
            Confirmar Avatar ✨
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
