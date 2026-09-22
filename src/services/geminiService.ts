import { GoogleGenAI, Type } from "@google/genai";
import { QuizConfig, Question, MindMapData } from "../types";
import { getHyperfocusRatio } from "../lib/utils";

let rawKey = "";

if (!rawKey) {
  try {
    // @ts-ignore
    rawKey = import.meta.env?.VITE_GEMINI_API_KEY || "";
  } catch {
    // ignore
  }
}

if (!rawKey) {
  try {
    // @ts-ignore
    rawKey = import.meta.env?.VITE_CUSTOM_GEMINI_KEY || "";
  } catch {
    // ignore
  }
}

if (!rawKey) {
  try {
    // @ts-ignore
    rawKey = process.env?.GEMINI_API_KEY || "";
  } catch {
    // ignore
  }
}

// Aggressively sanitize the key (removes spaces, invisible characters, and accidental quotes)
let cleanKey = "";
if (typeof rawKey === "string") {
  cleanKey = rawKey.replace(/["']/g, '').trim();
}

// Filter out placeholder values and common failure strings
const isPlaceholder = (k: string) => 
  !k || 
  k === "MY_GEMINI_API_KEY" || 
  k === "undefined" || 
  k === "null" || 
  k.length < 10;

const apiKeyToUse = !isPlaceholder(cleanKey) ? cleanKey : "MISSING_KEY";

if (apiKeyToUse === "MISSING_KEY") {
  console.warn("⚠️ HiperReforço: Chave GEMINI_API_KEY não foi encontrada ou é inválida.");
}

const ai = new GoogleGenAI({ apiKey: apiKeyToUse });

const MODEL_NAME = "gemini-3.5-flash"; // Versão recomendada para 2026: ultra veloz e inteligente

// TODO (pós-correção): R3, R4 e R5 exigem persistência de estado entre sessões (ciclos de 10 missões, histórico de falhas e aprovação prévia do educador) e serão implementadas em etapa posterior.
export const SALVAGUARDAS_PEDAGOGICAS = `MÓDULO DE SALVAGUARDAS PEDAGÓGICAS — OBRIGATÓRIO

Este bloco define restrições, gatilhos de alerta e regras de geração que protegem o aluno contra o aprofundamento inadvertido do hiperfoco. Ele tem precedência sobre qualquer instrução de engajamento ou gamificação definida anteriormente neste prompt.

---

PRINCÍPIO-CHAVE: HIPERFOCO COMO ENTRADA, NÃO COMO DESTINO

O hiperfoco é um ponto de partida — nunca um ambiente permanente.
Toda missão gerada deve ter uma direção vetorial clara: do hiperfoco em direção a competências curriculares neutras (transferíveis). Missões que aprofundam o hiperfoco sem criar ponte curricular são proibidas.

Regra operacional: antes de finalizar qualquer conteúdo gerado, verifique internamente:
  → Esta missão aproxima o aluno de competências que ele precisará SEM o hiperfoco?
  → Ou ela apenas reembala o hiperfoco com vocabulário acadêmico?

Se a resposta à segunda pergunta for SIM, reformule antes de retornar.

---

REGRAS DE GERAÇÃO DE CONTEÚDO

R1 — Limite de saturação temática por sessão
Máximo de 60% das missões de uma sessão podem estar encapsuladas no universo do hiperfoco.
As demais 40% devem usar contextos neutros ou alternativos (não necessariamente o hiperfoco).
Se o educador não definir contextos alternativos, gere os 40% com cenários do cotidiano escolar.

R2 — Obrigatoriedade da "missão de transferência"
A cada 3 missões dentro do hiperfoco, a 4ª deve ser uma "missão de transferência":
mesma competência curricular, contexto completamente diferente, sem referência ao hiperfoco.
Sinalize esta missão com a tag interna [TRANSFERÊNCIA] no metadado da missão.
No painel do educador, exiba: "Missão de transferência — avalia aplicação fora do contexto preferido."

R3 — Progressão obrigatória para território neutro
A cada ciclo de 10 missões concluídas, o sistema deve incluir ao menos 1 missão de
"território neutro": conteúdo sem nenhuma ancoragem no hiperfoco, com dificuldade calibrada.
Finalidade: medir se a aprendizagem está ocorrendo de forma generalizável.

R4 — Proibição de regressão temática por falha
Se o aluno errar em missões de território neutro, o sistema NÃO deve retornar automaticamente
ao hiperfoco como "recompensa de consolo". Este padrão treina evitação de novos contextos.
Em caso de erro repetido em território neutro, acione o Alerta AP-3 (ver abaixo) e aguarde
orientação do educador antes de gerar a próxima missão.

R5 — Validação obrigatória antes de missões de hiperfoco intenso
Missões classificadas internamente como "imersão profunda" (> 80% do conteúdo dentro do
universo do hiperfoco) devem ser sinalizadas para aprovação do educador antes de serem
liberadas ao aluno. Não libere automaticamente.`;

export interface QuizResponse {
  questions: Question[];
  themedRankings: string[];
}

export async function testApiKeyStatus(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Responda 'OK'."
    });
    if (response.text?.includes("OK")) {
      return { success: true, message: "A chave API do Gemini está configurada e funcionando perfeitamente!" };
    }
    return { success: true, message: "A chave funcionou, mas a resposta foi imprevista." };
  } catch (error: any) {
    console.error("Test API Key Error:", error);
    if (error.status === 429) {
      return { success: false, message: "A chave da API atingiu o limite de requisições (Quota Exceeded / Free Tier limit)." };
    }
    if (error.status === 404) {
      return { success: false, message: "Modelo não encontrado (Pode estar configurado um modelo incorreto)." };
    }
    if (error.message?.includes("API_KEY_INVALID")) {
      return { success: false, message: "A chave da API informada é inválida." };
    }
    return { success: false, message: `Erro ao testar a chave: ${error.message || "Erro desconhecido"}` };
  }
}

export async function checkInappropriateContent(text: string): Promise<boolean> {
  if (!text || text.trim() === '') return true; 
  
  const prompt = `Você é um moderador de conteúdo para uma plataforma educacional infantil.
Analise se o seguinte termo ou tema é adequado para ser usado como tema de estudo ou hiperfoco por uma criança de 6 a 14 anos em contexto escolar: "${text}".

REGRAS DE CLASSIFICAÇÃO:
- Classifique como "UNSAFE" APENAS se contiver: conteúdo sexual, violência gráfica, drogas ilícitas, discurso de ódio, automutilação ou linguagem obscena.
- Classifique explicitamente como "SAFE" temas infantis legítimos como videogames, terror leve infantojuvenil, armas em contexto histórico e animais predadores.

FORMATO OBRIGATÓRIO:
Responda com uma ÚNICA PALAVRA: exatamente "SAFE" ou "UNSAFE".`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0,
      }
    });
    
    const output = (response.text || "SAFE").trim().toUpperCase();
    return !output.startsWith("UNSAFE");
  } catch (error) {
    console.warn("Filtro de conteúdo indisponível — termo liberado por fail-open");
    return true; 
  }
}

export async function generateExpansionReport(answers: any): Promise<string> {
  const prompt = `Você é o HIPER, assistente especializado do projeto HiperReforço — uma plataforma EdTech de inclusão que usa os hiperfocos de crianças neurodivergentes (TDAH, TEA e perfis similares) como ponto de entrada para a aprendizagem.

SEU PAPEL:
Você vai ler os dados preenchidos no questionário e gerar um RELATÓRIO DE EXPANSÃO DE HIPERFOCO com sugestões de novos temas que a criança pode explorar, respeitando seu perfil e sem romper abruptamente com o que já a engaja.

Respostas do Questionário:
P1. Nome e idade: ${answers.p1_nameAge}
P2. Hiperfoco PRINCIPAL: ${answers.p2_mainFocus}
P3. Tempo/Intensidade: ${answers.p3_intensity}
P4. Hiperfoco ANTERIOR: ${answers.p4_previousFocus || 'Não informado'}
P5. Assunto secundário: ${answers.p5_secondaryFocus || 'Não informado'}
P6. Rejeições (Não gosta): ${answers.p6_dislikes || 'Não informado'}
P7. Como aprende melhor: ${(answers.p7_learningStyles || []).join(', ')}
P8. Ano escolar/escola: ${answers.p8_school}
P9. Diagnóstico: ${answers.p9_diagnosis || 'Não informado'}
P10. Desafio atual: ${answers.p10_challenges || 'Não informado'}

ESTRUTURA DO RELATÓRIO (Gere no formato Markdown usando EXATAMENTE os blocos abaixo):

---

# 🧩 Relatório de Expansão de Hiperfoco
**Criança:** [nome da criança] | **Idade:** [idade] | **Hiperfoco atual:** [tema]
**Data:** [data de hoje]

---

## 🔍 Análise do Perfil
[Parágrafo de 4-6 linhas descrevendo o perfil: como ela aprende, o que a engaja, o que a desengaja, e qual a oportunidade de expansão.]

---

## 🌉 Pontes Temáticas Sugeridas
(Mínimo 4, Máximo 6 sugestões)
Para CADA sugestão, use este bloco EXATO:

### [Emoji temático] Sugestão [N]: [Nome do Tema]
**Nível de proximidade:** [🟢 Adjacente | 🟡 Exploratório | 🔴 Novo Território]
**Por que faz sentido para [nome]:** [2-3 frases conectando tema ao perfil]
**Como introduzir:**
- 🎯 Atividade inicial (curta, baixo risco): [descrição prática]
- 📚 Material de entrada sugerido: [ex: livro, vídeo, jogo interativo]
- 🔗 Gancho com o hiperfoco atual: [frase/pergunta de conexão]
**Alerta pedagógico:** [se houver ponto de atenção]

---

## 📋 Tabela Resumo
(Crie uma tabela Markdown com colunas: #, Tema Sugerido, Nível, Ponte Principal, Formato Preferencial)

---

## 💡 Estratégia de Transição Recomendada
[Parágrafo 5-7 linhas sobre COMO introduzir os novos temas sem gerar resistência.]

---

## ⚠️ O Que Evitar
- [Item 1 baseado nas rejeições e desafios relatados]
- [Item 2...]
- [Item 3...]

---
*Relatório gerado pelo módulo HiperReforço — Expansão de Hiperfocos*
*Para uso educacional. Não substitui avaliação clínica especializada.*

REGRAS:
- O relatório OBRIGATORIAMENTE deve ser redigido em PORTUGUÊS DO BRASIL.
- Nunca sugira temas rejeitados.
- Respeite as preferências de aprendizado.
- O tom deve ser profissional, empático e aplicável no dia a dia.
- Nomes dos hiperfocos e analogias sólidas.
- NUNCA mencione o diagnóstico diretamente no corpo do relatório como um rótulo. Apenas use para calibrar a leitura da IA.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    });
    return response.text || 'Erro ao gerar o relatório.';
  } catch (err: any) {
    if (err.status === 429) {
       return "Erro: O limite de requisições gratuitas foi atingido. Aguarde alguns minutos e tente novamente.";
    }
    console.error("Gemini API Error in generateExpansionReport:", err);
    throw new Error('Falha ao gerar o relatório com a IA.');
  }
}

export async function generateQuizQuestions(config: QuizConfig, gender?: string, completedQuizzes: number = 0): Promise<QuizResponse> {
  const isGeneric = !config.focus || config.focus.toLowerCase() === 'genérico' || config.focus.toLowerCase() === 'vário';
  const hyperfocusRatio = getHyperfocusRatio(completedQuizzes);
  
  const focusContext = isGeneric 
    ? `MODO SIMULADO ESCOLAR (Questões tradicionais e genéricas de sala de aula, sem usar personagens ou mundos de ficção). Adapte a linguagem para o gênero ${gender || 'neutro'}.`
    : `com hiperfoco em "${config.focus}"`;

  const integrationDirective = isGeneric
    ? `- Crie questões com o cenário de sala de aula e temas gerais da vida real.
       - Use exemplos clássicos de livros didáticos.
       - Garanta que as questões preparem o aluno para o formato de prova oficial da escola.`
    : `- Integre elementos de "${config.focus}" em TODAS as questões como contexto principal.
       - Use os personagens/termos do hiperfoco para tornar o problema concreto.`;

  const analogyDirective = isGeneric
    ? `- **A Conexão com o Mundo**: Uma curiosidade sobre o tema no dia a dia para contextualizar a explicação.`
    : `- **Analogia Direta**: Na explicação da resposta da questão, crie OBRIGATORIAMENTE uma analogia direta, forte e clara relacionando o conceito ensinado com "${config.focus}". Isso garante um aprendizado contextualizado.`;

  const SYSTEM_BLINDAGEM = `Você é o MOTOR PEDAGÓGICO do HiperReforço, plataforma de educação inclusiva para
aprendentes neurodivergentes (TDAH/TEA) do Ensino Fundamental brasileiro. Você gera
quizzes escolares. Sua reputação depende de DUAS garantias inegociáveis:
(A) NENHUM fato inventado. (B) TODA questão rigorosamente calibrada ao Ano Escolar.

═══════════════════════════════════════════════════
BLOCO 1 — TRAVA DE ANO ESCOLAR (PRIORIDADE MÁXIMA)
═══════════════════════════════════════════════════

O Ano Escolar informado define um TETO COGNITIVO ABSOLUTO. Use esta matriz de
calibragem como contrato. Idades de referência: ano escolar + 5 (ex.: 3º ano ≈ 8 anos).

1º–2º ano: Alfabetização. Frases de até 15 palavras, ordem direta. Matemática até 100, adição/subtração sem reagrupamento complexo. Bloom máximo: LEMBRAR e COMPREENDER. Zero abstração; tudo concreto/visual.
3º–5º ano: Consolidação. Frases de até 25 palavras, máx 1 oração subordinada. Matemática: 4 operações, frações simples (3º-4º), decimais básicos (5º). Bloom máximo: APLICAR.
6º–7º ano: Transição. Enunciados de até 40 palavras. Matemática: números negativos, potências, equações de 1º grau (7º), razão/proporção. Bloom máximo: ANALISAR.
8º–9º ano: Pré-Médio. Enunciados analíticos. Matemática: sistemas, equação 2º grau (9º), noções de função. Bloom máximo: AVALIAR.

REGRAS DE APLICAÇÃO:
1.1 Identifique mentalmente a habilidade da BNCC do ano informado. Se o tema for acima do ano, REBAIXE para a porta de entrada BNCC do ano.
1.2 Se for abaixo do ano, trate como revisão (eleve a complexidade do contexto).
1.3 A dificuldade solicitada varia DENTRO do teto do ano. Nunca use conteúdo de anos posteriores.
1.4 TESTE DO ALUNO TÍPICO: resolvível por um aluno do ano informado, SEM conhecimento de anos posteriores.

═══════════════════════════════════════════════════
BLOCO 2 — PROTOCOLO ANTI-ALUCINAÇÃO
═══════════════════════════════════════════════════

2.1 Use apenas fatos de consenso curricular (livro MEC/BNCC). PROIBIDO inventar fatos.
2.2 TESTE DE CONFIANÇA: sem certeza TOTAL, descarte o fato e construa sobre outro.
2.3 O hiperfoco é EMBALAGEM NARRATIVA, nunca fonte acadêmica. O fato acadêmico avaliado deve permanecer verdadeiro se o hiperfoco for removido. Afirme apenas características amplamente conhecidas do hiperfoco. NUNCA misture regras do jogo com física real. A resposta correta é a do mundo real/matéria.
2.4 MATERIAL DE APOIO: prevalece sobre seu conhecimento.
2.5 EXPLICAÇÕES ("Ponte Didática"): O fato acadêmico em **negrito** (verificável em livro), seguido da analogia.

═══════════════════════════════════════════════════
BLOCO 3 — ENGENHARIA DAS ALTERNATIVAS
═══════════════════════════════════════════════════

3.1 Exatamente UMA correta.
3.2 Distratores = erros conceituais TÍPICOS do ano. Proibido: alternativas absurdas, jocosas, "todas", "nenhuma".
3.3 Alternativas homogêneas em tamanho. Posição aleatória da correta.
3.4 Linguagem inclusiva: enunciados diretos, sem dupla negação, um comando por questão.

═══════════════════════════════════════════════════
BLOCO 4 — AUTOAUDITORIA OBRIGATÓRIA (ANTES DE RESPONDER)
═══════════════════════════════════════════════════

Execute silenciosamente:
✓ Existe exatamente UMA correta? Distratores são plausíveis?
✓ Passa no TESTE DO ALUNO TÍPICO do ano?
✓ Passa no TESTE DE CONFIANÇA de fatos?
✓ A explicação justifica a alternativa?
✓ Cálculos batem ao refazer do zero?`;

  const prompt = `${SALVAGUARDAS_PEDAGOGICAS}

Estas salvaguardas têm precedência sobre qualquer instrução de engajamento ou gamificação a seguir.

INSTRUÇÕES DE EXECUÇÃO DAS REGRAS R1 E R2 PARA ESTA SESSÃO:
- Do total de ${config.count} questões, no máximo 60% devem usar o universo do hiperfoco ("${config.focus}") e as demais devem usar contexto neutro de cotidiano escolar.
- A cada 3 questões ancoradas no hiperfoco, a 4ª deve ser obrigatoriamente uma missão de transferência — mesma competência curricular, porém em contexto completamente diferente, sem qualquer referência ao hiperfoco.
- O campo booleano 'isTransferMission' deve ser marcado obrigatoriamente como true exatamente nas questões de transferência, e como false nas demais.
- O campo 'contextType' deve ser "transfer" nas missões de transferência, "hyperfocus" nas questões ancoradas no hiperfoco, e "neutral" nas de contexto neutro de cotidiano escolar.

DADOS DA SESSÃO:
- Ano Escolar: ${config.grade} do Ensino Fundamental  ← TETO COGNITIVO (Bloco 1)
- Matéria: ${config.subject}
- Tema: ${config.topic}
- Contexto: ${focusContext}
- Dificuldade (dentro do teto do ano): ${config.difficulty}
- Quantidade: ${config.count} questões

${config.materialContext ? 'MATERIAL DE APOIO FORNECIDO: aplique a regra 2.4 — o material é a fonte primária.' : ''}

DIRETRIZES DE QUALIDADE E INTEGRAÇÃO DO TEMA:
${integrationDirective}
${analogyDirective}

FORMATOS: varie os tipos de questão sequencialmente conforme a lista de 13 formatos
(Resposta Única → V/F com justificativa → Associação de colunas → ...), reiniciando
o ciclo se count > 13.
- Tipo 1: Resposta Única (Padrão)
- Tipo 2: Verdadeiro/Falso com Justificativa
- Tipo 3: Associação de Colunas
- Tipo 4: Preencher Lacunas (Simples)
- Tipo 5: Preencher Lacunas (Múltiplas)
- Tipo 6: Ordenação / Sequência Lógica
- Tipo 7: Interpretação de Imagem (Descreva a imagem no enunciado)
- Tipo 8: Analogia
- Tipo 9: Afirmação Incorreta / Exceção
- Tipo 10: Assertiva-Razão
- Tipo 11: Interpretação de Fonte
- Tipo 12: Qual a Melhor Solução (Situação-problema)
- Tipo 13: Afirmativas Combinadas (I, II, III...)

Antes de emitir, execute a AUTOAUDITORIA (Bloco 4).
Sugira 4 nomes de ranking combinando "${config.focus}" com excelência acadêmica.
Responda EXCLUSIVAMENTE com o JSON no schema fornecido, em Português do Brasil.`;

  const parts: any[] = [{ text: prompt }];

  if (config.materialContext?.inlineData) {
    parts.push({
      inlineData: config.materialContext.inlineData
    });
  } else if (config.materialContext?.text) {
    parts.push({
      text: `MATERIAL DE APOIO:\n${config.materialContext.text}`
    });
  }

  let attempts = 0;
  while (attempts < 2) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME, 
        contents: parts,
        config: {
          systemInstruction: SYSTEM_BLINDAGEM,
          temperature: 0.35,
          topP: 0.9,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    options: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING }
                    },
                    correctAnswerIndex: { type: Type.NUMBER },
                    explanation: { type: Type.STRING },
                    contextType: { type: Type.STRING, enum: ["hyperfocus", "transfer", "neutral"], description: "Deve ser hyperfocus, transfer ou neutral." },
                    isTransferMission: { type: Type.BOOLEAN, description: "Campo booleano obrigatório: true exatamente nas questões de transferência (mesma competência, sem referência ao hiperfoco), e false nas demais." }
                  },
                  required: ["id", "text", "options", "correctAnswerIndex", "explanation", "contextType", "isTransferMission"]
                }
              },
              themedRankings: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["questions", "themedRankings"]
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Resposta vazia da IA");
      
      const data = JSON.parse(text);
      
      // VALIDAÇÃO PÓS-GERAÇÃO: Salvaguardas Pedagógicas
      if (data.questions && data.questions.length > 0) {
        if (isGeneric) {
          data.questions.forEach((q: any) => {
            q.contextType = 'neutral';
            q.isTransferMission = false;
          });
        } else {
          // Enforce positions 4 and 8 as transfer BEFORE counting
          if (data.questions.length >= 4) {
             data.questions[3].contextType = 'transfer';
             data.questions[3].isTransferMission = true;
          }
          if (data.questions.length >= 8) {
             data.questions[7].contextType = 'transfer';
             data.questions[7].isTransferMission = true;
          }
        
          let hyperfocusCount = 0;
          data.questions.forEach((q: any) => {
            if (!q.contextType) q.contextType = 'hyperfocus';
            if (q.isTransferMission === undefined) {
              q.isTransferMission = (q.contextType === 'transfer');
            }
            if (q.isTransferMission) {
              q.contextType = 'transfer';
            }
            if (q.contextType === 'hyperfocus') hyperfocusCount++;
          });
          
          const maxHyperfocus = Math.floor(data.questions.length * 0.6);
          const ratio = hyperfocusCount / data.questions.length;
          if (ratio > 0.6) {
            if (attempts === 0) {
              console.warn(`[Salvaguardas] Quiz gerou ${Math.round(ratio*100)}% de hiperfoco (teto R1: 60%). Regenerando (retry 1)...`);
              attempts++;
              continue; // Retry
            } else {
              console.warn(`[Salvaguardas] Retry falhou. Forçando reclassificação programática conforme R1...`);
              let currentHyperfocus = hyperfocusCount;
              for (const q of data.questions) {
                 if (q.contextType === 'hyperfocus' && currentHyperfocus > maxHyperfocus) {
                   q.contextType = 'transfer';
                   q.isTransferMission = true;
                   currentHyperfocus--;
                 }
              }
            }
          }
        }
      }
      
      return data;
    } catch (error) {
      if (attempts === 0) {
        attempts++;
        continue;
      }
      console.error("Error generating quiz:", error);
      throw error;
    }
  }
}

export async function generateInterestSurvey(grade: string, gender: string = 'neutro'): Promise<any[]> {
  const prompt = `Crie um questionário de 5 perguntas de múltipla escolha para descobrir o interesse (hiperfoco) de uma criança no ${grade} do gênero ${gender}.
As perguntas devem cobrir categorias como: Heróis, Animais, Tecnologia/Games, Natureza, Esportes, Espaço, História, Arte.
Faça as perguntas mais engajadoras de acordo com a faixa etária e o gênero ${gender}.

Cada pergunta deve ter 4 opções.
Cada opção deve vir acompanhada de uma TAG de categoria interna para análise posterior.

Retorne um JSON seguindo este esquema: Array<{ id: string, text: string, options: Array<{ text: string, category: string }> }>

Linguagem acolhedora e divertida para a idade ${grade}.
IMPORTANTE: Todo o texto das perguntas, opções e categorias deve ser EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    category: { type: Type.STRING }
                  },
                  required: ["text", "category"]
                }
              }
            },
            required: ["id", "text", "options"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error generating interest survey:", error);
    return [];
  }
}

export async function analyzeInterests(answers: string[]): Promise<any> {
  const prompt = `Com base nas seguintes categorias de interesse escolhidas por uma criança: [${answers.join(', ')}].
Sugira 3 temas de hiperfoco específicos e criativos que poderiam ser usados para personalizar seu material de estudo.

Para cada tema, forneça:
1. Nome do tema
2. Breve descrição de por que combina com os interesses
3. Um emoji que represente o tema

Retorne um JSON: { suggestedThemes: Array<{ name: string, description: string, icon: string }> }
IMPORTANTE: Todo o conteúdo (nome e descrição) deve ser EXCLUSIVAMENTE EM PORTUGUÊS DO BRASIL.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedThemes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  icon: { type: Type.STRING }
                },
                required: ["name", "description", "icon"]
              }
            }
          },
          required: ["suggestedThemes"]
        }
      }
    });

    return JSON.parse(response.text || '{"suggestedThemes": []}');
  } catch (error) {
    console.error("Error analyzing interests:", error);
    return { suggestedThemes: [] };
  }
}

export async function generateRewardQuiz(focus: string, grade: string): Promise<Question[]> {
  const prompt = `Você é um especialista no tema "${focus}". 
Crie um quiz de RECOMPENSA para uma criança do ${grade} que acabou de estudar.
O quiz deve ser EXCLUSIVAMENTE sobre curiosidades e fatos divertidos de "${focus}".

Gere 3 questões divertidas.
O tom deve ser de celebração e entusiasmo.
Adapte a linguagem para a idade (${grade}).

As questões devem ser em Português do Brasil.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }
              },
              correctAnswerIndex: { type: Type.NUMBER },
              explanation: { type: Type.STRING }
            },
            required: ["id", "text", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Falha ao gerar quiz de recompensa");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating reward quiz:", error);
    throw error;
  }
}

export async function generateAvatarImage(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: {
        parts: [
          {
            text: `Create a friendly, colorful, student-focused avatar icon for a learning app. 
            The style should be a mix of minimalist and playful, perfect for kids and teens. 
            Topic: ${prompt}. 
            Only show the head and shoulders, on a clean, solid background. No text.`,
          },
        ],
      },
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
    }
    throw new Error("Não foi possível gerar o avatar. Tente outra descrição.");
  } catch (error) {
    console.error("Error generating avatar:", error);
    throw error;
  }
}

export async function getSupportResponse(userMessage: string, history: { role: 'user' | 'model', parts: [{ text: string }] }[] = []): Promise<string> {
  const faqContext = `Você é o assistente de suporte oficial do HiperReforço. 
Sua missão é ajudar pais, alunos e professores a usarem a plataforma.
O HiperReforço é uma plataforma de aprendizagem para crianças neurodivergentes (TDAH/Autismo) que usa o hiperfoco como motor de estudo.

RESPOSTAS FREQUENTES:
- O que é?: Plataforma que transforma temas preferidos (Minecraft, Dinos) em questões escolares.
- Como criar quiz?: Na tela inicial, preencha Matéria, Tema e o Hiperfoco atual.
- Materiais (Apostilas): Pais podem subir PDFs ou DOCX para que o quiz siga exatamente o que cai na prova da escola.
- Área do Especialista: Onde professores criam missões dirigidas e acompanham o progresso.
- Prêmios: Quizzes de recompensa sobre o hiperfoco ganhos ao estudar.
- Acessibilidade: O menu lateral permite desativar cronômetros e ajustar fontes.

Responda de forma curta, acolhedora e use emojis. No final de cada resposta, incentive o aprendizado.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] }
      ],
      config: {
        systemInstruction: faqContext
      }
    });
    return response.text || "Desculpe, estou com dificuldades para responder agora. Tente novamente em instantes!";
  } catch (error) {
    console.error("Support chat error:", error);
    return "Ops! Tive um probleminha técnico. Pode repetir a pergunta?";
  }
}

export async function analyzeDocumentContent(textOrContext: string | { inlineData: { data: string, mimeType: string } }): Promise<{ subject: string; topic: string }> {
  try {
    let parts: any[] = [];
    const prompt = `Analise o seguinte conteúdo de material didático e identifique a MATÉRIA e o TEMA ESPECÍFICO (tópico).
Considere as matérias: Português, Matemática, Raciocínio Lógico, História, Geografia, Ciências, Inglês, Artes.
Se não for uma dessas, escolha a mais próxima ou "Ciências" para temas gerais.

Responda APENAS em JSON no formato:
{
  "subject": "Nome da Matéria",
  "topic": "Descrição curta do tema"
}`;

    if (typeof textOrContext === 'string') {
      parts = [{ text: prompt }, { text: `TEXTO:\n"${textOrContext.substring(0, 5000)}"` }];
    } else {
      parts = [{ text: prompt }, textOrContext];
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
      }
    });

    let jsonString = response.text || '{}';
    // Remove markdown code block syntax if present
    jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const result = JSON.parse(jsonString);
    return {
      subject: result.subject || 'Português',
      topic: result.topic || ''
    };
  } catch (error) {
    console.error("Error analyzing document content:", error);
    return { subject: 'Português', topic: '' };
  }
}

export async function generateMindMap(subject: string, topic: string, wrongQuestions: { text: string; explanation: string }[]): Promise<MindMapData> {
  const prompt = `Você é um especialista em educação pedagógica e facilitação visual para alunos com TDAH.
Crie um MAPA MENTAL estruturado sobre o tema "${topic}" da matéria "${subject}".

IMPORTANTÍSSIMO: Foram identificados erros do aluno nos seguintes tópicos:
${wrongQuestions.map(q => `- ${q.text} (Explicação: ${q.explanation})`).join('\n')}

DIRETRIZES PARA O MAPA MENTAL:
1. O nó raiz (id: "root") deve ser o tema "${topic}".
2. Crie 3 a 4 ramos principais (main nodes) abordando os subtemas fundamentais.
3. Para cada ramo, crie 2 a 3 subtemas (sub nodes).
4. Utilize os erros do aluno para criar ramos específicos que chamem a atenção (type: "error"), destacando o que ele precisa estudar mais.
5. As labels devem ser curtas e diretas (máximo 4 palavras).
6. Adicione uma "explanation" curta e amigável para os nós que representam os erros (type: "error").

Retorne APENAS um JSON no formato:
{
  "nodes": [
    { "id": "string", "label": "string", "type": "root|main|sub|error", "explanation": "string (opcional)" }
  ],
  "edges": [
    { "id": "string", "source": "id_origem", "target": "id_destino" }
  ]
}

Garanta que os IDs sejam únicos e os edges conectem os IDs existentes.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    let jsonString = response.text || '{"nodes": [], "edges": []}';
    jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(jsonString);
    
    // Safety check for root node
    if (!result.nodes.find((n: any) => n.id === 'root')) {
      result.nodes.unshift({ id: 'root', label: topic, type: 'root' });
    }

    return result as MindMapData;
  } catch (error) {
    console.error("Error generating mind map:", error);
    return {
      nodes: [
        { id: 'root', label: topic, type: 'root' },
        { id: 'm1', label: 'Conceitos Básicos', type: 'main' },
        { id: 'sub1', label: 'Definição', type: 'sub' }
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'm1' },
        { id: 'e2', source: 'm1', target: 'sub1' }
      ]
    };
  }
}
