import { useState, useEffect, useMemo } from 'react';
import { QuizConfig, Question, UserStats, RankingEntry, Badge, QuizHistoryEntry, LearningTrail, SpecialistComment, SpecialistAssignment, CachedQuiz, ChildProfile, QuizProgress } from './types';
import { generateQuizQuestions, generateRewardQuiz, generateMindMap } from './services/geminiService';
import { auth, db, googleProvider, handleFirestoreError, logFirestoreError, OperationType, hasSpecialistAccess } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, where, deleteDoc } from 'firebase/firestore';
import QuizSetup from './components/QuizSetup';
import hiperreforcoLogo from './assets/images/logo.png';
import QuizGame from './components/QuizGame';
import QuizResult from './components/QuizResult';
import MindMap from './components/MindMap';
import Leaderboard from './components/Leaderboard';
import Dashboard from './components/Dashboard';
import SpecialistArea from './components/SpecialistArea';
import AccessibilityMenu from './components/AccessibilityMenu';
import ProfileSelector from './components/ProfileSelector';
import SupportChat from './components/SupportChat';
import ExpansionWizard from './components/ExpansionWizard';
import LearningSidebar from './components/LearningSidebar';
import ManagementView from './components/ManagementView';
import TeacherMissions from './components/TeacherMissions';
import { AvatarCustomizer } from './components/AvatarCustomizer';
import { useAccessibility } from './contexts/AccessibilityContext';
import { Trophy, Star, Zap, LayoutDashboard, LogIn, LogOut, User as UserIcon, UserCheck, WifiOff, Users, Map, Briefcase, Award, ClipboardCheck } from 'lucide-react';
import { saveQuizToCache, getCachedQuizzes, removeQuizFromCache } from './lib/cache';
import { calculateStreak } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ToastContainer from './components/Toast';
import { showToast } from './lib/useToast';
import { useThrottle } from './lib/useThrottle';
import { updateLeaderboardEntry } from './services/reportService';
import { ErrorBoundary } from './components/ErrorBoundary';

const INITIAL_STATS: UserStats = {
  xp: 0,
  level: 1,
  streak: 0,
  lastPlayed: null,
  totalCorrect: 0,
  totalQuestions: 0,
  history: [],
  badges: [],
  avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Felix',
  role: 'parent',
  profiles: [],
  activeProfileId: null,
  activeTrail: null,
  comments: []
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isSpecialistUser, setIsSpecialistUser] = useState<boolean>(false);
  const [screen, setScreen] = useState<'setup' | 'quiz' | 'result' | 'reward' | 'dashboard' | 'auth' | 'specialist' | 'expansion' | 'management' | 'missions'>('setup');
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [rewardQuestions, setRewardQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [isRewardMode, setIsRewardMode] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<{ text: string; explanation: string }[]>([]);
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [assignments, setAssignments] = useState<SpecialistAssignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [activeAssignment, setActiveAssignment] = useState<SpecialistAssignment | null>(null);
  const [cachedQuizzes, setCachedQuizzes] = useState<CachedQuiz[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [mindMapData, setMindMapData] = useState<any>(null);
  const [showMindMap, setShowMindMap] = useState(false);
  const [lastQuizDurations, setLastQuizDurations] = useState<{ questionText: string; duration: number }[]>([]);
  const [lastSkippedQuestions, setLastSkippedQuestions] = useState<{ text: string }[]>([]);
  const [quizProgress, setQuizProgress] = useState<QuizProgress | null>(null);
  const [lastResponses, setLastResponses] = useState<{ questionId: string; answer: string; isSkipped?: boolean }[]>([]);
  const { focusMode } = useAccessibility();

  // Active child profile and scoped missions for active profile
  const activeProfile = useMemo(() => {
    return stats.profiles?.find(p => p.id === stats.activeProfileId) || null;
  }, [stats.profiles, stats.activeProfileId]);

  const profileAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      if (assignment.status && assignment.status !== 'pending') return false;

      if (stats.activeProfileId) {
        if (assignment.studentId === stats.activeProfileId) return true;
        if ((assignment as any).profileId === stats.activeProfileId) return true;
      }

      if (user && assignment.studentId === user.uid) {
        if (!stats.profiles || stats.profiles.length <= 1) return true;
        if (stats.activeProfileId === stats.profiles[0]?.id) return true;
      }

      return false;
    });
  }, [assignments, stats.activeProfileId, stats.profiles, user]);

  // Auth Listener
  const [showInpiModal, setShowInpiModal] = useState(false);
  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setCachedQuizzes(getCachedQuizzes());
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const isSpecialist = await hasSpecialistAccess(firebaseUser);
          setIsSpecialistUser(isSpecialist);
        } catch (error) {
          console.error("Erro ao verificar Custom Claims de especialista:", error);
          setIsSpecialistUser(false);
        }

        // Load stats from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserStats;
            setStats(prev => ({
              ...prev,
              ...data,
              history: prev.history || [],
              badges: prev.badges || [],
              comments: prev.comments || []
            }));
          } else {
            // Initialize new user in Firestore without subcollection fields
            const { history, badges, comments, ...rootStats } = INITIAL_STATS;
            const newStats = { ...rootStats, uid: firebaseUser.uid, email: firebaseUser.email, role: 'parent' };
            setDoc(userDocRef, newStats);
          }
        }, (error) => {
          logFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          showToast('A sincronização do perfil falhou. Seus dados locais continuam disponíveis.', 'warning');
        });

        // Load history for rankings or other purposes if needed
        const historyRef = collection(db, 'users', firebaseUser.uid, 'history');
        const q = query(historyRef, orderBy('date', 'desc'), limit(10));
        onSnapshot(q, (snapshot) => {
          const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizHistoryEntry));
          setStats(prev => ({ ...prev, history }));
        }, (error) => {
          logFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}/history`);
          showToast('A sincronização do histórico falhou. Seus dados locais continuam disponíveis.', 'warning');
        });

        // Load badges
        const badgesRef = collection(db, 'users', firebaseUser.uid, 'badges');
        onSnapshot(badgesRef, (snapshot) => {
          const badges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Badge));
          setStats(prev => ({ ...prev, badges }));
        }, (error) => {
          logFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}/badges`);
          showToast('A sincronização de conquistas falhou. Seus dados locais continuam disponíveis.', 'warning');
        });

        // Load comments
        const commentsRef = collection(db, 'users', firebaseUser.uid, 'comments');
        const commentsQuery = query(commentsRef, orderBy('date', 'desc'));
        onSnapshot(commentsQuery, (snapshot) => {
          const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpecialistComment));
          setStats(prev => ({ ...prev, comments }));
        }, (error) => {
          logFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}/comments`);
          showToast('A sincronização de orientações falhou. Seus dados locais continuam disponíveis.', 'warning');
        });

        // Load active trail
        const trailsRef = collection(db, 'users', firebaseUser.uid, 'trails');
        const activeTrailQuery = query(trailsRef, where('status', '==', 'active'), limit(1));
        onSnapshot(activeTrailQuery, (snapshot) => {
          if (!snapshot.empty) {
            const trail = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LearningTrail;
            setStats(prev => ({ ...prev, activeTrail: trail }));
          } else {
            setStats(prev => ({ ...prev, activeTrail: null }));
          }
        }, (error) => {
          logFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}/trails`);
          showToast('A sincronização de trilhas falhou. Seus dados locais continuam disponíveis.', 'warning');
        });

        // Load assignments
        const assignmentsRef = collection(db, 'users', firebaseUser.uid, 'assignments');
        const assignmentsQuery = query(assignmentsRef, where('status', '==', 'pending'));
        onSnapshot(assignmentsQuery, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpecialistAssignment));
          setAssignments(docs);
          setIsLoadingAssignments(false);
        }, (err) => {
          console.error("Erro ao carregar atribuições:", err);
          setIsLoadingAssignments(false);
        });

        // Load quiz progress (drafts)
        const progressRef = collection(db, 'users', firebaseUser.uid, 'progress');
        onSnapshot(progressRef, (snapshot) => {
          if (!snapshot.empty) {
            setQuizProgress(snapshot.docs[0].data() as QuizProgress);
          } else {
            setQuizProgress(null);
          }
        });

        // Load materials
        const materialsRef = collection(db, 'users', firebaseUser.uid, 'materials');
        const materialsQuery = query(materialsRef, orderBy('uploadedAt', 'desc'));
        onSnapshot(materialsQuery, (snapshot) => {
          const materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          setStats(prev => ({ ...prev, materials }));
        });

        // Load leaderboard
        const leaderboardRef = collection(db, 'leaderboard');
        const leaderboardQuery = query(leaderboardRef, orderBy('xp', 'desc'), limit(10));
        onSnapshot(leaderboardQuery, (snapshot) => {
          const rankingsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              name: data.name,
              xp: data.xp,
              level: data.level
            };
          });
          setRankings(rankingsData);
        });
      } else {
        setIsSpecialistUser(false);
        setStats(INITIAL_STATS);
        setAssignments([]);
        setIsLoadingAssignments(false);
        setScreen('auth');
      }
    });
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user && !sessionStorage.getItem('inpi_shown')) {
      setShowInpiModal(true);
    }
  }, [user]);

  const handleSaveAvatar = async (url: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { avatarUrl: url });
      setStats(prev => ({ ...prev, avatarUrl: url }));
      setShowAvatarCustomizer(false);
    } catch (error) {
      console.error("Error saving avatar:", error);
    }
  };

  const handleLogin = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred?.user) {
        try {
          await cred.user.getIdToken(true);
          const hasAccess = await hasSpecialistAccess(cred.user);
          setIsSpecialistUser(hasAccess);
        } catch (claimsErr) {
          console.error("Erro ao obter claims de autenticação:", claimsErr);
        }
      }
      setScreen('setup');
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
        // Usuário fechou a janela de login antes de concluir
        return;
      }
      if (error?.code === 'auth/popup-blocked') {
        showToast('O pop-up de login foi bloqueado pelo navegador. Por favor, autorize pop-ups para fazer login.', 'error');
        return;
      }
      console.error("Login error:", error);
      showToast('Ocorreu um erro ao tentar fazer login com o Google.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsSpecialistUser(false);
      setStats(INITIAL_STATS);
      setAssignments([]);
      setIsLoadingAssignments(false);
      setScreen('auth');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSelectProfile = async (profileId: string) => {
    if (!user) return;
    const profile = stats.profiles?.find(p => p.id === profileId);
    if (profile) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { activeProfileId: profileId });
      setStats(prev => ({
        ...prev,
        activeProfileId: profileId,
        xp: profile.xp,
        level: profile.level,
        streak: profile.streak,
        lastPlayed: profile.lastPlayed,
        totalCorrect: profile.totalCorrect,
        totalQuestions: profile.totalQuestions,
        activeTrail: profile.activeTrail,
        avatarUrl: profile.avatarUrl,
        gender: profile.gender
      }));
    }
  };

  const handleCreateProfile = async (name: string) => {
    if (!user) return;
    const newProfile: ChildProfile = {
      id: Math.random().toString(36).substring(7),
      name,
      avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${name}${Date.now()}`,
      xp: 0,
      level: 1,
      streak: 0,
      lastPlayed: null,
      totalCorrect: 0,
      totalQuestions: 0,
      activeTrail: null
    };

    const updatedProfiles = [...(stats.profiles || []), newProfile];
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { profiles: updatedProfiles });
    setStats(prev => ({ ...prev, profiles: updatedProfiles }));
  };

  const handleSwitchProfile = () => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { activeProfileId: null });
    setStats(prev => ({ ...prev, activeProfileId: null }));
  };

  const handleStartTrail = async (trail: LearningTrail) => {
    if (!user) return;
    try {
      const trailRef = doc(db, 'users', user.uid, 'trails', trail.id);
      await setDoc(trailRef, trail);
      setStats(prev => ({ ...prev, activeTrail: trail }));
      // Start the first quiz of the trail
      handleStartQuiz({
        subject: trail.subject,
        topic: trail.topic,
        focus: trail.focus,
        grade: trail.grade, // Should be dynamic
        difficulty: 'baixa',
        count: 5
      });
    } catch (error) {
      console.error("Error starting trail:", error);
    }
  };

  const handleDeleteTrail = async () => {
    if (!user || !stats.activeTrail) return;
    try {
      const trailRef = doc(db, 'users', user.uid, 'trails', stats.activeTrail.id);
      await deleteDoc(trailRef);
      setStats(prev => ({ ...prev, activeTrail: null }));
    } catch (error) {
      console.error("Error deleting trail:", error);
    }
  };

  const handleContinueTrail = () => {
    if (!stats.activeTrail) return;
    handleStartQuiz({
      subject: stats.activeTrail.subject,
      topic: stats.activeTrail.topic,
      focus: stats.activeTrail.focus,
      grade: stats.activeTrail.grade, // Should be dynamic
      difficulty: 'média',
      count: 5
    });
  };

  const handleDeleteHistoryEntry = async (entryId: string) => {
    if (!user) return;
    try {
      const entryRef = doc(db, 'users', user.uid, 'history', entryId);
      await deleteDoc(entryRef);
    } catch (error) {
      console.error("Error deleting history entry:", error);
    }
  };

  const handleStartCachedQuiz = (cachedQuiz: CachedQuiz) => {
    setConfig(cachedQuiz.config);
    setQuestions(cachedQuiz.questions);
    setQuizProgress(null); // Clear any partial progress when starting a new cached one
    setScreen('quiz');
  };

  const handleDeleteCachedQuiz = (quizId: string) => {
    removeQuizFromCache(quizId);
    setCachedQuizzes(getCachedQuizzes());
  };

  const handleContinueQuizProgress = () => {
    if (!quizProgress) return;
    setConfig(quizProgress.config);
    setQuestions(quizProgress.questions);
    setScreen('quiz');
  };

  const handleSaveQuizProgress = async (
    currentIndex: number, 
    score: number, 
    wrongQuestions: any[], 
    skippedIndices: number[], 
    responses: any[], 
    durations: any[]
  ) => {
    if (!user || !config || !questions.length) return;
    
    try {
      const progress: QuizProgress = {
        userId: user.uid,
        profileId: stats.activeProfileId || 'default',
        config,
        questions,
        currentIndex,
        score,
        wrongQuestions,
        skippedQuestionIndices: skippedIndices,
        responses,
        durations,
        lastUpdated: new Date().toISOString()
      };
      
      const progressRef = doc(db, 'users', user.uid, 'progress', 'current');
      await setDoc(progressRef, progress);
      
      showToast("Progresso salvo! Você pode continuar de onde parou depois.", "success");
      resetQuiz();
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  };

  const handleArchiveHistoryEntry = async (entryId: string, archive: boolean) => {
    if (!user) return;
    try {
      const entryRef = doc(db, 'users', user.uid, 'history', entryId);
      await updateDoc(entryRef, { isArchived: archive });
    } catch (error) {
      console.error("Error archiving entry:", error);
    }
  };

  const handleStartSimulado = () => {
    if (!config) return;
    handleStartQuiz({
      ...config,
      focus: 'Genérico'
    });
  };

  const handleStartQuiz = useThrottle(async (quizConfig: QuizConfig) => {
    setIsLoading(true);
    setConfig(quizConfig);
    try {
      const completedQuizzes = stats.history?.length || 0;
      const response = await generateQuizQuestions(quizConfig, quizConfig.gender, completedQuizzes);
      setQuestions(response.questions);
      
      // Save to offline cache
      saveQuizToCache(quizConfig, response.questions);
      setCachedQuizzes(getCachedQuizzes());
      
      setScreen('quiz');
    } catch (error) {
      console.error("Quiz generation error:", error);
      const errorStr = String(error instanceof Error ? error.message : error);
      
      if (errorStr.includes("503") || errorStr.includes("high demand") || errorStr.includes("UNAVAILABLE")) {
        showToast("Ops! Os servidores de inteligência artificial estão muito lotados neste exato segundo (Alta Demanda). Aguarde alguns segundos e tente novamente!", "warning", 6000);
      } else if (errorStr.includes("API_KEY_INVALID") || errorStr.includes("API key not valid")) {
        showToast("CHAVE INVÁLIDA: O Google informou que a sua chave do Gemini não é válida ou expirou. Por favor, gere uma nova chave em https://aistudio.google.com/app/apikey e atualize nas configurações (Secrets).", "error", 8000);
      } else {
        showToast("ERRO DE API: " + errorStr, "error", 6000);
      }
    } finally {
      setIsLoading(false);
    }
  }, 3000);

  const handleQuizComplete = async (
    finalScore: number, 
    wrongQs: { text: string; explanation: string }[], 
    skippedQs: { text: string }[], 
    responses?: { questionId: string; answer: string; isSkipped?: boolean }[], 
    durations?: { questionText: string; duration: number }[]
  ) => {
    if (isRewardMode) {
      setScreen('setup');
      setIsRewardMode(false);
      return;
    }

    setScore(finalScore);
    setWrongQuestions(wrongQs);
    setLastSkippedQuestions(skippedQs);
    if (responses) setLastResponses(responses);
    if (durations) setLastQuizDurations(durations);

    const xpEarned = finalScore * 100 + (config?.difficulty === 'alta' ? 50 : config?.difficulty === 'média' ? 25 : 0);
    
    const newXp = stats.xp + xpEarned;
    const newLevel = Math.floor(newXp / 1000) + 1;
    
    let neutralErrors = 0;
    let totalNeutral = 0;
    
    questions.forEach(q => {
      if (q.contextType === 'neutral' || q.contextType === 'transfer') {
        totalNeutral++;
        if (wrongQs.some(wq => wq.text === q.text)) {
          neutralErrors++;
        }
      }
    });

    // Handle R4 Alert creation if errors >= 50%
    const newAlerts = [...(stats.r4Alerts || [])];
    if (neutralErrors >= 2) {
      newAlerts.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        subject: config?.subject || '',
        topic: config?.topic || '',
        reviewed: false,
        neutralErrors,
        totalNeutral
      });
    }

    // Badges logic
    const newBadges: Badge[] = [];
    if (finalScore === questions.length && !stats.badges.find(b => b.id === 'perfect')) {
      newBadges.push({
        id: 'perfect',
        badgeId: 'perfect',
        name: 'Gênio Imbatível',
        description: 'Acertou todas as questões de um quiz!',
        icon: '🧠',
        unlockedAt: new Date().toISOString()
      });
    }

    const historyEntry = {
      date: new Date().toISOString(),
      subject: config?.subject || '',
      topic: config?.topic || '',
      focus: config?.focus || '',
      score: finalScore,
      total: questions.length,
      grade: config?.grade || '',
      wrongQuestions: wrongQs,
      skippedQuestions: skippedQs,
      questionDurations: durations || [],
      questions: questions,
      responses: responses || [],
      userId: user?.uid,
      isArchived: false,
      neutralErrors,
      totalNeutral
    };
    
    // Persist to Firestore
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        
        // Delete progress draft upon completion
        const progressRef = doc(db, 'users', user.uid, 'progress', 'current');
        await deleteDoc(progressRef);
        // Update trail progress if active
        let updatedTrail = stats.activeTrail;
        if (updatedTrail && updatedTrail.status === 'active') {
          updatedTrail = {
            ...updatedTrail,
            currentStep: Math.min(updatedTrail.currentStep + 1, updatedTrail.totalSteps),
            status: updatedTrail.currentStep + 1 >= updatedTrail.totalSteps ? 'completed' : 'active'
          };
          
          if (updatedTrail.status === 'completed') {
            newBadges.push({
              id: `trail-${updatedTrail.id}`,
              badgeId: `trail-${updatedTrail.id}`,
              name: `Mestre da Trilha: ${updatedTrail.topic}`,
              description: `Completou a trilha de ${updatedTrail.topic}!`,
              icon: '🏆',
              unlockedAt: new Date().toISOString()
            });
          }
          
          const trailRef = doc(db, 'users', user.uid, 'trails', updatedTrail.id);
          await setDoc(trailRef, updatedTrail);
        }

        // Update profiles array if activeProfileId exists
        const lastPlayedDateStr = new Date().toISOString();
        const newStreak = calculateStreak(stats.lastPlayed, stats.streak);
        
        const updatedProfiles = stats.profiles?.map(p => {
          if (p.id === stats.activeProfileId) {
            const pStreak = calculateStreak(p.lastPlayed, p.streak);
            return {
              ...p,
              xp: newXp,
              level: newLevel,
              streak: pStreak,
              totalCorrect: p.totalCorrect + finalScore,
              totalQuestions: p.totalQuestions + questions.length,
              lastPlayed: lastPlayedDateStr,
              activeTrail: updatedTrail
            };
          }
          return p;
        });

        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          profiles: updatedProfiles,
          activeProfileId: stats.activeProfileId,
          xp: newXp,
          level: newLevel,
          streak: newStreak,
          lastPlayed: lastPlayedDateStr,
          totalCorrect: stats.totalCorrect + finalScore,
          totalQuestions: stats.totalQuestions + questions.length,
          avatarUrl: stats.avatarUrl,
          gender: stats.gender,
          activeTrail: updatedTrail,
          r4Alerts: newAlerts
        }, { merge: true });

        const historyRef = collection(db, 'users', user.uid, 'history');
        await addDoc(historyRef, historyEntry);

        for (const badge of newBadges) {
          const badgeRef = doc(db, 'users', user.uid, 'badges', badge.id);
          await setDoc(badgeRef, { ...badge, userId: user.uid });
        }

        // Update leaderboard using the active profile's info
        const activeProfile = updatedProfiles?.find(p => p.id === stats.activeProfileId);
        if (activeProfile) {
          await updateLeaderboardEntry({
            userId: user.uid,
            name: activeProfile.name,
            xp: activeProfile.xp,
            level: activeProfile.level,
            avatarUrl: activeProfile.avatarUrl
          });
        }

      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'users');
      }
    }

    setScreen('result');
  };

  const handleContinue = async (upgrade: boolean) => {
    if (!config) return;
    
    let nextDifficulty = config.difficulty;
    if (upgrade) {
      if (config.difficulty === 'baixa') nextDifficulty = 'média';
      else if (config.difficulty === 'média') nextDifficulty = 'alta';
    }

    const nextConfig = { ...config, difficulty: nextDifficulty };
    handleStartQuiz(nextConfig);
  };

  const handleClaimReward = async () => {
    if (!config) return;
    setIsLoading(true);
    try {
      const reward = await generateRewardQuiz(config.focus, config.grade);
      setRewardQuestions(reward);
      setIsRewardMode(true);
      setScreen('quiz');
    } catch (error) {
      showToast("Erro ao gerar seu prêmio. Tente novamente!", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMindMap = async () => {
    if (!config) return;
    setIsLoading(true);
    try {
      const data = await generateMindMap(config.subject, config.topic, wrongQuestions);
      setMindMapData(data);
      setShowMindMap(true);
    } catch (error) {
      console.error("Error generating mind map:", error);
      showToast("Houve um probleminha ao gerar o mapa mental. Tente novamente!", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetQuiz = () => {
    setScreen('setup');
    setQuestions([]);
    setRewardQuestions([]);
    setScore(0);
    setIsRewardMode(false);
    setActiveAssignment(null);
  };

  const handleStartAssignment = (assignment: SpecialistAssignment) => {
    setActiveAssignment(assignment);
    setQuestions(assignment.questions);
    setScreen('quiz');
  };

  const handleAssignmentComplete = async (score: number, wrong: any[], responses: { questionId: string; answer: string }[]) => {
    if (!user || !activeAssignment) return;
    
    try {
      const assignmentRef = doc(db, 'users', user.uid, 'assignments', activeAssignment.id);
      await updateDoc(assignmentRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        studentResponses: responses
      });
      
      const userRef = doc(db, 'users', user.uid);
      const xpGain = 500;
      const newTotalXp = stats.xp + xpGain;
      const targetProfileId = activeAssignment.studentId || stats.activeProfileId;

      const updatedProfiles = stats.profiles?.map(p => {
        if (p.id === targetProfileId || (!targetProfileId && p.id === stats.activeProfileId)) {
          const profileXp = (p.xp || 0) + xpGain;
          const profileLevel = Math.floor(profileXp / 1000) + 1;
          return {
            ...p,
            xp: profileXp,
            level: profileLevel
          };
        }
        return p;
      }) || stats.profiles || [];

      await updateDoc(userRef, {
        xp: newTotalXp,
        profiles: updatedProfiles
      });

      const activeProfile = updatedProfiles.find(p => p.id === targetProfileId || p.id === stats.activeProfileId);
      if (activeProfile) {
        await updateLeaderboardEntry({
          userId: user.uid,
          name: activeProfile.name,
          xp: activeProfile.xp,
          level: activeProfile.level,
          avatarUrl: activeProfile.avatarUrl
        });
      }

      showToast(`Missão Finalizada! Você ganhou ${xpGain} XP extra pela atividade do professor!`, "success");
      
    } catch (error) {
      console.error("Error finalizing assignment", error);
    } finally {
      setActiveAssignment(null);
      setScreen('dashboard');
      setQuestions([]);
    }
  };

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-background pb-12 transition-all duration-1000 ${focusMode ? 'focus-mode-active' : ''}`}>
        {/* Top Navigation / Stats Bar */}
      <header className={`sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 transition-all duration-1000 ${focusMode ? 'py-1 opacity-20 hover:opacity-100' : ''}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ 
                scale: 1.1,
                rotate: [0, -10, 10, -10, 0],
              }}
              whileTap={{ scale: 0.9 }}
              className="relative cursor-pointer group"
              onClick={resetQuiz}
            >
              <div className="absolute inset-0 bg-indigo-400 blur-lg rounded-full opacity-0 group-hover:opacity-20 transition-opacity" />
              <img 
                src={hiperreforcoLogo} 
                alt="HiperReforço Logo" 
                className="w-12 h-12 object-contain relative z-10"
              />
            </motion.div>
            <div className="hidden sm:flex flex-col">
              <span className="font-display font-black text-xl leading-tight text-slate-800 tracking-tight">HiperReforço</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Conhecimento em Evolução</span>
            </div>
            {isOffline && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100 ml-2 animate-pulse">
                <WifiOff size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Modo Offline</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {user && (
              <>
                {stats.activeProfileId && (
                  <button 
                    onClick={handleSwitchProfile}
                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
                    title="Trocar Perfil"
                  >
                    <Users size={18} />
                    <span className="hidden md:inline">Trocar Perfil</span>
                  </button>
                )}
                
                <button 
                  onClick={() => setScreen('dashboard')}
                  className={`flex items-center gap-2 text-sm font-bold transition-colors ${screen === 'dashboard' ? 'text-primary' : 'text-slate-500 hover:text-primary'}`}
                >
                  <LayoutDashboard size={18} />
                  <span className="hidden md:inline">Painel</span>
                </button>
                
                <button 
                  onClick={() => setScreen('expansion')}
                  className={`flex items-center gap-2 text-sm font-bold transition-colors ${screen === 'expansion' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                  title="Expansão de Hiperfocos"
                >
                  <Map size={18} />
                  <span className="hidden md:inline">Expansão</span>
                </button>

                <button 
                  onClick={() => setScreen('missions')}
                  className={`flex items-center gap-2 text-sm font-bold transition-colors ${screen === 'missions' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                  title="Missões do Professor"
                >
                  <ClipboardCheck size={18} />
                  <span className="hidden md:inline">Missões</span>
                  {profileAssignments.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full animate-pulse">
                      {profileAssignments.length}
                    </span>
                  )}
                </button>

                {isSpecialistUser && (
                  <>
                    <button 
                      onClick={() => setScreen(screen === 'specialist' ? 'setup' : 'specialist')}
                      className={`flex items-center gap-2 text-sm font-bold transition-colors ${screen === 'specialist' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                      title={screen === 'specialist' ? 'Voltar para Início' : 'Área do Especialista'}
                    >
                      <UserCheck size={18} />
                      <span className="hidden md:inline">Especialista</span>
                    </button>

                    <button 
                      onClick={() => setScreen(screen === 'management' ? 'setup' : 'management')}
                      className={`flex items-center gap-2 text-sm font-bold transition-colors ${screen === 'management' ? 'text-amber-500' : 'text-slate-500 hover:text-amber-500'}`}
                      title="Visão de Gestão"
                    >
                      <Briefcase size={18} />
                      <span className="hidden md:inline">Gestão</span>
                    </button>
                  </>
                )}
                
                <div className="h-8 w-[1px] bg-slate-100" />
                
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="hidden md:inline">Sair</span>
                </button>
              </>
            )}
            
            {!user && screen !== 'auth' && (
              <button 
                onClick={() => setScreen('auth')}
                className="btn-primary py-2 px-4 text-xs"
              >
                Entrar
              </button>
            )}
            
            <div className="h-8 w-[1px] bg-slate-100" />
            
            <div className={`flex items-center gap-6 transition-all duration-700 ${focusMode || !stats.activeProfileId ? 'hide-focus' : ''}`}>
              {user && stats.activeProfileId && (
                <button 
                  onClick={() => setShowAvatarCustomizer(true)}
                  className="relative group focus:outline-none"
                >
                  <div className="w-12 h-12 rounded-full border-4 border-white shadow-md overflow-hidden group-hover:scale-105 transition-transform">
                    <img 
                      src={stats.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.uid}`} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <LayoutDashboard size={10} />
                  </div>
                </button>
              )}
              
              {stats.activeProfileId && (
                <>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                      <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      Nível {stats.level}
                    </div>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${(stats.xp % 1000) / 10}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="h-8 w-[1px] bg-slate-100" />
                  
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                    <Trophy size={16} className="text-primary" />
                    <span className="text-sm font-black text-slate-700">{stats.xp} XP</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {(screen === 'setup' || screen === 'missions') && !focusMode && user && stats.activeProfileId && (
          <div className="hidden lg:block lg:col-span-4">
            <LearningSidebar 
              activeTrail={stats.activeTrail}
              onStartTrail={handleStartTrail}
              onContinueTrail={handleContinueTrail}
              onDeleteTrail={handleDeleteTrail}
              cachedQuizzes={cachedQuizzes}
              onStartCachedQuiz={handleStartCachedQuiz}
              onDeleteCachedQuiz={handleDeleteCachedQuiz}
              isOffline={isOffline}
              onNavigate={(target) => setScreen(target)}
              onSwitchProfile={handleSwitchProfile}
              onLogout={handleLogout}
              pendingMissionsCount={profileAssignments.length}
              currentScreen={screen}
            />
          </div>
        )}
        <div className={(screen === 'setup' || screen === 'missions' || screen === 'auth') && !focusMode ? (user && stats.activeProfileId ? 'lg:col-span-8' : 'lg:col-span-12') : 'lg:col-span-12'}>
          <AnimatePresence mode="wait">
            {screen === 'auth' && (
              <motion.div 
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="max-w-md mx-auto mt-12 text-center space-y-8"
              >
                <div className="glass-card p-10 rounded-[40px] space-y-6">
                  <motion.div 
                    initial={{ rotate: -10, scale: 0.9 }}
                    animate={{ rotate: 0, scale: 1 }}
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    className="w-56 h-56 bg-white rounded-[40px] flex items-center justify-center shadow-xl shadow-indigo-100 mx-auto p-4 border border-indigo-50"
                  >
                    <img 
                      src={hiperreforcoLogo} 
                      alt="HiperReforço Logo" 
                      className="w-full h-full object-contain"
                    />
                  </motion.div>
                  <h2 className="text-3xl font-bold text-slate-900">Bem-vindo ao HiperReforço</h2>
                  <p className="text-slate-500">Faça login para salvar seu progresso, ganhar medalhas e liberar prêmios!</p>
                  <button 
                    onClick={handleLogin}
                    className="btn-primary w-full flex items-center justify-center gap-3 py-4"
                  >
                    <LogIn size={20} />
                    Entrar com Google
                  </button>
                </div>
              </motion.div>
            )}
            {user && !stats.activeProfileId && screen !== 'auth' && (
              <motion.div
                key="profiles"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <ProfileSelector 
                  profiles={stats.profiles || []} 
                  onSelect={handleSelectProfile}
                  onCreate={handleCreateProfile}
                />
              </motion.div>
            )}
            {screen === 'setup' && stats.activeProfileId && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {quizProgress && (
                  <div className="mb-6 glass-card p-6 border-2 border-primary/20 bg-primary/5 rounded-[32px] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-primary uppercase tracking-widest mb-1">Continuidade de Estudo</div>
                      <div className="text-slate-800 font-bold">Você parou em {quizProgress.currentIndex + 1} de {quizProgress.questions.length} no tema "{quizProgress.config.topic}"</div>
                    </div>
                    <button 
                      onClick={handleContinueQuizProgress}
                      className="btn-primary py-3 px-6 text-sm"
                    >
                      Continuar Agora
                    </button>
                  </div>
                )}
                <QuizSetup 
                  onStart={handleStartQuiz} 
                  isLoading={isLoading} 
                  activeTrail={stats.activeTrail || null}
                  onStartTrail={handleStartTrail}
                  onDeleteTrail={handleDeleteTrail}
                  assignments={assignments}
                  onStartAssignment={handleStartAssignment}
                  cachedQuizzes={cachedQuizzes}
                  onStartCachedQuiz={handleStartCachedQuiz}
                  defaultGender={stats.gender}
                  completedQuizzes={stats.history?.length || 0}
                />
              </motion.div>
            )}
            {screen === 'quiz' && (
              <ErrorBoundary>
                <motion.div
                  key={isRewardMode ? 'reward' : 'quiz'}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                >
                  <QuizGame 
                    questions={isRewardMode ? rewardQuestions : questions} 
                    initialState={quizProgress && !isRewardMode ? {
                      currentIndex: quizProgress.currentIndex,
                      score: quizProgress.score,
                      wrongQuestions: quizProgress.wrongQuestions,
                      skippedQuestionIndices: quizProgress.skippedQuestionIndices,
                      responses: quizProgress.responses,
                      durations: quizProgress.durations
                    } : undefined}
                    onSaveProgress={handleSaveQuizProgress}
                    onComplete={(score, wrong, skipped, resp, durations) => {
                      if (activeAssignment) {
                        handleAssignmentComplete(score, wrong, resp || []);
                      } else {
                        handleQuizComplete(score, wrong, skipped, resp, durations);
                      }
                    }}
                    showFeedback={!activeAssignment}
                  />
                </motion.div>
              </ErrorBoundary>
            )}
            {screen === 'result' && (
              <ErrorBoundary>
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                >
                  <QuizResult 
                    score={score}
                    total={questions.length}
                    xpEarned={score * 100}
                    stats={stats}
                    onRestart={() => setScreen('quiz')}
                    onHome={resetQuiz}
                    onClaimReward={handleClaimReward}
                    onContinue={handleContinue}
                    onGenerateMindMap={handleGenerateMindMap}
                    hasReward={!isRewardMode}
                    currentFocus={config?.focus}
                    onStartSimulado={handleStartSimulado}
                    wrongQuestions={wrongQuestions}
                    skippedQuestions={lastSkippedQuestions}
                    questionDurations={lastQuizDurations}
                    questions={questions}
                    lastResponses={lastResponses}
                  />
                </motion.div>
              </ErrorBoundary>
            )}
            {showMindMap && mindMapData && (
              <MindMap 
                data={mindMapData} 
                topic={config?.topic || 'Sua Matéria'} 
                onBack={() => setShowMindMap(false)} 
              />
            )}
            {screen === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.5, ease: "anticipate" }}
              >
                <Dashboard 
                  stats={stats}
                  assignments={assignments}
                  onStartAssignment={handleStartAssignment}
                  onClose={() => setScreen('setup')}
                  onDeleteHistoryEntry={handleDeleteHistoryEntry}
                  onArchiveHistoryEntry={handleArchiveHistoryEntry}
                />
              </motion.div>
            )}
            {screen === 'specialist' && (
              isSpecialistUser ? (
                <motion.div
                  key="specialist"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{ duration: 0.5 }}
                >
                  <SpecialistArea 
                    onClose={() => setScreen('setup')}
                    specialistId={user?.uid || ''}
                    specialistName={user?.displayName || 'Especialista'}
                    user={user}
                    profiles={stats.profiles || []}
                    ownerUid={user?.uid || ''}
                  />
                </motion.div>
              ) : (
                <div className="max-w-md mx-auto text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserCheck size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h3>
                  <p className="text-slate-500 text-sm mb-6">
                    A Área do Especialista requer autorização administrativa via credencial segura (Custom Claim).
                  </p>
                  <button 
                    onClick={() => setScreen('setup')}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-opacity-90 transition-all"
                  >
                    Voltar ao Início
                  </button>
                </div>
              )
            )}

            {screen === 'management' && (
              isSpecialistUser ? (
                <motion.div
                  key="management"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                >
                  <ManagementView onClose={() => setScreen('dashboard')} user={user} />
                </motion.div>
              ) : (
                <div className="max-w-md mx-auto text-center py-16 px-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h3>
                  <p className="text-slate-500 text-sm mb-6">
                    A Visão de Gestão requer autorização administrativa via credencial segura (Custom Claim).
                  </p>
                  <button 
                    onClick={() => setScreen('setup')}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-opacity-90 transition-all"
                  >
                    Voltar ao Início
                  </button>
                </div>
              )
            )}

            {screen === 'expansion' && (
              <motion.div
                key="expansion"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
              >
                <ExpansionWizard onBack={() => setScreen('setup')} />
              </motion.div>
            )}

            {screen === 'missions' && (
              <motion.div
                key="missions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.4 }}
              >
                <TeacherMissions 
                  assignments={profileAssignments}
                  isLoading={isLoadingAssignments}
                  activeProfile={activeProfile}
                  onStartMission={handleStartAssignment}
                  onBackToGenerator={() => setScreen('setup')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {(screen === 'setup' || screen === 'auth') && !focusMode && stats.activeProfileId && (
            <motion.aside 
              key="sidebar"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:col-span-4 space-y-6"
            >
              <Leaderboard rankings={rankings} />
              
              <div className="glass-card p-6 rounded-3xl bg-indigo-600 text-white border-none shadow-indigo-200">
                <h3 className="font-display font-bold text-lg mb-2">Dica do Professor 👨‍🏫</h3>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  "O aprendizado acontece quando a gente se diverte. Não tenha medo de errar, cada erro é uma chance de aprender algo novo!"
                </p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      <AccessibilityMenu />
      
      <AnimatePresence>
        {showAvatarCustomizer && (
          <AvatarCustomizer
            currentAvatar={stats.avatarUrl}
            onSave={handleSaveAvatar}
            onClose={() => setShowAvatarCustomizer(false)}
          />
        )}
      </AnimatePresence>
      <div className={focusMode ? 'hide-focus' : ''}>
        <ErrorBoundary>
          <SupportChat />
        </ErrorBoundary>
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-32 h-32 bg-white rounded-[40px] flex items-center justify-center shadow-2xl shadow-indigo-200 mb-8 p-4"
            >
              <img 
                src={hiperreforcoLogo} 
                alt="Carregando..." 
                className="w-full h-full object-contain"
              />
            </motion.div>
            <h2 className="text-2xl font-display font-black text-slate-900 mb-2">Construindo sua Aventura...</h2>
            <p className="text-slate-500 font-bold max-w-xs mx-auto">
              Nossa IA está preparando os melhores desafios para seu cérebro brilhar! 🧠✨
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {showInpiModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card bg-emerald-50 border border-emerald-100 rounded-3xl p-8 max-w-lg shadow-2xl animate-in fade-in zoom-in duration-300">
            <h3 className="font-bold text-emerald-800 flex items-center gap-2 text-xl">
              <Award size={24} />
              Software Registrado no INPI
            </h3>
            <p className="text-emerald-700/80 mt-4 leading-relaxed">
              O HiperReforço é um software protegido e oficialmente registrado no Instituto Nacional da Propriedade Industrial (INPI).
            </p>
            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => {
                  setShowInpiModal(false);
                  sessionStorage.setItem('inpi_shown', 'true');
                }}
                className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-md cursor-pointer hover:bg-emerald-700 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
    </ErrorBoundary>
  );
}
