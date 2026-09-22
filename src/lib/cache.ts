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
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    
    // Default initial offline items matching screenshot
    const defaultCached: CachedQuiz[] = [
      {
        id: 'offline-fractions',
        config: {
          subject: 'Matemática',
          topic: 'Frações',
          focus: 'Minecraft',
          grade: '7º ano',
          difficulty: 'média',
          count: 5,
          gender: 'masculino'
        },
        questions: [
          {
            id: 'q-f1',
            text: 'Se você tem 1/2 de uma barra de chocolate e come 1/4, quanto resta?',
            options: ['1/4', '1/2', '3/4', '1/8'],
            correctAnswerIndex: 0,
            explanation: '1/2 - 1/4 = 2/4 - 1/4 = 1/4.',
            contextType: 'neutral'
          },
          {
            id: 'q-f2',
            text: 'Qual fração é equivalente a 2/4?',
            options: ['1/2', '1/3', '3/4', '2/3'],
            correctAnswerIndex: 0,
            explanation: 'Simplificando por 2, 2/4 = 1/2.',
            contextType: 'neutral'
          },
          {
            id: 'q-f3',
            text: 'Quanto é 2/3 + 1/3?',
            options: ['1', '3/6', '2/6', '3/9'],
            correctAnswerIndex: 0,
            explanation: '2/3 + 1/3 = 3/3 = 1.',
            contextType: 'neutral'
          },
          {
            id: 'q-f4',
            text: 'Qual é o dobro de 1/4?',
            options: ['1/2', '2/8', '1/8', '1/6'],
            correctAnswerIndex: 0,
            explanation: '2 * (1/4) = 2/4 = 1/2.',
            contextType: 'neutral'
          },
          {
            id: 'q-f5',
            text: 'Qual fração representa metade da metade?',
            options: ['1/4', '1/2', '1/8', '3/4'],
            correctAnswerIndex: 0,
            explanation: '1/2 * 1/2 = 1/4.',
            contextType: 'neutral'
          }
        ],
        timestamp: Date.now() - 3600000
      },
      {
        id: 'offline-integers',
        config: {
          subject: 'Matemática',
          topic: 'Números Inteiros Relativos',
          focus: 'Minecraft',
          grade: '7º ano',
          difficulty: 'média',
          count: 10,
          gender: 'masculino'
        },
        questions: Array.from({ length: 10 }, (_, i) => ({
          id: `q-int-${i + 1}`,
          text: `Calcule a expressão com números inteiros: (-5) + (+${i + 3}) = ?`,
          options: [`${-5 + i + 3}`, `${5 + i + 3}`, `${-5 - (i + 3)}`, '0'],
          correctAnswerIndex: 0,
          explanation: `Somando -5 com +${i + 3} obtemos ${-5 + i + 3}.`,
          contextType: 'neutral'
        })),
        timestamp: Date.now() - 7200000
      }
    ];

    return defaultCached;
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
