/**
 * Casos de Teste para Firebase Rules Emulator (@firebase/rules-unit-testing)
 * 
 * Execução recomendada no ambiente local com Firebase Local Emulator Suite:
 *   firebase emulators:exec --only firestore "npm test"
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import * as fs from 'fs';

const PROJECT_ID = 'hiperreforco-test-project';
let testEnv: RulesTestEnvironment;

export async function setupTestEnvironment() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
}

export async function cleanupTestEnvironment() {
  if (testEnv) {
    await testEnv.cleanup();
  }
}

// =============================================================================
// SUÍTE 1: USUÁRIO COMUM (STUDENT / PARENT)
// =============================================================================
export const commonUserTests = {
  // 1.1 Não pode se autopromover para specialist na criação
  async testCannotSelfPromoteOnCreate() {
    const studentDb = testEnv.authenticatedContext('aluno-uid-1', {
      email: 'aluno@escola.com'
    }).firestore();

    const userDocRef = doc(studentDb, 'users', 'aluno-uid-1');
    
    // Tenta criar com role: specialist
    await assertFails(
      setDoc(userDocRef, {
        uid: 'aluno-uid-1',
        email: 'aluno@escola.com',
        role: 'specialist'
      })
    );

    // Tenta criar com claim/campo specialist: true
    await assertFails(
      setDoc(userDocRef, {
        uid: 'aluno-uid-1',
        email: 'aluno@escola.com',
        role: 'student',
        specialist: true
      })
    );

    // Criação válida com role: student
    await assertSucceeds(
      setDoc(userDocRef, {
        uid: 'aluno-uid-1',
        email: 'aluno@escola.com',
        role: 'student',
        xp: 0,
        level: 1
      })
    );
  },

  // 1.2 Não pode alterar role, xp, level, streak, badges ou assignedSpecialist
  async testCannotModifyRestrictedGamificationFields() {
    // Inicializa doc via contexto administrativo
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-uid-1'), {
        uid: 'aluno-uid-1',
        email: 'aluno@escola.com',
        role: 'student',
        xp: 100,
        level: 1,
        streak: 3,
        totalCorrect: 10,
        totalQuestions: 15,
        assignedSpecialist: 'esp-autorizado-uid'
      });
    });

    const studentDb = testEnv.authenticatedContext('aluno-uid-1').firestore();
    const userDocRef = doc(studentDb, 'users', 'aluno-uid-1');

    // Tentativa de alterar role para specialist
    await assertFails(
      updateDoc(userDocRef, { role: 'specialist' })
    );

    // Tentativa de injetar XP arbitrário
    await assertFails(
      updateDoc(userDocRef, { xp: 99999 })
    );

    // Tentativa de alterar assignedSpecialist
    await assertFails(
      updateDoc(userDocRef, { assignedSpecialist: 'outro-especialista' })
    );

    // Tentativa de alterar streak
    await assertFails(
      updateDoc(userDocRef, { streak: 50 })
    );

    // Atualização de campos de perfil permitidos (displayName, avatarUrl, gender, activeProfileId)
    await assertSucceeds(
      updateDoc(userDocRef, {
        avatarUrl: 'https://example.com/avatar.png',
        displayName: 'Lucas Gamer',
        gender: 'masculino',
        activeProfileId: 'perfil-1'
      })
    );
  },

  // 1.3 Não pode criar ou modificar documentos de outro usuário
  async testCannotAccessOtherUserData() {
    const studentDb = testEnv.authenticatedContext('aluno-uid-1').firestore();
    
    // Tenta ler perfil de outro aluno
    await assertFails(
      getDoc(doc(studentDb, 'users', 'aluno-uid-2'))
    );

    // Tenta escrever no perfil de outro aluno
    await assertFails(
      setDoc(doc(studentDb, 'users', 'aluno-uid-2'), {
        uid: 'aluno-uid-2',
        role: 'student'
      })
    );
  }
};

// =============================================================================
// SUÍTE 2: ESPECIALISTA AUTORIZADO (token.specialist == true + Vínculo)
// =============================================================================
export const authorizedSpecialistTests = {
  async testSpecialistWithLinkCanReadAndAssign() {
    // Aluno vinculado ao especialista esp-123
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-vinculado'), {
        uid: 'aluno-vinculado',
        email: 'aluno.vinculado@escola.com',
        role: 'student',
        assignedSpecialist: 'esp-123'
      });
    });

    const specialistDb = testEnv.authenticatedContext('esp-123', {
      specialist: true
    }).firestore();

    // 2.1 Especialista lê aluno vinculado
    await assertSucceeds(
      getDoc(doc(specialistDb, 'users', 'aluno-vinculado'))
    );

    // 2.2 Especialista cria atividade para aluno vinculado
    const assignmentsRef = collection(specialistDb, 'users', 'aluno-vinculado', 'assignments');
    await assertSucceeds(
      addDoc(assignmentsRef, {
        specialistId: 'esp-123',
        specialistName: 'Dra. Ana Psicopedagoga',
        studentId: 'aluno-vinculado',
        subject: 'Matemática',
        topic: 'Frações com Minecraft',
        questions: [{ text: '1/2 de 64 blocos?', options: ['32', '16'], correctAnswerIndex: 0 }],
        status: 'pending',
        assignedAt: new Date().toISOString()
      })
    );

    // 2.3 Especialista cria orientação/comentário pedagógico
    const commentsRef = collection(specialistDb, 'users', 'aluno-vinculado', 'comments');
    await assertSucceeds(
      addDoc(commentsRef, {
        specialistId: 'esp-123',
        specialistName: 'Dra. Ana',
        studentId: 'aluno-vinculado',
        content: 'Excelente progresso na missão de transferência.',
        date: new Date().toISOString(),
        category: 'pedagogical'
      })
    );
  }
};

// =============================================================================
// SUÍTE 3: ESPECIALISTA SEM VÍNCULO (token.specialist == true, sem vínculo)
// =============================================================================
export const unauthorizedSpecialistTests = {
  async testSpecialistWithoutLinkIsDenied() {
    // Aluno SEM vínculo com esp-intruso
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-sem-vinculo'), {
        uid: 'aluno-sem-vinculo',
        email: 'aluno.outro@escola.com',
        role: 'student',
        assignedSpecialist: 'outro-especialista-uid'
      });
    });

    const intruderDb = testEnv.authenticatedContext('esp-intruso', {
      specialist: true
    }).firestore();

    // 3.1 Especialista sem vínculo tenta ler dados do aluno -> BLOQUEADO
    await assertFails(
      getDoc(doc(intruderDb, 'users', 'aluno-sem-vinculo'))
    );

    // 3.2 Especialista sem vínculo tenta criar atividade para o aluno -> BLOQUEADO
    const assignmentsRef = collection(intruderDb, 'users', 'aluno-sem-vinculo', 'assignments');
    await assertFails(
      addDoc(assignmentsRef, {
        specialistId: 'esp-intruso',
        specialistName: 'Especialista Não Vinculado',
        studentId: 'aluno-sem-vinculo',
        questions: [],
        status: 'pending'
      })
    );

    // 3.3 Especialista sem vínculo tenta ler histórico do aluno -> BLOQUEADO
    await assertFails(
      getDoc(doc(intruderDb, 'users', 'aluno-sem-vinculo', 'history', 'quiz-1'))
    );
  }
};

// =============================================================================
// SUÍTE 4: ALUNO DE OUTRO PERFIL & EXECUÇÃO DE ATIVIDADES
// =============================================================================
export const studentAssignmentExecutionTests = {
  async testStudentCompletingAssignment() {
    // Configura atividade para o aluno-1
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-1'), {
        uid: 'aluno-1',
        role: 'student'
      });
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-1', 'assignments', 'ativ-100'), {
        specialistId: 'esp-123',
        studentId: 'aluno-1',
        topic: 'Geometria Espacial',
        questions: [{ text: 'O que é um cubo?' }],
        status: 'pending',
        assignedAt: '2026-09-01T10:00:00Z',
        xp: 500
      });
    });

    const student1Db = testEnv.authenticatedContext('aluno-1').firestore();
    const otherStudentDb = testEnv.authenticatedContext('aluno-2').firestore();

    // 4.1 Aluno 2 tenta ler a atividade do Aluno 1 -> BLOQUEADO
    await assertFails(
      getDoc(doc(otherStudentDb, 'users', 'aluno-1', 'assignments', 'ativ-100'))
    );

    // 4.2 Aluno 1 lê sua própria atividade -> PERMITIDO
    await assertSucceeds(
      getDoc(doc(student1Db, 'users', 'aluno-1', 'assignments', 'ativ-100'))
    );

    // 4.3 Aluno 1 tenta modificar as perguntas ou specialistId -> BLOQUEADO
    await assertFails(
      updateDoc(doc(student1Db, 'users', 'aluno-1', 'assignments', 'ativ-100'), {
        questions: [],
        status: 'completed'
      })
    );

    // 4.4 Aluno 1 tenta alterar o XP definido pelo especialista -> BLOQUEADO
    await assertFails(
      updateDoc(doc(student1Db, 'users', 'aluno-1', 'assignments', 'ativ-100'), {
        xp: 10000,
        status: 'completed'
      })
    );

    // 4.5 Aluno 1 conclui a atividade alterando apenas status, completedAt e studentResponses -> PERMITIDO
    await assertSucceeds(
      updateDoc(doc(student1Db, 'users', 'aluno-1', 'assignments', 'ativ-100'), {
        status: 'completed',
        completedAt: new Date().toISOString(),
        studentResponses: [{ questionId: 'q1', answer: 'Um poliedro regular.' }]
      })
    );
  }
};

// =============================================================================
// SUÍTE 5: CENÁRIOS ESPECÍFICOS DE INTERAÇÃO ESPECIALISTA-ALUNO
// =============================================================================
export const specialistStudentInteractionTests = {
  // Cenário 1: Especialista autorizado visualizando aluno vinculado
  async testEspecialistaAutorizadoVisualizandoAlunoVinculado() {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-pedro'), {
        uid: 'aluno-pedro',
        displayName: 'Pedro Hiperfoco',
        role: 'student',
        assignedSpecialist: 'esp-clinico-1'
      });
    });

    const specialistDb = testEnv.authenticatedContext('esp-clinico-1', {
      specialist: true
    }).firestore();

    await assertSucceeds(
      getDoc(doc(specialistDb, 'users', 'aluno-pedro'))
    );
  },

  // Cenário 2: Especialista autorizado tentando acessar aluno não vinculado
  async testEspecialistaAutorizadoTentandoAcessarAlunoNaoVinculado() {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-julia'), {
        uid: 'aluno-julia',
        displayName: 'Julia Robótica',
        role: 'student',
        assignedSpecialist: 'outro-especialista'
      });
    });

    const specialistDb = testEnv.authenticatedContext('esp-clinico-1', {
      specialist: true
    }).firestore();

    // Especialista não vinculado tentando ler perfil do aluno -> BLOQUEADO
    await assertFails(
      getDoc(doc(specialistDb, 'users', 'aluno-julia'))
    );
  },

  // Cenário 3: Usuário comum tentando abrir a Área do Especialista / executar privilégios clínicos
  async testUsuarioComumTentandoAbrirOuAcessarAreaDoEspecialista() {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-vitima'), {
        uid: 'aluno-vitima',
        role: 'student'
      });
    });

    // Usuário comum sem claim `specialist: true`
    const commonUserDb = testEnv.authenticatedContext('usuario-comum-1', {
      specialist: false
    }).firestore();

    // Tentativa de criar atividade pedagógica no perfil de outro aluno -> BLOQUEADO
    await assertFails(
      addDoc(collection(commonUserDb, 'users', 'aluno-vitima', 'assignments'), {
        specialistId: 'usuario-comum-1',
        studentId: 'aluno-vitima',
        topic: 'Tentativa Invasiva',
        questions: [],
        status: 'pending'
      })
    );

    // Tentativa de ler prontuário de outro aluno -> BLOQUEADO
    await assertFails(
      getDoc(doc(commonUserDb, 'users', 'aluno-vitima'))
    );
  },

  // Cenário 4: Aluno visualizando sua própria atividade
  async testAlunoVisualizandoSuaPropriaAtividade() {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-proprio', 'assignments', 'ativ-minha'), {
        specialistId: 'esp-clinico-1',
        studentId: 'aluno-proprio',
        topic: 'Ecologia e Minecraft',
        questions: [{ text: 'Como funciona o ciclo da água?' }],
        status: 'pending',
        assignedAt: new Date().toISOString()
      });
    });

    const studentDb = testEnv.authenticatedContext('aluno-proprio').firestore();

    await assertSucceeds(
      getDoc(doc(studentDb, 'users', 'aluno-proprio', 'assignments', 'ativ-minha'))
    );
  },

  // Cenário 5: Aluno tentando visualizar atividade de outro aluno
  async testAlunoTentandoVisualizarAtividadeDeOutroAluno() {
    const intruderStudentDb = testEnv.authenticatedContext('aluno-curioso').firestore();

    await assertFails(
      getDoc(doc(intruderStudentDb, 'users', 'aluno-proprio', 'assignments', 'ativ-minha'))
    );
  },

  // Cenário 6: Atividade atribuída com sucesso
  async testAtividadeAtribuidaComSucesso() {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-lucas'), {
        uid: 'aluno-lucas',
        role: 'student',
        assignedSpecialist: 'esp-clinico-1'
      });
    });

    const specialistDb = testEnv.authenticatedContext('esp-clinico-1', {
      specialist: true
    }).firestore();

    await assertSucceeds(
      addDoc(collection(specialistDb, 'users', 'aluno-lucas', 'assignments'), {
        specialistId: 'esp-clinico-1',
        specialistName: 'Dr. Roberto Pedagogo',
        studentId: 'aluno-lucas',
        subject: 'Matemática',
        topic: 'Multiplicação com LEGO',
        questions: [
          { text: 'Quantas peças há em 4 grupos de 6?', options: ['24', '18', '30'], correctAnswerIndex: 0 }
        ],
        status: 'pending',
        assignedAt: new Date().toISOString()
      })
    );
  },

  // Cenário 7: Atividade não autorizada rejeitada
  async testAtividadeNaoAutorizadaRejeitada() {
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-outro'), {
        uid: 'aluno-outro',
        role: 'student',
        assignedSpecialist: 'outro-especialista'
      });
    });

    const unauthorizedSpecialistDb = testEnv.authenticatedContext('esp-clinico-1', {
      specialist: true
    }).firestore();

    // Especialista atribuindo para aluno sem vínculo com ele -> REJEITADO
    await assertFails(
      addDoc(collection(unauthorizedSpecialistDb, 'users', 'aluno-outro', 'assignments'), {
        specialistId: 'esp-clinico-1',
        specialistName: 'Dr. Roberto',
        studentId: 'aluno-outro',
        subject: 'Ciências',
        topic: 'Astrofísica',
        questions: [],
        status: 'pending',
        assignedAt: new Date().toISOString()
      })
    );

    // Especialista atribuindo com ID adulterado (studentId != doc path) -> REJEITADO
    await assertFails(
      addDoc(collection(unauthorizedSpecialistDb, 'users', 'aluno-lucas', 'assignments'), {
        specialistId: 'esp-clinico-1',
        specialistName: 'Dr. Roberto',
        studentId: 'uid-diferente-do-caminho',
        subject: 'Ciências',
        topic: 'Astrofísica',
        questions: [],
        status: 'pending',
        assignedAt: new Date().toISOString()
      })
    );
  }
};

