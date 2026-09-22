import { QuizHistoryEntry, SpecialistComment, SpecialistAssignment, Badge } from '../types';

export function generateMockDataForStudent(uid: string) {
  const now = new Date();
  
  const stats = {
    role: 'student',
    xp: 1250,
    level: 5,
    streak: 3,
    lastPlayed: now.toISOString(),
    totalCorrect: 7,
    totalQuestions: 8,
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=hiperreforco',
    gender: 'masculino',
  };

  const history: QuizHistoryEntry[] = [
    {
      id: 'mock-quiz-1',
      date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      subject: 'Matemática',
      topic: 'Contagem e Quantidades',
      focus: 'Dinossauros',
      score: 4,
      total: 5,
      grade: '1º Ano',
      isArchived: false,
      wrongQuestions: [
        {
          text: 'Observe as figuras geométricas na lousa. Há 3 triângulos e 4 círculos. Quantas figuras há no total?',
          explanation: '3 + 4 = 7 figuras.'
        }
      ],
      skippedQuestions: [],
      questions: [
        {
          id: 'q1',
          text: 'Se o T-Rex tem 3 dinossauros amigos e o Triceratops trouxe mais 2, quantos dinossauros temos no total?',
          options: ['4 dinossauros', '5 dinossauros', '6 dinossauros', '3 dinossauros'],
          correctAnswerIndex: 1,
          explanation: '3 + 2 = 5.',
          contextType: 'hyperfocus'
        },
        {
          id: 'q2',
          text: 'O Velociraptor coletou 8 pegadas fósseis na floresta, mas perdeu 3 no caminho de volta. Quantas pegadas sobraram?',
          options: ['3 pegadas', '5 pegadas', '6 pegadas', '8 pegadas'],
          correctAnswerIndex: 1,
          explanation: '8 - 3 = 5.',
          contextType: 'hyperfocus'
        },
        {
          id: 'q3',
          text: 'Um ninho tem 4 ovos de dinossauro. Se cada ovo chocar e nascer 1 filhote, quantos filhotes teremos?',
          options: ['2 filhotes', '4 filhotes', '8 filhotes', '1 filhote'],
          correctAnswerIndex: 1,
          explanation: 'Cada ovo choca 1 filhote, então são 4 no total.',
          contextType: 'hyperfocus'
        },
        {
          id: 'q4',
          text: 'Mariana tem uma macieira em seu quintal. Ela colheu 6 maçãs pela manhã e 2 maçãs à tarde. Quantas maçãs Mariana colheu ao todo?',
          options: ['6 maçãs', '7 maçãs', '8 maçãs', '9 maçãs'],
          correctAnswerIndex: 2,
          explanation: '6 + 2 = 8 maçãs no total.',
          contextType: 'transfer'
        },
        {
          id: 'q5',
          text: 'Observe as figuras geométricas na lousa. Há 3 triângulos e 4 círculos. Quantas figuras há no total?',
          options: ['5 figuras', '6 figuras', '7 figuras', '8 figuras'],
          correctAnswerIndex: 2,
          explanation: '3 + 4 = 7 figuras.',
          contextType: 'neutral'
        }
      ],
      responses: [
        { questionId: 'q1', answer: '5 dinossauros' },
        { questionId: 'q2', answer: '5 pegadas' },
        { questionId: 'q3', answer: '4 filhotes' },
        { questionId: 'q4', answer: '8 maçãs' },
        { questionId: 'q5', answer: '6 figuras' }
      ]
    },
    {
      id: 'mock-quiz-2',
      date: now.toISOString(),
      subject: 'Ciências',
      topic: 'Características dos Animais',
      focus: 'Dinossauros',
      score: 3,
      total: 3,
      grade: '1º Ano',
      isArchived: false,
      wrongQuestions: [],
      skippedQuestions: [],
      questions: [
        {
          id: 's1',
          text: 'O Brachiossauro era um dinossauro herbívoro que comia folhas de árvores muito altas. Qual era o seu principal alimento?',
          options: ['Plantas', 'Insetos', 'Outros dinossauros', 'Peixes'],
          correctAnswerIndex: 0,
          explanation: 'Como um herbívoro, ele se alimentava de plantas.',
          contextType: 'hyperfocus'
        },
        {
          id: 's2',
          text: 'Alguns dinossauros tinham asas e penas para voar, como o Pterodáctilo. Que outros animais que conhecemos hoje também têm asas e voam?',
          options: ['Peixes', 'Cachorros', 'Aves', 'Gatos'],
          correctAnswerIndex: 2,
          explanation: 'Aves são animais voadores contemporâneos que possuem asas.',
          contextType: 'transfer'
        },
        {
          id: 's3',
          text: 'A água da chuva ajuda as plantas a crescerem e os rios a correrem. De onde vem a chuva que cai sobre a terra?',
          options: ['Do solo', 'Das nuvens no céu', 'Do mar direto', 'Das florestas'],
          correctAnswerIndex: 1,
          explanation: 'A chuva cai das nuvens formadas por vapor de água acumulado no céu.',
          contextType: 'neutral'
        }
      ],
      responses: [
        { questionId: 's1', answer: 'Plantas' },
        { questionId: 's2', answer: 'Aves' },
        { questionId: 's3', answer: 'Das nuvens no céu' }
      ]
    }
  ];

  const badges: Badge[] = [
    {
      id: 'badge-1',
      badgeId: 'knowledge-explorer',
      name: 'Explorador do Conhecimento',
      icon: 'ouro',
      description: 'Acertou todas as questões sobre o tema em um quiz.',
      unlockedAt: now.toISOString()
    },
    {
      id: 'badge-2',
      badgeId: 'connecting-ideas',
      name: 'Conectando Ideias',
      icon: 'prata',
      description: 'Concluiu com sucesso a sua primeira Missão de Transferência!',
      unlockedAt: now.toISOString()
    },
    {
      id: 'badge-3',
      badgeId: 'knowledge-pioneer',
      name: 'Desbravador do Saber',
      icon: 'bronze',
      description: 'Demonstrou total foco em uma nova área de conhecimento.',
      unlockedAt: now.toISOString()
    }
  ];

  const comments: SpecialistComment[] = [
    {
      id: 'comment-1',
      specialistId: 'doc-roberto',
      specialistName: 'Dr. Roberto Souza (Psicopedagogo)',
      content: 'O progresso do aluno nas missões de transferência de matemática foi formidável. Ele conseguiu aplicar a noção de somas numéricas com frutas e formas, o que indica que a abstração de contagem não está restrita à temática dos dinossauros.',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'pedagogical'
    }
  ];

  const assignments: SpecialistAssignment[] = [
    {
      id: 'assign-1',
      specialistId: 'doc-roberto',
      specialistName: 'Dr. Roberto Souza (Psicopedagogo)',
      studentId: uid,
      subject: 'Matemática',
      topic: 'Formas e Cores',
      questions: [
        {
          id: 'q-shape-1',
          text: 'Qual destas formas geométricas possui exatamente três lados?',
          options: ['Quadrado', 'Triângulo', 'Círculo', 'Retângulo'],
          correctAnswerIndex: 1,
          explanation: 'O triângulo tem 3 lados.',
          contextType: 'neutral'
        }
      ],
      status: 'pending',
      assignedAt: now.toISOString()
    }
  ];

  return {
    stats,
    history,
    badges,
    comments,
    assignments
  };
}
