import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../lib/useToast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: <CheckCircle2 className="text-emerald-500" size={20} />,
  error: <AlertCircle className="text-red-500" size={20} />,
  info: <Info className="text-indigo-500" size={20} />,
  warning: <AlertTriangle className="text-amber-500" size={20} />
};

const bgColors = {
  success: 'bg-emerald-50 border-emerald-200',
  error: 'bg-red-50 border-red-200',
  info: 'bg-indigo-50 border-indigo-200',
  warning: 'bg-amber-50 border-amber-200'
};

const textColors = {
  success: 'text-emerald-800',
  error: 'text-red-800',
  info: 'text-indigo-800',
  warning: 'text-amber-800'
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg max-w-sm ${bgColors[toast.type]}`}
          >
            <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
            <div className={`flex-1 text-sm font-medium ${textColors[toast.type]}`}>
              {toast.message}
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className={`shrink-0 opacity-50 hover:opacity-100 transition-opacity ${textColors[toast.type]}`}
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
