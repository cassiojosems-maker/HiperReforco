const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const badString = "return data;ype } from \"@google/genai\";";
if (content.indexOf(badString) !== -1) {
  content = content.replace(badString, "return data;\n    } catch (error) {\n      if (attempts === 0) {\n        attempts++;\n        continue;\n      }\n      console.error(\"Error generating quiz:\", error);\n      throw error;\n    }\n  }\n}\n\nimport { Type } from \"@google/genai\";");
  fs.writeFileSync('src/services/geminiService.ts', content);
  console.log("Fixed part 1");
}

// But wait, the top of the file STILL has import { GoogleGenAI, Type }...
// Let's check how the file starts.
