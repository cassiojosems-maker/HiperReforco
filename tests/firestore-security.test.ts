/**
 * Suíte de Testes de Segurança Firestore (Itens 1 a 11)
 * Projeto HiperReforço — Regras Zero-Trust e Prevenção de Elevação de Privilégio
 * 
 * Execução com Firebase Local Emulator Suite:
 *   firebase emulators:exec --only firestore "npm run test:security"
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';

const PROJECT_ID = 'hiperreforco-security-test';
let testEnv: RulesTestEnvironment | null = null;

export async function setupTestEnvironment(): Promise<RulesTestEnvironment> {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080
    }
  });
  return testEnv;
}

export async function cleanupTestEnvironment(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

export async function runFirestoreSecurityTests(env: RulesTestEnvironment): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  // Helper de execução e registro
  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  };

  // ===========================================================================
  // ITEM 1: Usuário comum não consegue alterar users/{uid}.role para specialist
  // ===========================================================================
  await runTest('Item 1: Usuário comum não consegue alterar users/{uid}.role para specialist', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-1'), {
        uid: 'aluno-1',
        email: 'aluno1@escola.com',
        role: 'student',
        xp: 100,
        level: 1
      });
    });

    const studentDb = env.authenticatedContext('aluno-1').firestore();
    const userRef = doc(studentDb, 'users', 'aluno-1');

    // Tentativa de elevação de privilégio alterando role para specialist
    await assertFails(updateDoc(userRef, { role: 'specialist' }));

    // Tentativa de definir role como specialist na criação de conta
    const newStudentDb = env.authenticatedContext('novo-usuario-1').firestore();
    await assertFails(setDoc(doc(newStudentDb, 'users', 'novo-usuario-1'), {
      uid: 'novo-usuario-1',
      role: 'specialist'
    }));
  });

  // ===========================================================================
  // ITEM 2: Usuário comum não consegue alterar request.auth.token.specialist
  // ===========================================================================
  await runTest('Item 2: Usuário comum não consegue forjar ou emitir request.auth.token.specialist', async () => {
    // Contexto com usuário comum sem custom claim specialist
    const commonUserDb = env.authenticatedContext('aluno-sem-claim', {
      email: 'comum@escola.com'
    }).firestore();

    // Acesso a recurso restrito a especialistas (criar atividade) é rejeitado
    await assertFails(addDoc(collection(commonUserDb, 'users', 'aluno-sem-claim', 'assignments'), {
      specialistId: 'aluno-sem-claim',
      studentId: 'aluno-sem-claim',
      topic: 'Tentativa Forjamento',
      questions: [],
      status: 'pending'
    }));
  });

  // ===========================================================================
  // ITEM 3: Usuário comum não consegue escrever specialist: true em nenhum documento para obter autorização
  // ===========================================================================
  await runTest('Item 3: Escrever specialist: true em documento não concede privilégios de especialista', async () => {
    const studentDb = env.authenticatedContext('aluno-esperto').firestore();
    const userRef = doc(studentDb, 'users', 'aluno-esperto');

    // 3.1: Tentativa do próprio usuário de injetar specialist: true no seu doc -> REJEITADO
    await assertFails(setDoc(userRef, {
      uid: 'aluno-esperto',
      role: 'student',
      specialist: true
    }));

    // 3.2: Mesmo se um documento contiver specialist: true, ele NÃO tem request.auth.token.specialist
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-com-flag'), {
        uid: 'aluno-com-flag',
        role: 'student',
        specialist: true // Campo no documento
      });
    });

    // O usuário com a flag no doc tenta executar ações de especialista (criar atividade)
    const userWithFlagDb = env.authenticatedContext('aluno-com-flag').firestore();
    await assertFails(addDoc(collection(userWithFlagDb, 'users', 'aluno-com-flag', 'assignments'), {
      specialistId: 'aluno-com-flag',
      studentId: 'aluno-com-flag',
      topic: 'Tentativa Flag',
      questions: [],
      status: 'pending'
    }));
  });

  // ===========================================================================
  // ITEM 4: Usuário comum não consegue alterar xp, level, streak, totalCorrect ou totalQuestions arbitrariamente
  // ===========================================================================
  await runTest('Item 4: Usuário comum não consegue alterar gamificação (xp, level, streak, etc.) arbitrariamente', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-gamificacao'), {
        uid: 'aluno-gamificacao',
        role: 'student',
        xp: 50,
        level: 1,
        streak: 2,
        totalCorrect: 5,
        totalQuestions: 10
      });
    });

    const studentDb = env.authenticatedContext('aluno-gamificacao').firestore();
    const userRef = doc(studentDb, 'users', 'aluno-gamificacao');

    await assertFails(updateDoc(userRef, { xp: 999999 }));
    await assertFails(updateDoc(userRef, { level: 50 }));
    await assertFails(updateDoc(userRef, { streak: 100 }));
    await assertFails(updateDoc(userRef, { totalCorrect: 500 }));
    await assertFails(updateDoc(userRef, { totalQuestions: 1000 }));

    // Atualização de campos de perfil seguros (displayName, avatarUrl, gender) continua permitida
    await assertSucceeds(updateDoc(userRef, {
      displayName: 'Nome Atualizado',
      avatarUrl: 'https://example.com/avatar.png',
      gender: 'masculino'
    }));
  });

  // ===========================================================================
  // ITEM 5: Usuário comum não consegue atribuir atividade a si próprio como especialista
  // ===========================================================================
  await runTest('Item 5: Usuário comum não consegue atribuir atividade a si próprio como especialista', async () => {
    const studentDb = env.authenticatedContext('aluno-proprio').firestore();
    const assignmentsRef = collection(studentDb, 'users', 'aluno-proprio', 'assignments');

    await assertFails(addDoc(assignmentsRef, {
      specialistId: 'aluno-proprio',
      specialistName: 'Aluno Posando de Especialista',
      studentId: 'aluno-proprio',
      topic: 'Auto Atribuição Fraudulenta',
      questions: [{ text: '1+1?', options: ['2'], correctAnswerIndex: 0 }],
      status: 'pending',
      assignedAt: new Date().toISOString()
    }));
  });

  // ===========================================================================
  // ITEM 6: Usuário comum não consegue acessar a Área do Especialista por chamada direta ao Firestore
  // ===========================================================================
  await runTest('Item 6: Usuário comum não consegue acessar Área do Especialista por chamada direta ao Firestore', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-alvo'), {
        uid: 'aluno-alvo',
        role: 'student',
        displayName: 'Aluno Alvo'
      });
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-alvo', 'comments', 'comentario-1'), {
        content: 'Orientação clínica confidencial'
      });
    });

    const commonUserDb = env.authenticatedContext('aluno-invasor').firestore();

    // Leitura direta do perfil de outro aluno -> REJEITADO
    await assertFails(getDoc(doc(commonUserDb, 'users', 'aluno-alvo')));

    // Leitura de comentários/orientações clínicas de outro aluno -> REJEITADO
    await assertFails(getDoc(doc(commonUserDb, 'users', 'aluno-alvo', 'comments', 'comentario-1')));

    // Criação de orientação clínica no prontuário de outro aluno -> REJEITADO
    await assertFails(addDoc(collection(commonUserDb, 'users', 'aluno-alvo', 'comments'), {
      content: 'Falso parecer clínico'
    }));
  });

  // ===========================================================================
  // ITEM 7: Usuário com Custom Claim specialist=true consegue acessar somente os recursos autorizados
  // ===========================================================================
  await runTest('Item 7: Usuário com Custom Claim specialist=true acessa estritamente recursos autorizados', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-com-vinculo'), {
        uid: 'aluno-com-vinculo',
        role: 'student',
        assignedSpecialist: 'esp-autorizado-7'
      });
    });

    const specialistDb = env.authenticatedContext('esp-autorizado-7', { specialist: true }).firestore();

    // 7.1 Acesso autorizado a aluno vinculado -> PERMITIDO
    await assertSucceeds(getDoc(doc(specialistDb, 'users', 'aluno-com-vinculo')));

    // 7.2 Especialista tenta alterar o role do aluno -> REJEITADO (apenas admin pode)
    await assertFails(updateDoc(doc(specialistDb, 'users', 'aluno-com-vinculo'), {
      role: 'specialist'
    }));

    // 7.3 Especialista tenta excluir a conta do aluno -> REJEITADO
    await assertFails(deleteDoc(doc(specialistDb, 'users', 'aluno-com-vinculo')));
  });

  // ===========================================================================
  // ITEM 8: Especialista sem vínculo não consegue acessar dados de outro aluno
  // ===========================================================================
  await runTest('Item 8: Especialista sem vínculo não consegue acessar dados de outro aluno', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-de-outro'), {
        uid: 'aluno-de-outro',
        role: 'student',
        assignedSpecialist: 'outro-especialista-99'
      });
    });

    const unlinkedSpecialistDb = env.authenticatedContext('esp-sem-vinculo', { specialist: true }).firestore();

    // Leitura do perfil do aluno não vinculado -> REJEITADO
    await assertFails(getDoc(doc(unlinkedSpecialistDb, 'users', 'aluno-de-outro')));

    // Tentativa de criar atividade para aluno não vinculado -> REJEITADO
    await assertFails(addDoc(collection(unlinkedSpecialistDb, 'users', 'aluno-de-outro', 'assignments'), {
      specialistId: 'esp-sem-vinculo',
      studentId: 'aluno-de-outro',
      topic: 'Atividade Não Autorizada',
      questions: [],
      status: 'pending'
    }));
  });

  // ===========================================================================
  // ITEM 9: Especialista vinculado consegue criar uma atividade para o aluno correto
  // ===========================================================================
  await runTest('Item 9: Especialista vinculado consegue criar atividade para o aluno correto', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-vinculado-9'), {
        uid: 'aluno-vinculado-9',
        role: 'student',
        assignedSpecialist: 'esp-vinculado-9'
      });
    });

    const linkedSpecialistDb = env.authenticatedContext('esp-vinculado-9', { specialist: true }).firestore();

    await assertSucceeds(addDoc(collection(linkedSpecialistDb, 'users', 'aluno-vinculado-9', 'assignments'), {
      specialistId: 'esp-vinculado-9',
      specialistName: 'Dra. Clara',
      studentId: 'aluno-vinculado-9',
      subject: 'Matemática',
      topic: 'Operações Fundamentais com Minecraft',
      questions: [{ text: 'Quantos blocos restam?', options: ['10', '20'], correctAnswerIndex: 0 }],
      status: 'pending',
      assignedAt: new Date().toISOString()
    }));
  });

  // ===========================================================================
  // ITEM 10: Aluno consegue atualizar somente a conclusão da própria atividade
  // ===========================================================================
  await runTest('Item 10: Aluno consegue atualizar somente a conclusão da própria atividade', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-10'), {
        uid: 'aluno-10',
        role: 'student'
      });
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-10', 'assignments', 'ativ-10'), {
        specialistId: 'esp-10',
        studentId: 'aluno-10',
        topic: 'História Medieval',
        questions: [{ text: 'O que era um feudo?' }],
        status: 'pending',
        assignedAt: new Date().toISOString()
      });
    });

    const studentDb = env.authenticatedContext('aluno-10').firestore();
    const assignmentRef = doc(studentDb, 'users', 'aluno-10', 'assignments', 'ativ-10');

    // Conclusão com campos permitidos -> PERMITIDO
    await assertSucceeds(updateDoc(assignmentRef, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      studentResponses: [{ questionId: 'q1', answer: 'Uma porção de terra administrada por um senhor feudal.' }]
    }));
  });

  // ===========================================================================
  // ITEM 11: Aluno não consegue alterar specialistId, studentId, questions ou permissões
  // ===========================================================================
  await runTest('Item 11: Aluno não consegue alterar specialistId, studentId, questions ou permissões na atividade', async () => {
    await env.withSecurityRulesDisabled(async (adminContext) => {
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-11'), {
        uid: 'aluno-11',
        role: 'student'
      });
      await setDoc(doc(adminContext.firestore(), 'users', 'aluno-11', 'assignments', 'ativ-11'), {
        specialistId: 'esp-original',
        studentId: 'aluno-11',
        topic: 'Química Orgânica',
        questions: [{ text: 'Estrutura do Benzeno' }],
        status: 'pending',
        assignedAt: new Date().toISOString(),
        xp: 200
      });
    });

    const studentDb = env.authenticatedContext('aluno-11').firestore();
    const assignmentRef = doc(studentDb, 'users', 'aluno-11', 'assignments', 'ativ-11');

    // Tentativa de alterar specialistId -> REJEITADO
    await assertFails(updateDoc(assignmentRef, { specialistId: 'esp-hacker' }));

    // Tentativa de alterar studentId -> REJEITADO
    await assertFails(updateDoc(assignmentRef, { studentId: 'outro-aluno' }));

    // Tentativa de alterar questions da atividade -> REJEITADO
    await assertFails(updateDoc(assignmentRef, { questions: [] }));

    // Tentativa de alterar pontuação de XP -> REJEITADO
    await assertFails(updateDoc(assignmentRef, { xp: 50000 }));
  });

  return results;
}
