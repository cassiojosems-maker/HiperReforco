import React, { useState } from 'react';
import logoUrl from '../assets/images/logo.png';
import { ChildProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, User, Star, Plus, ChevronRight, Settings } from 'lucide-react';

interface ProfileSelectorProps {
  profiles: ChildProfile[];
  onSelect: (profileId: string) => void;
  onCreate: (name: string) => void;
}

export default function ProfileSelector({ profiles, onSelect, onCreate }: ProfileSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-32 h-32 bg-white rounded-[40px] p-4 shadow-xl border-4 border-indigo-50 flex items-center justify-center mb-4"
        >
          <img 
            src={logoUrl} 
            alt="Logo HiperReforço" 
            className="w-full h-full object-contain"
          />
        </motion.div>
        <h2 className="text-3xl font-extrabold text-slate-900 font-display">Quem vai brilhar hoje? ✨</h2>
        <p className="text-slate-500">Escolha um perfil para começar a jornada de aprendizado</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {profiles.map((profile) => (
            <motion.button
              key={profile.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(profile.id)}
              className="glass-card p-6 rounded-[32px] border-slate-100 hover:border-primary/30 transition-all group flex flex-col items-center text-center space-y-4"
            >
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden group-hover:shadow-primary/20 transition-all">
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{profile.name}</h3>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-slate-400">Nível {profile.level}</span>
                </div>
              </div>
              <div className="pt-2 w-full">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">
                  <span>Progresso</span>
                  <span>{profile.xp} XP</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(profile.xp % 1000) / 10}%` }}
                  />
                </div>
              </div>
            </motion.button>
          ))}

          {!isCreating ? (
            <motion.button
              key="add-profile"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreating(true)}
              className="glass-card p-6 rounded-[32px] border-dashed border-2 border-slate-200 bg-slate-50/50 hover:bg-white hover:border-primary transition-all flex flex-col items-center justify-center text-center space-y-3 min-h-[220px]"
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                <Plus size={32} />
              </div>
              <div>
                <h3 className="font-bold text-slate-500">Adicionar Perfil</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Para outra criança</p>
              </div>
            </motion.button>
          ) : (
            <motion.div
              key="create-form"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-6 rounded-[32px] border-primary/30 bg-primary/5 space-y-4 min-h-[220px]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-primary">Novo Perfil</h3>
                <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
                  <Settings size={16} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Nome da criança</label>
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Joãozinho"
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-2.5 focus:border-primary focus:outline-none text-sm font-medium"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!newName.trim()}
                  className="w-full btn-primary py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Confirmar
                  <ChevronRight size={14} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
