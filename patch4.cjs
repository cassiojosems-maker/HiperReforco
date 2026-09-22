const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const target = "let currentHyperfocus = hyperfocusCount;";
const replacement = `let currentHyperfocus = hyperfocusCount;
            }
        }
        
        // As posições 4 e 8 devem ser 'transfer' se count for >= 8
        if (data.questions.length >= 8) {
           data.questions[3].contextType = 'transfer';
           data.questions[7].contextType = 'transfer';
        }
        
        // Re-count and enforce max again if needed, or just let it be.
        `;

const idx = content.indexOf(target);
if (idx !== -1) {
  content = content.substring(0, idx) + target + "\n" +
    "            // Enforce positions 4 and 8 as transfer\n" +
    "            if (data.questions.length >= 8) {\n" +
    "               if (data.questions[3].contextType === 'hyperfocus') { data.questions[3].contextType = 'transfer'; currentHyperfocus--; }\n" +
    "               if (data.questions[7].contextType === 'hyperfocus') { data.questions[7].contextType = 'transfer'; currentHyperfocus--; }\n" +
    "            }\n" +
    content.substring(idx + target.length);
}

fs.writeFileSync('src/services/geminiService.ts', content);
console.log("Patched 4!");
