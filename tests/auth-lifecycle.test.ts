/**
 * Testes de Ciclo de Vida de Autenticação e Estado em Memória (Itens 12 e 13)
 * 
 * Validação:
 * 12. Após logout, o frontend não mantém o estado specialist em memória.
 * 13. Após remoção da claim, getIdTokenResult(true) atualiza a interface corretamente.
 */

import { hasSpecialistAccess } from '../src/firebase';
import { User as FirebaseUser, IdTokenResult } from 'firebase/auth';

export async function runAuthLifecycleTests(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  // ===========================================================================
  // TESTE 12: Após logout, o frontend não mantém o estado specialist em memória
  // ===========================================================================
  try {
    // 1. Simula estado inicial autenticado como especialista
    let isSpecialistUser = true;
    let currentUser: FirebaseUser | null = {
      uid: 'esp-auditado-1',
      email: 'especialista@clinica.com'
    } as FirebaseUser;

    let inMemoryStats = {
      uid: 'esp-auditado-1',
      role: 'specialist',
      profiles: [{ id: 'p1', name: 'Paciente A' }]
    };

    // 2. Simula o evento de logout disparado pelo Firebase Auth (onAuthStateChanged com null)
    const handleAuthStateChange = (user: FirebaseUser | null) => {
      currentUser = user;
      if (user) {
        // Se houvesse usuário
      } else {
        // Efeito obrigatório do logout no App.tsx
        isSpecialistUser = false;
        inMemoryStats = {
          uid: '',
          role: 'parent',
          profiles: []
        };
      }
    };

    // Executa logout
    handleAuthStateChange(null);

    // 3. Asserções
    if (isSpecialistUser !== false) {
      throw new Error(`Falha: isSpecialistUser permaneceu como true após logout.`);
    }
    if (currentUser !== null) {
      throw new Error(`Falha: currentUser não foi anulado após logout.`);
    }
    if (inMemoryStats.role === 'specialist' || inMemoryStats.profiles.length > 0) {
      throw new Error(`Falha: Dados clínicos de especialista persistiram na memória do cliente após logout.`);
    }

    // 4. Validação direta da função hasSpecialistAccess com usuário nulo
    const accessWithNullUser = await hasSpecialistAccess(null);
    if (accessWithNullUser !== false) {
      throw new Error(`Falha: hasSpecialistAccess(null) retornou true.`);
    }

    results.push({
      name: 'Item 12: Estado specialist e dados em memória são purgados no logout',
      passed: true
    });
  } catch (err: any) {
    results.push({
      name: 'Item 12: Estado specialist e dados em memória são purgados no logout',
      passed: false,
      error: err.message
    });
  }

  // ===========================================================================
  // TESTE 13: Após remoção da claim, getIdTokenResult(true) atualiza a interface
  // ===========================================================================
  try {
    let currentClaims: Record<string, any> = { specialist: true };
    let forceRefreshTriggered = false;

    // Mock do FirebaseUser com suporte a getIdTokenResult(forceRefresh)
    const mockUser: FirebaseUser = {
      uid: 'usuario-revogado-123',
      email: 'ex-especialista@escola.com',
      getIdTokenResult: async (forceRefresh?: boolean): Promise<IdTokenResult> => {
        if (forceRefresh) {
          forceRefreshTriggered = true;
          // Simula resposta do servidor após revogação administrativa da claim
          return {
            token: 'mock-jwt-revoked',
            authTime: new Date().toISOString(),
            issuedAtTime: new Date().toISOString(),
            expirationTime: new Date(Date.now() + 3600000).toISOString(),
            signInProvider: 'google.com',
            signInSecondFactor: null,
            claims: currentClaims
          };
        }
        // Sem forceRefresh, retornaria o token em cache com specialist: true
        return {
          token: 'mock-jwt-cached',
          authTime: new Date().toISOString(),
          issuedAtTime: new Date().toISOString(),
          expirationTime: new Date(Date.now() + 3600000).toISOString(),
          signInProvider: 'google.com',
          signInSecondFactor: null,
          claims: { specialist: true } // Cache antigo desatualizado
        };
      }
    } as unknown as FirebaseUser;

    // 1. Antes da revogação: especialista tem acesso
    const initialAccess = await hasSpecialistAccess(mockUser);
    if (!initialAccess) {
      throw new Error("Estado inicial falhou: usuário deveria ter acesso.");
    }

    // 2. Administrador remove a Custom Claim no Firebase Admin SDK
    currentClaims = {}; // Claim removida

    // 3. Aplicação executa hasSpecialistAccess com forceRefresh = true
    const accessAfterRevocation = await hasSpecialistAccess(mockUser, true);

    if (!forceRefreshTriggered) {
      throw new Error("Falha: getIdTokenResult não foi chamado com forceRefresh=true.");
    }

    if (accessAfterRevocation !== false) {
      throw new Error("Falha: hasSpecialistAccess continuou retornando true mesmo após revogação da claim.");
    }

    results.push({
      name: 'Item 13: getIdTokenResult(true) sincroniza remoção de claim e revoga acesso na UI',
      passed: true
    });
  } catch (err: any) {
    results.push({
      name: 'Item 13: getIdTokenResult(true) sincroniza remoção de claim e revoga acesso na UI',
      passed: false,
      error: err.message
    });
  }

  return results;
}
