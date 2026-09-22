import React from 'react';
import { RankingEntry } from '../types';
import { Trophy, Medal, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface LeaderboardProps {
  rankings: RankingEntry[];
}

export default function Leaderboard({ rankings }: LeaderboardProps) {
  const sortedRankings = [...rankings].sort((a, b) => b.xp - a.xp).slice(0, 5);

  return (
    <div className="glass-card p-6 rounded-3xl space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={20} className="text-yellow-500" />
        <h3 className="font-bold text-slate-800">Ranking da Turma</h3>
      </div>

      {sortedRankings.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">
          O ranking aparece assim que as primeiras missões forem concluídas.
        </p>
      ) : (
        <div className="space-y-3">
          {sortedRankings.map((entry, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center justify-between p-3 rounded-2xl ${
                index === 0 ? 'bg-yellow-50 border border-yellow-100' : 'bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center font-bold text-sm">
                  {index === 0 && <Medal size={20} className="text-yellow-500" />}
                  {index === 1 && <Medal size={20} className="text-slate-400" />}
                  {index === 2 && <Medal size={20} className="text-amber-600" />}
                  {index > 2 && <span className="text-slate-400">#{index + 1}</span>}
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm">{entry.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Nível {entry.level}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-primary text-sm">{entry.xp}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">XP</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
