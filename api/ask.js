import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf";
import { FAISS } from "@langchain/community/vectorstores/faiss";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { RetrievalQAChain } from "langchain/chains";
import path from "path";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  console.log("📡 Requisição recebida:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { pergunta } = req.body;
  console.log("❓ Pergunta recebida:", pergunta);

  if (!pergunta || typeof pergunta !== "string") {
    return res.status(400).json({ error: "Pergunta ausente ou inválida" });
  }

  try {
    console.log("🧠 Iniciando embeddings...");
    const embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: "sentence-transformers/all-MiniLM-L6-v2"
    });

    const basePath = path.resolve(process.cwd(), "vetores_site");
    console.log("📁 Carregando FAISS de:", basePath);
    const vectorstore = await FAISS.load(basePath, embeddings);
    console.log("✅ Vetores carregados");

    const model = new ChatOpenAI({
      temperature: 0.2,
      modelName: "gpt-3.5-turbo",
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    console.log("🧩 Criando chain de QA...");
    const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever());

    console.log("🚀 Executando chain com a pergunta...");
    const resposta = await chain.run(pergunta);

    console.log("✅ Resposta gerada com sucesso");
    return res.status(200).json({ resposta });
  } catch (erro) {
    console.error("❌ Erro ao gerar resposta:", erro);
    return res.status(500).json({ error: "Erro interno ao processar a pergunta" });
  }
}
