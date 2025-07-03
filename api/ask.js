// api/ask.js
import "dotenv/config";
import fetch from "node-fetch";
import fs from "fs/promises";
globalThis.fetch = fetch;

const GROQ_URL = "https://api.groq.com/openai/v1";
const GROQ_KEY = process.env.GROQ_API_KEY;

export const config = { runtime: "nodejs" };

// Similaridade coseno
function cosine(a, b) {
  const dot = a.reduce((acc, ai, i) => acc + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((acc, ai) => acc + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((acc, bi) => acc + bi * bi, 0));
  return dot / (normA * normB);
}

// Carrega os embeddings dos documentos
let docs = null;
async function loadDocs() {
  if (!docs) {
    const file = await fs.readFile("data.json", "utf-8");
    docs = JSON.parse(file);
  }
  return docs;
}

// (Temporariamente usa OpenAI até Groq fornecer embeddings)
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
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

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

    // Debug: mostra o contexto no terminal
    console.log("\n📄 Contexto enviado ao Groq:\n" + contexto + "\n");

    const mensagens = [
      {
        role: "system",
        content:
          "Você é um assistente útil e responde com base no contexto fornecido. Caso a resposta não esteja contida nele, diga que não sabe.",
      },
      {
        role: "user",
        content:
          `Responda à pergunta com base no contexto abaixo. Se a resposta não estiver no contexto, diga que não sabe.\n\n` +
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
        model: "llama3-8b-8192", // ⬅️ novo modelo!
        messages: mensagens,
        temperature: 0.3,
      }),
    });

    const json = await respostaLLM.json();
    console.log("🧠 Resposta bruta do Groq:\n", JSON.stringify(json, null, 2));

    const resposta = json?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!resposta) console.warn("⚠️ Modelo respondeu vazio");

    return res.status(200).json({ resposta: resposta || "Sem resposta gerada." });
  } catch (err) {
    console.error("❌ Erro ao responder:", err.stack || err);
    return res.status(500).json({ error: "Erro interno ao processar a pergunta" });
  }
}
