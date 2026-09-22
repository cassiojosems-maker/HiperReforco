import { GoogleGenAI } from "@google/genai";

async function listModels() {
  let rawKey = process.env.GEMINI_API_KEY;
  let cleanKey = "";
  if (typeof rawKey === "string") {
    cleanKey = rawKey.replace(/["']/g, '').trim();
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });
  try {
    // There isn't a direct listModels in the standard SDK easily accessible like this in some versions
    // But let's try generic fetch to the endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Modelos disponíveis:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Erro ao listar:", e);
  }
}

listModels();
