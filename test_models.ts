import { GoogleGenAI } from "@google/genai";

async function testKey() {
  let rawKey = process.env.GEMINI_API_KEY;
  let cleanKey = "";
  
  if (typeof rawKey === "string") {
    cleanKey = rawKey.replace(/["']/g, '').trim();
  }

  console.log("=== TESTANDO MODELOS ===");
  const ai = new GoogleGenAI({ apiKey: cleanKey });

  const models = ["gemini-3.5-flash", "gemini-3.0-flash", "gemini-3-flash-preview", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      console.log(`Tentando modelo: ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: "Oi",
      });
      console.log(`✅ ${model} FUNCIONOU!`);
    } catch (e: any) {
      console.log(`❌ ${model} FALHOU: ${e.message}`);
    }
  }
}

testKey();
