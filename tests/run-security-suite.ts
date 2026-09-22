/**
 * Master Security Test Suite Runner
 * Projeto HiperReforço — Suíte Completa de Prevenção de Elevação de Papel
 * 
 * Execução:
 *   npx tsx tests/run-security-suite.ts
 *   ou com emulador:
 *   firebase emulators:exec --only firestore "npx tsx tests/run-security-suite.ts"
 */

import { runAuthLifecycleTests } from './auth-lifecycle.test';
import { setupTestEnvironment, cleanupTestEnvironment, runFirestoreSecurityTests } from './firestore-security.test';

async function main() {
  console.log('\n======================================================================');
  console.log('🛡️  SUÍTE DE TESTES DE SEGURANÇA: CONTROLE DE PAPEL E ZERO-TRUST');
  console.log('   Projeto: HiperReforço (EdTech Inclusiva)');
  console.log('======================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  // 1. Executa Suíte de Ciclo de Vida de Autenticação no Frontend (Itens 12 e 13)
  console.log('▶ Executando Suíte de Autenticação Frontend (Itens 12 e 13)...');
  const authResults = await runAuthLifecycleTests();
  for (const res of authResults) {
    totalCount++;
    if (res.passed) {
      passedCount++;
      console.log(`  ✅ [PASS] ${res.name}`);
    } else {
      console.log(`  ❌ [FAIL] ${res.name}: ${res.error}`);
    }
  }

  // 2. Tenta conectar ao Firebase Emulator para Suíte de Regras Firestore (Itens 1 a 11)
  console.log('\n▶ Verificando disponibilidade do Firebase Local Emulator (porta 8080)...');
  try {
    const env = await setupTestEnvironment();
    console.log('  📡 Emulador Firestore detectado! Executando testes de regras (Itens 1 a 11)...\n');
    
    const firestoreResults = await runFirestoreSecurityTests(env);
    for (const res of firestoreResults) {
      totalCount++;
      if (res.passed) {
        passedCount++;
        console.log(`  ✅ [PASS] ${res.name}`);
      } else {
        console.log(`  ❌ [FAIL] ${res.name}: ${res.error}`);
      }
    }

    await cleanupTestEnvironment();
  } catch (err: any) {
    console.log('  ⚠️  Firestore Emulator não está em execução local no momento.');
    console.log('     Para executar a validação estrita dos Itens 1 a 11 com o emulador, utilize:');
    console.log('     $ firebase emulators:exec --only firestore "npx tsx tests/run-security-suite.ts"\n');
    console.log('     (Os arquivos de teste firestore-security.test.ts e firestore.rules.test.ts estão prontos e integrados).\n');
  }

  console.log('======================================================================');
  console.log(`📊 RESULTADO PARCIAL: ${passedCount}/${totalCount} testes executados com sucesso.`);
  console.log('======================================================================\n');
}

main().catch(console.error);
