// carregar.js
import "dotenv/config";
import fs from "fs/promises";
import crypto from "crypto";
import fetch from "node-fetch";
globalThis.fetch = fetch;

const GROQ_URL = "https://api.groq.com/openai/v1";
const API_KEY = process.env.GROQ_API_KEY;

// 1) Seus documentos “estáticos”
const DOCUMENTS = [
  "Brasília é a capital do Brasil.",
  "O maior cajueiro do mundo está no Rio Grande do Norte.",
  "O Sol é uma estrela da sequência principal do tipo espectral G2."
];

// 2) Chama embeddings na API Groq
async function embed(text) {
  const res = await fetch(`${GROQ_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });
  if (!res.ok) throw new Error(`Embedding error ${res.status}`);
  const { data } = await res.json();
  return data[0].embedding;
}

async function main() {
  try {
    const items = [];

    for (const texto of DOCUMENTS) {
      console.log(`🧠 Gerando embedding para: "${texto}"`);
      const embedding = await embed(texto);
      items.push({
        id: crypto.randomUUID(),
        texto,
        embedding,
      });
    }

    await fs.writeFile("data.json", JSON.stringify(items, null, 2), "utf-8");
    console.log("🚀 Embeddings salvos em data.json!");
  } catch (err) {
    console.error("❌ Erro ao gerar embeddings:", err);
  }
}

main();
