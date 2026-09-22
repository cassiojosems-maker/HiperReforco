const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

// We need to replace:
//       if (!isGeneric && data.questions && data.questions.length > 0) {
//         let hyperfocusCount = 0;
//         data.questions.forEach((q: any) => {
//           if (isGeneric) q.contextType = 'neutral';
//           else if (!q.contextType) q.contextType = 'hyperfocus';
//           if (q.contextType === 'hyperfocus') hyperfocusCount++;
//         });

const target1 = "      if (!isGeneric && data.questions && data.questions.length > 0) {";
const replacement1 = "      if (data.questions && data.questions.length > 0) {\n        if (isGeneric) {\n          data.questions.forEach((q: any) => q.contextType = 'neutral');\n        } else {";

const idx1 = content.indexOf(target1);
if (idx1 !== -1) {
  content = content.substring(0, idx1) + replacement1 + content.substring(idx1 + target1.length);
}

const target2 = "          if (isGeneric) q.contextType = 'neutral';\n          else if (!q.contextType) q.contextType = 'hyperfocus';";
const replacement2 = "          if (!q.contextType) q.contextType = 'hyperfocus';";
const idx2 = content.indexOf(target2);
if (idx2 !== -1) {
  content = content.substring(0, idx2) + replacement2 + content.substring(idx2 + target2.length);
}

// And we need to add a closing brace for the `else` block we introduced.
// The `if (ratio > hyperfocusRatio) { ... }` block ends and then we return `data`.
// Let's find where to put the closing brace.
const target3 = "            }\n        }\n      }\n\n      return data;";
const replacement3 = "            }\n        }\n        }\n      }\n\n      return data;";
const idx3 = content.indexOf(target3);
if (idx3 !== -1) {
  content = content.substring(0, idx3) + replacement3 + content.substring(idx3 + target3.length);
}


fs.writeFileSync('src/services/geminiService.ts', content);
console.log("Patched 3!");
