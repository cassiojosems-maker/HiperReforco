const fs = require('fs');
const content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const target = "isGeneric ? '' : `\\n═══════════════════════════════════════════════════\\nSALVAGUARDAS PEDAGÓGICAS";

const idx = content.indexOf("isGeneric ? '' : `");
if (idx !== -1) {
  const newContent = content.substring(0, idx) + 
    "isGeneric ? `\\n═══════════════════════════════════════════════════\\nO campo 'contextType' deve ser preenchido OBRIGATORIAMENTE para cada questão com \\\"neutral\\\".\\n═══════════════════════════════════════════════════\\n` : `" +
    content.substring(idx + 18);
  fs.writeFileSync('src/services/geminiService.ts', newContent);
  console.log("Patched!");
} else {
  console.log("Not found");
}
