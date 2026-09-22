export type Difficulty = 'baixa' | 'média' | 'alta';

export type QuestionType = 'multiple_choice' | 'essay';

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  type?: QuestionType;
  contextType?: "hyperfocus" | "transfer" | "neutral";
  isTransferMission?: boolean;
}

export interface QuizProgress {
  userId: string;
  profileId: string;
  config: QuizConfig;
  questions: Question[];
  currentIndex: number;
  score: number;
  wrongQuestions: { text: string; explanation: string }[];
  skippedQuestionIndices: number[];
  responses: { questionId: string; answer: string; isSkipped?: boolean }[];
  durations: { questionText: string; duration: number }[];
  lastUpdated: string;
}

export interface SpecialistAssignment {
  id: string;
  specialistId: string;
  specialistName: string;
  studentId: string;
  subject: string;
  topic: string;
  questions: Question[];
  status: 'pending' | 'completed';
  assignedAt: string;
  completedAt?: string;
  studentResponses?: {
    questionId: string;
    answer: string;
    isCorrect?: boolean; // For auto-graded MC questions
  }[];
}

export interface QuizConfig {
  subject: string;
  topic: string;
  focus: string;
  grade: string;
  gender?: 'masculino' | 'feminino' | 'outro';
  difficulty: Difficulty;
  count: number;
  materialContext?: { text?: string; inlineData?: { data: string; mimeType: string }; fileName: string };
}

export interface QuizHistoryEntry {
  id: string;
  date: string;
  subject: string;
  topic: string;
  focus: string;
  score: number;
  total: number;
  grade: string;
  wrongQuestions: { text: string; explanation: string }[];
  skippedQuestions?: { text: string }[];
  questionDurations?: { questionText: string; duration: number }[];
  questions?: Question[];
  responses?: { questionId: string; answer: string; isSkipped?: boolean }[];
  isArchived?: boolean;
  neutralErrors?: number;
  totalNeutral?: number;
}

export interface Badge {
  id: string;
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface LearningTrail {
  id: string;
  subject: string;
  topic: string;
  focus: string;
  grade: string;
  currentStep: number;
  totalSteps: number;
  status: 'active' | 'completed';
}

export interface SpecialistComment {
  id: string;
  specialistId: string;
  specialistName: string;
  content: string;
  date: string;
  category: 'pedagogical' | 'behavioral' | 'recommendation';
}

export interface MaterialArchive {
  id: string;
  userId: string;
  fileName: string;
  downloadURL: string;
  uploadedAt: string;
  size: number;
  type: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  avatarUrl: string;
  gender?: 'masculino' | 'feminino' | 'outro';
  xp: number;
  level: number;
  streak: number;
  lastPlayed: string | null;
  totalCorrect: number;
  totalQuestions: number;
  activeTrail?: LearningTrail | null;
}

export interface InterestQuestion {
  id: string;
  text: string;
  options: {
    text: string;
    category: string;
  }[];
}

export interface InterestSurveyResult {
  suggestedThemes: {
    name: string;
    description: string;
    icon: string;
  }[];
}

export interface R4Alert {
  id: string;
  date: string;
  subject: string;
  topic: string;
  reviewed: boolean;
  neutralErrors: number;
  totalNeutral: number;
}

export interface UserStats {
  uid?: string;
  email?: string | null;
  role: 'student' | 'parent' | 'specialist';
  profiles?: ChildProfile[];
  activeProfileId?: string | null;
  xp: number;
  level: number;
  streak: number;
  lastPlayed: string | null;
  totalCorrect: number;
  totalQuestions: number;
  history: QuizHistoryEntry[];
  badges: Badge[];
  avatarUrl?: string;
  gender?: 'masculino' | 'feminino' | 'outro';
  assignedSpecialist?: string;
  activeTrail?: LearningTrail | null;
  comments: SpecialistComment[];
  materials?: MaterialArchive[];
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderMessage?: string;
  r4Alerts?: R4Alert[];
}

export interface RankingEntry {
  name: string;
  xp: number;
  level: number;
}

export interface CachedQuiz {
  id: string;
  config: QuizConfig;
  questions: Question[];
  timestamp: number;
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'main' | 'sub' | 'error';
  explanation?: string;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export interface QuizResponse {
  questions: Question[];
  themedRankings: string[];
}
