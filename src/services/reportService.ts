import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserStats, QuizHistoryEntry } from '../types';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const updateLeaderboardEntry = async (params: { userId: string; name: string; xp: number; level: number; avatarUrl: string }) => {
  try {
    const leaderboardRef = doc(db, 'leaderboard', params.userId);
    await setDoc(leaderboardRef, {
      ...params,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating leaderboard entry:", error);
  }
};

export const generatePedagogicalReport = (stats: UserStats, history: QuizHistoryEntry[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(63, 81, 181); // Primary color
  doc.text('Relatório Pedagógico - HiperReforço', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' });

  // Student Info
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Informações do Aluno', 20, 45);
  doc.setFontSize(11);
  doc.text(`Nível: ${stats.level}`, 20, 52);
  doc.text(`XP Total: ${stats.xp}`, 20, 58);
  doc.text(`Total de Acertos: ${stats.totalCorrect}`, 20, 64);
  doc.text(`Total de Questões: ${stats.totalQuestions}`, 20, 70);

  // Generalization Metrics Calculation
  let hyperfocusQuestions = 0;
  let hyperfocusCorrect = 0;
  let transferQuestions = 0;
  let transferCorrect = 0;
  let neutralQuestions = 0;
  let neutralCorrect = 0;

  history.forEach((entry) => {
    if (entry.questions && entry.questions.length > 0) {
      entry.questions.forEach((q: any) => {
        const context = q.contextType || "hyperfocus";
        const response = entry.responses?.find((r: any) => r.questionId === q.id);
        const isCorrect = response && (response.answer === q.correctAnswer || (q.options && q.correctAnswerIndex !== undefined && response.answer === q.options[q.correctAnswerIndex]));

        if (context === "hyperfocus") {
          hyperfocusQuestions++;
          if (isCorrect) hyperfocusCorrect++;
        } else if (context === "transfer") {
          transferQuestions++;
          if (isCorrect) transferCorrect++;
        } else if (context === "neutral") {
          neutralQuestions++;
          if (isCorrect) neutralCorrect++;
        }
      });
    }
  });

  const hyperfocusPct = hyperfocusQuestions > 0 ? Math.round((hyperfocusCorrect / hyperfocusQuestions) * 100) : 0;
  const transferPct = transferQuestions > 0 ? Math.round((transferCorrect / transferQuestions) * 100) : 0;
  const neutralPct = neutralQuestions > 0 ? Math.round((neutralCorrect / neutralQuestions) * 100) : 0;

  const generalizationIndex = hyperfocusCorrect > 0 
    ? ((neutralCorrect + transferCorrect) / hyperfocusCorrect).toFixed(2) 
    : "0.00";

  // Performance Summary
  const accuracy = stats.totalQuestions > 0 
    ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) 
    : 0;
  doc.setFontSize(14);
  doc.text('Indicadores de Generalização (AEE)', 120, 45);
  doc.setFontSize(11);
  doc.text(`Precisão Geral: ${accuracy}%`, 120, 52);
  doc.text(`Índice de Generalização: ${generalizationIndex}x`, 120, 58);
  doc.text(`Hiperfoco: ${hyperfocusCorrect}/${hyperfocusQuestions} (${hyperfocusPct}%)`, 120, 64);
  doc.text(`Transferência: ${transferCorrect}/${transferQuestions} (${transferPct}%)`, 120, 70);
  doc.text(`Território Neutro: ${neutralCorrect}/${neutralQuestions} (${neutralPct}%)`, 120, 76);

  // History Table
  doc.setFontSize(14);
  doc.text('Histórico Recente de Desempenho', 20, 85);

  const tableData = history.map(entry => {
    const skippedCount = entry.skippedQuestions?.length || 0;
    return [
      new Date(entry.date).toLocaleDateString('pt-BR'),
      entry.subject,
      entry.topic,
      `${entry.score}/${entry.total}`,
      skippedCount > 0 ? `${skippedCount}` : '0',
      `${Math.round((entry.score / entry.total) * 100)}%`
    ];
  });

  autoTable(doc, {
    startY: 90,
    head: [['Data', 'Matéria', 'Tema', 'Pontos', 'Puladas', '%']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [63, 81, 181] }
  });

  // Study Recommendations
  const finalY = (doc as any).lastAutoTable?.finalY || 90;
  
  // Section for skipped questions (gaps)
  const skippedEntries = history.filter(h => h.skippedQuestions && h.skippedQuestions.length > 0);
  let currentY = finalY + 20;

  if (skippedEntries.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Lacunas de Conhecimento (Questões Puladas)', 20, currentY);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Estes itens foram pulados pelo aluno por insegurança ou falta de conhecimento:', 20, currentY + 7);
    
    currentY += 15;
    skippedEntries.slice(0, 3).forEach(entry => {
      entry.skippedQuestions?.slice(0, 2).forEach(q => {
        if (currentY < 260) {
          doc.text(`• [${entry.topic}] ${q.text.substring(0, 80)}${q.text.length > 80 ? '...' : ''}`, 25, currentY);
          currentY += 6;
        }
      });
    });
    currentY += 10;
  }

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Recomendações e Pontos de Atenção', 20, currentY);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  
  const wrongTopics = history
    .filter(h => (h.score / h.total) < 0.7)
    .map(h => h.topic);
  
  const uniqueWrongTopics = Array.from(new Set(wrongTopics));

  if (uniqueWrongTopics.length > 0) {
    doc.text('Baseado nos erros recentes, sugerimos reforçar os seguintes temas:', 20, finalY + 28);
    uniqueWrongTopics.slice(0, 5).forEach((topic, index) => {
      doc.text(`• ${topic}`, 25, finalY + 36 + (index * 6));
    });
  } else {
    doc.text('O aluno apresenta um excelente desempenho em todos os temas recentes.', 20, finalY + 28);
  }

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text('Documento gerado automaticamente pela plataforma HiperReforço.', pageWidth / 2, 285, { align: 'center' });

  doc.save(`Relatorio_Pedagogico_${new Date().getTime()}.pdf`);
};

export const generateWeeklyPdfReport = (
  stats: UserStats,
  weeklyData: any[],
  focusAreasData: { subjects: any[]; focus: any[] },
  contextData: any[],
  timeRange: string,
  selectedSubject: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Title
  doc.setFontSize(20);
  doc.setTextColor(63, 81, 181); // Indigo color matching primary
  doc.text('Relatório de Evolução Semanal - HiperReforço', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Período: Últimas ${timeRange} Semanas`, pageWidth / 2, 26, { align: 'center' });
  if (selectedSubject !== 'all') {
    doc.text(`Filtro de Matéria: ${selectedSubject}`, pageWidth / 2, 31, { align: 'center' });
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 36, pageWidth - 15, 36);

  // Aluno e Status Principal
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text('Resumo do Desempenho do Estudante', 15, 45);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const totalQuizzes = weeklyData.reduce((acc, curr) => acc + curr.quizzesCount, 0);
  const totalCorrect = weeklyData.reduce((acc, curr) => acc + curr.totalCorrect, 0);
  const totalQuestions = weeklyData.reduce((acc, curr) => acc + curr.totalQuestions, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  doc.text(`Nível do Perfil: ${stats.level || 1}`, 15, 52);
  doc.text(`XP Acumulado: ${stats.xp || 0}`, 15, 58);
  doc.text(`Quizzes Finalizados no Período: ${totalQuizzes}`, 15, 64);
  doc.text(`Aproveitamento Médio Periódico: ${overallAccuracy}%`, 15, 70);

  // AEE Generalization Column
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text('Pilares de Aprendizagem (AEE)', 110, 45);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const hyperfocusScore = contextData.find(c => c.subject.includes('Hiperfoco'))?.A ?? 0;
  const transferScore = contextData.find(c => c.subject.includes('Transferência'))?.A ?? 0;
  const neutralScore = contextData.find(c => c.subject.includes('Neutro'))?.A ?? 0;

  doc.text(`• Taxa de Acerto em Hiperfoco: ${hyperfocusScore}%`, 110, 52);
  doc.text(`• Taxa de Acerto em Transferência: ${transferScore}%`, 110, 58);
  doc.text(`• Taxa de Acerto em Contexto Neutro: ${neutralScore}%`, 110, 64);
  
  const generalizationIdx = hyperfocusScore > 0 
    ? ((neutralScore + transferScore) / (hyperfocusScore * 2)).toFixed(2)
    : "0.00";
  doc.text(`• Índice de Generalização de Conteúdo: ${generalizationIdx}x`, 110, 70);

  // Table 1: Progress Week by Week
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text('Evolução das Semanas', 15, 82);

  const weekTableBody = weeklyData.map(w => [
    w.weekLabel,
    `${w.quizzesCount} quizzes`,
    `${w.totalCorrect}/${w.totalQuestions}`,
    `${w.accuracy}%`,
    `${w.hyperfocusAccuracy}%`,
    `${w.transferAccuracy}%`,
    `${w.neutralAccuracy}%`
  ]);

  autoTable(doc, {
    startY: 86,
    head: [['Período Semanal', 'Quizzes', 'Pontos', 'Precisão Geral', 'Hiperfoco', 'Transfer.', 'Neutro']],
    body: weekTableBody,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // Violet color for weekly
    margin: { left: 15, right: 15 }
  });

  let currentY = (doc as any).lastAutoTable?.finalY || 140;
  currentY += 12;

  // Row for Focus & Subjects Tables
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text('Desempenho por Matéria e por Hiperfoco', 15, currentY);
  currentY += 4;

  const topSubjects = (focusAreasData?.subjects || []).slice(0, 4).map(s => [s.name, `${s.accuracy}%`, `${s.count} q`]);
  const topFocus = (focusAreasData?.focus || []).slice(0, 4).map(f => [f.name, `${f.accuracy}%`, `${f.count} q`]);

  const maxRows = Math.max(topSubjects.length, topFocus.length);
  const performanceTableBody = [];
  for (let i = 0; i < maxRows; i++) {
    performanceTableBody.push([
      topSubjects[i]?.[0] || '-',
      topSubjects[i]?.[1] || '-',
      topFocus[i]?.[0] || '-',
      topFocus[i]?.[1] || '-',
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['Matéria Curricular', 'Precisão', 'Tema de Hiperfoco', 'Precisão']],
    body: performanceTableBody,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110] }, // Teal color for grid split
    margin: { left: 15, right: 15 }
  });

  currentY = (doc as any).lastAutoTable?.finalY || currentY + 40;
  currentY += 12;

  // Recommendations and Safeguards
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text('Laudo e Recomendações Psicopedagógicas', 15, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);

  const firstSub = focusAreasData?.subjects?.[0];
  const lastSub = focusAreasData?.subjects?.[focusAreasData.subjects.length - 1];
  const primaryTheme = focusAreasData?.focus?.[0];

  const recommendations = [
    `• Fortalezas Acadêmicas: O aluno demonstra excelente desenvolvimento e fixação em "${firstSub ? firstSub.name : 'Matérias Gerais'}" com ${firstSub ? firstSub.accuracy : 0}% de aproveitamento.`,
    `• Âncora de Aprendizagem: O hiperfoco em "${primaryTheme ? primaryTheme.name : 'Assuntos Preferenciais'}" continua sendo uma poderosa chave de engajamento lúdico-cognitivo.`,
    `• Áreas de Apoio: Recomendamos reforçar ${lastSub && lastSub !== firstSub ? `"${lastSub.name}" (${lastSub.accuracy}%)` : 'as áreas com menor engajamento'} utilizando mais estratégias visuais e narrativas conectadas ao hiperfoco.`,
    `• Salvaguarda de Transição (AEE): Proporcione 10 minutos de exploração neutra ou com transferência para cada 30 minutos de hiperfoco ativo para prevenir a evitação de novos contextos.`
  ];

  recommendations.forEach(r => {
    const splitText = doc.splitTextToSize(r, pageWidth - 30);
    doc.text(splitText, 15, currentY);
    currentY += (splitText.length * 5) + 2;
  });

  // Disclaimer / Footer
  currentY = Math.max(currentY + 10, 275);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento emitido de acordo com as diretrizes do PEI (Plano de Ensino Individualizado) da plataforma HiperReforço.', pageWidth / 2, currentY, { align: 'center' });
  doc.text('Para uso educacional e inclusão de estudantes neurodivergentes. Não substitui parecer clínico formal.', pageWidth / 2, currentY + 4, { align: 'center' });

  doc.save(`Relatorio_Semanal_HiperReforco_${new Date().getTime()}.pdf`);
};
