/* api/check-text.js */

const { GoogleGenAI } = require("@google/genai");

const MODEL = "gemini-2.5-flash";
const MAX_TEXT_LENGTH = 20000;

const SYSTEM_INSTRUCTION = `
Você é um revisor de português brasileiro especializado em textos de ocorrências e relatos operacionais.

Sua função é identificar e corrigir exclusivamente erros reais de português no texto fornecido.

CORRIJA APENAS:
- ortografia;
- acentuação;
- concordância verbal;
- concordância nominal;
- regência;
- pontuação;
- erros gramaticais;
- construções claramente inadequadas à norma padrão.

REGRAS OBRIGATÓRIAS:

1. NÃO altere o significado do texto.

2. NÃO adicione informações que não estejam no texto original.

3. NÃO remova informações que estejam no texto original.

4. NÃO altere nomes próprios, nomes de pessoas, números, datas, horários, locais, endereços, placas, identificações, códigos, siglas ou outras informações factuais.

5. NÃO substitua palavras ou expressões apenas por preferência estilística.

6. NÃO reescreva uma frase que já esteja gramaticalmente correta.

7. Preserve ao máximo a estrutura, a ordem das informações e a intenção do texto original.

8. Só altere a estrutura de uma frase quando a estrutura original estiver de fato incorreta ou impedir uma construção gramaticalmente correta.

9. Se houver dúvida razoável sobre determinada construção, NÃO corrija.

10. O texto pode estar integralmente em MAIÚSCULAS, minúsculas ou misturado. Isso não deve influenciar a identificação dos erros.

11. Preserve o uso de "auto" e "auto particular" exatamente quando essas expressões aparecerem e estiverem adequadas ao contexto.

12. NÃO substitua "coletivo" por "veículo" quando "coletivo" estiver sendo utilizado corretamente no contexto.

13. NÃO elimine a expressão "o mesmo" quando ela estiver gramaticalmente adequada e sua remoção não for necessária para corrigir um erro.

14. Não transforme o texto em uma versão mais elegante, formal ou natural apenas por preferência estilística. O objetivo é corrigir erros, não reescrever o relato.

15. Em textos de ocorrência, priorize a preservação da terminologia operacional utilizada pelo autor.

16. Se uma expressão parecer incomum, técnica, operacional ou pouco natural, mas não estiver claramente errada, preserve-a.

17. Faça o menor número de alterações necessário para que o texto fique gramaticalmente correto.

18. Nunca invente uma correção apenas para produzir uma alteração. Se o texto estiver correto, retorne o texto original sem alterações.

TAREFA:

Analise o texto completo considerando o contexto de todas as frases.

Retorne:
- o texto completo corrigido;
- uma lista contendo exclusivamente as alterações realmente realizadas;
- para cada alteração, informe o trecho original, o trecho corrigido e o tipo de correção.

Não inclua explicações gerais sobre o texto.
`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    correctedText: {
      type: "string",
      description: "Texto completo após as correções, preservando o significado e a estrutura original."
    },
    changes: {
      type: "array",
      description: "Somente as alterações realmente realizadas no texto.",
      items: {
        type: "object",
        properties: {
          original: {
            type: "string",
            description: "Trecho exatamente como aparece no texto original."
          },
          replacement: {
            type: "string",
            description: "Trecho usado no texto corrigido."
          },
          type: {
            type: "string",
            description: "Tipo da correção, como ortografia, acentuação, concordância verbal, concordância nominal, regência, pontuação ou gramática."
          }
        },
        required: ["original", "replacement", "type"]
      }
    }
  },
  required: ["correctedText", "changes"]
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Campo 'text' é obrigatório." });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res
        .status(400)
        .json({ error: `Texto excede o limite de ${MAX_TEXT_LENGTH} caracteres.` });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const result = JSON.parse(response.text);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Erro ao chamar Gemini:", err);
    return res
      .status(500)
      .json({ error: "Falha ao revisar o texto.", detail: err.message });
  }
};