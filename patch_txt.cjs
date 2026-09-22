const fs = require('fs');
const content = fs.readFileSync('src/components/QuizResult.tsx', 'utf8');

const target = "content += `${idx + 1}. ${q.text}\\n`;";
const idx = content.indexOf(target);
if (idx !== -1) {
  const newContent = content.substring(0, idx + target.length) + 
    "\n      const contextName = q.contextType === 'neutral' ? 'Neutro' : q.contextType === 'transfer' ? 'Transferência' : 'Hiperfoco';" +
    "\n      content += `   [Contexto: ${contextName}]\\n`;" +
    content.substring(idx + target.length);
  fs.writeFileSync('src/components/QuizResult.tsx', newContent);
  console.log("Patched!");
} else {
  console.log("Not found");
}
