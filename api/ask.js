import "dotenv/config";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
globalThis.fetch = fetch;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GROQ_URL = "https://api.groq.com/openai/v1";
const GROQ_KEY = process.env.GROQ_API_KEY;

export const config = { runtime: "nodejs" };

// Cálculo de similaridade coseno
function cosine(a, b) {
  const dot = a.reduce((acc, ai, i) => acc + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((acc, ai) => acc + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((acc, bi) => acc + bi * bi, 0));
  return dot / (normA * normB);
}

// Carrega os embeddings
let docs = null;
async function loadDocs() {
  if (!docs) {
    const filePath = path.join(__dirname, "data.json");
    const file = await fs.readFile(filePath, "utf-8");
    docs = JSON.parse(file);
  }
  return docs;
}

// Gera embedding com OpenAI
async function embedPergunta(pergunta) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: pergunta,
    }),
  });
  const { data } = await res.json();
  return data?.[0]?.embedding ?? [];
}

export default async function handler(req, res) {
  // Libera CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { pergunta } = req.body;
  if (!pergunta || typeof pergunta !== "string") {
    return res.status(400).json({ error: "Pergunta inválida" });
  }

  try {
    const documentos = await loadDocs();
    const perguntaEmb = await embedPergunta(pergunta);

    const similares = documentos
      .map((doc) => ({
        texto: doc.texto,
        sim: cosine(perguntaEmb, doc.embedding),
      }))
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 2);

    const contexto = similares.map((s) => `• ${s.texto}`).join("\n");

    console.log("\n📄 Contexto enviado ao Groq:\n" + contexto + "\n");

    const mensagens = [
      {
        role: "system",
        content:
          "Você é um assistente técnico e responde exclusivamente com base no contexto fornecido. Se não souber a resposta, diga 'Não sei'.",
      },
      {
        role: "user",
        content:
          `Contexto:\n${contexto}\n\n` +
          `Pergunta: ${pergunta}\n` +
          `Resposta:`,
      },
    ];

    const respostaLLM = await fetch(`${GROQ_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: mensagens,
        temperature: 0.3,
      }),
    });

    const json = await respostaLLM.json();
    console.log("🧠 Resposta bruta do Groq:\n", JSON.stringify(json, null, 2));

    const resposta = json?.choices?.[0]?.message?.content?.trim() ?? "";

    return res.status(200).json({
      resposta: resposta || "Sem resposta gerada.",
    });
  } catch (err) {
    console.error("❌ Erro ao responder:", err);
    return res.status(500).json({ error: "Erro interno ao processar a pergunta" });
  }
}
