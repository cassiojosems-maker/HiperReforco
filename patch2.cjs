const fs = require('fs');
const content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const target = "if (!q.contextType) q.contextType = 'hyperfocus';";
const idx = content.indexOf(target);
if (idx !== -1) {
  const newContent = content.substring(0, idx) + 
    "if (isGeneric) q.contextType = 'neutral';\n          else if (!q.contextType) q.contextType = 'hyperfocus';" +
    content.substring(idx + target.length);
  fs.writeFileSync('src/services/geminiService.ts', newContent);
  console.log("Patched!");
} else {
  console.log("Not found");
}
