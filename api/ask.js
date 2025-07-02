import { HuggingFaceTransformersEmbeddings } from "langchain-community/embeddings/hf";
import { FAISS } from "langchain-community/vectorstores/faiss";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { RetrievalQAChain } from "langchain/chains";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { pergunta } = req.body;

  if (!pergunta) {
    return res.status(400).json({ error: "Pergunta ausente" });
  }

  try {
    const embeddings = new HuggingFaceTransformersEmbeddings();
    const vectorstore = await FAISS.load("./vetores_site", embeddings);

    const model = new ChatOpenAI({
      temperature: 0.2,
      modelName: "gpt-3.5-turbo",
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    const chain = RetrievalQAChain.fromLLM(model, vectorstore.asRetriever());
    const resposta = await chain.run(pergunta);

    return res.status(200).json({ resposta });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ error: "Erro interno ao processar a pergunta" });
  }
}
