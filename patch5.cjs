const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const target = "      // VALIDAÇÃO PÓS-GERAÇÃO: Salvaguardas Pedagógicas";
const endTarget = "            return data;";

const replacement = `      // VALIDAÇÃO PÓS-GERAÇÃO: Salvaguardas Pedagógicas
      if (data.questions && data.questions.length > 0) {
        if (isGeneric) {
          data.questions.forEach((q: any) => q.contextType = 'neutral');
        } else {
          // Enforce positions 4 and 8 as transfer BEFORE counting
          if (data.questions.length >= 8) {
             data.questions[3].contextType = 'transfer';
             data.questions[7].contextType = 'transfer';
          }
        
          let hyperfocusCount = 0;
          data.questions.forEach((q: any) => {
            if (!q.contextType) q.contextType = 'hyperfocus';
            if (q.contextType === 'hyperfocus') hyperfocusCount++;
          });
          
          const ratio = hyperfocusCount / data.questions.length;
          if (ratio > hyperfocusRatio) {
            if (attempts === 0) {
              console.warn(\`[Salvaguardas] Quiz gerou \${Math.round(ratio*100)}% de hiperfoco (teto: \${Math.round(hyperfocusRatio*100)}%). Regenerando (retry 1)...\`);
              attempts++;
              continue; // Retry
            } else {
              console.warn(\`[Salvaguardas] Retry falhou. Forçando reclassificação programática...\`);
              const maxHyperfocus = Math.floor(data.questions.length * hyperfocusRatio);
              let currentHyperfocus = hyperfocusCount;
              for (const q of data.questions) {
                 // skip 3 and 7 as they are already transfer, but they wouldn't be hyperfocus anyway
                 if (q.contextType === 'hyperfocus' && currentHyperfocus > maxHyperfocus) {
                   q.contextType = 'transfer';
                   currentHyperfocus--;
                 }
              }
            }
          }
        }
      }
      
      return data;`;

const idxStart = content.indexOf(target);
const idxEnd = content.indexOf(endTarget, idxStart) + endTarget.length;

if (idxStart !== -1 && idxEnd !== -1) {
  content = content.substring(0, idxStart) + replacement + content.substring(idxEnd);
  fs.writeFileSync('src/services/geminiService.ts', content);
  console.log("Patched 5!");
} else {
  console.log("Not found", idxStart, idxEnd);
}
