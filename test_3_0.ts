import { GoogleGenAI } from "@google/genai";

async function testKey() {
  let rawKey = process.env.GEMINI_API_KEY;
  let cleanKey = "";
  if (typeof rawKey === "string") {
    cleanKey = rawKey.replace(/["']/g, '').trim();
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });
  // Try exactly what user asked
  const modelsToTry = ["gemini-3.0-flash", "gemini-3-flash-preview", "gemini-3-flash"];

  console.log("=== TESTANDO NOMES DE MODELO 3.0 ===");
  for (const m of modelsToTry) {
    try {
      console.log(`Testando: ${m}...`);
      await ai.models.generateContent({
        model: m,
        contents: "teste",
      });
      console.log(`✅ ${m} FUNCIONOU!`);
    } catch (e: any) {
      console.log(`❌ ${m} FALHOU: ${e.message}`);
    }
  }
}

testKey();
