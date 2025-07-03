from sentence_transformers import SentenceTransformer
import json
import uuid

model = SentenceTransformer("all-MiniLM-L6-v2")

texts = [
    "Brasília é a capital do Brasil.",
    "O maior cajueiro do mundo está no Rio Grande do Norte.",
    "O Sol é uma estrela da sequência principal do tipo espectral G2."
]

output = []
for text in texts:
    vector = model.encode(text, normalize_embeddings=True).tolist()
    output.append({
        "id": str(uuid.uuid4()),
        "texto": text,
        "embedding": vector
    })

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)
