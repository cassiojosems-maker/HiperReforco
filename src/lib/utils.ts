import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getHyperfocusRatio(completedQuizzes: number): number {
  if (completedQuizzes < 10) return 0.8;
  if (completedQuizzes < 20) return 0.7;
  if (completedQuizzes < 30) return 0.6;
  return 0.5;
}

export function calculateStreak(lastPlayed: string | null, currentStreak: number): number {
  if (!lastPlayed) return 1;

  const now = new Date();
  
  // Format dates to YYYY-MM-DD in America/Campo_Grande timezone (UTC-4)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Campo_Grande',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const todayStr = formatter.format(now);
  const lastPlayedStr = formatter.format(new Date(lastPlayed));

  const todayDate = new Date(`${todayStr}T00:00:00`);
  const lastPlayedDate = new Date(`${lastPlayedStr}T00:00:00`);

  const diffTime = todayDate.getTime() - lastPlayedDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  if (diffDays === 0) {
    return currentStreak;
  } else if (diffDays === 1) {
    return currentStreak + 1;
  } else {
    return 1;
  }
}

