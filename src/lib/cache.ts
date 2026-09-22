import { CachedQuiz, QuizConfig, Question } from '../types';

const CACHE_KEY = 'hiperreforco_quiz_cache';
const MAX_CACHE_SIZE = 10;

export const saveQuizToCache = (config: QuizConfig, questions: Question[]) => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    let cache: CachedQuiz[] = cachedData ? JSON.parse(cachedData) : [];

    const newQuiz: CachedQuiz = {
      id: Math.random().toString(36).substring(2, 11),
      config,
      questions,
      timestamp: Date.now(),
    };

    // Add to start of array
    cache = [newQuiz, ...cache];

    // Keep only last MAX_CACHE_SIZE
    if (cache.length > MAX_CACHE_SIZE) {
      cache = cache.slice(0, MAX_CACHE_SIZE);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving quiz to cache:', error);
  }
};

export const getCachedQuizzes = (): CachedQuiz[] => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    return cachedData ? JSON.parse(cachedData) : [];
  } catch (error) {
    console.error('Error getting cached quizzes:', error);
    return [];
  }
};

export const removeQuizFromCache = (id: string) => {
  try {
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (!cachedData) return;
    
    let cache: CachedQuiz[] = JSON.parse(cachedData);
    cache = cache.filter(q => q.id !== id);
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error removing quiz from cache:', error);
  }
};
