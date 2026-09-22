const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `      newAlerts.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        message: "Regressão em território neutro após ciclo positivo. O aluno errou 2 ou mais questões neutras neste quiz. Recomendada revisão de generalização."
      });`;

const replacement = `      newAlerts.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        message: "Regressão em território neutro após ciclo positivo. O aluno errou 2 ou mais questões neutras neste quiz. Recomendada revisão de generalização.",
        subject: config?.subject || 'Simulado',
        topic: config?.topic || 'Geral',
        neutralErrors: neutralErrors,
        totalNeutral: totalNeutral
      });`;

if (content.indexOf(target) !== -1) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', content);
  console.log("Patched R4 alert");
} else {
  console.log("Not found R4 target");
}
