/* api/convert-pdf.js - Versão Robust Stream Reader */
const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");

// Função auxiliar para ler o corpo da requisição manualmente (Byte a Byte)
// Isso resolve o problema do "arquivo vazio" no Vercel
async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  // 1. Configuração de CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    console.log("--> [API] Iniciando recebimento...");

    // 2. Leitura do Arquivo (Estratégia Híbrida)
    // Tenta pegar o body padrão do Vercel. Se estiver vazio, lê o stream manualmente.
    let inputBuffer = req.body;

    if (
      !inputBuffer ||
      (Buffer.isBuffer(inputBuffer) && inputBuffer.length === 0) ||
      (typeof inputBuffer === "object" && Object.keys(inputBuffer).length === 0)
    ) {
      console.log("--> [API] Body padrão vazio. Lendo stream manual...");
      inputBuffer = await getRawBody(req);
    }

    console.log(
      `--> [API] Tamanho final recebido: ${inputBuffer ? inputBuffer.length : 0} bytes`,
    );

    if (!inputBuffer || inputBuffer.length === 0) {
      throw new Error(
        "O arquivo chegou com 0 bytes no servidor. Verifique o envio.",
      );
    }

    // 3. Verifica Credenciais
    const clientId = process.env.ADOBE_CLIENT_ID;
    const clientSecret = process.env.ADOBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Credenciais Adobe não configuradas no Vercel.");
    }

    // 4. Processamento Adobe
    const credentials =
      PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

    const executionContext =
      PDFServicesSdk.ExecutionContext.create(credentials);
    const createPdfOperation = PDFServicesSdk.CreatePDF.Operation.createNew();

    const input = PDFServicesSdk.FileRef.createFromStream(
      inputBuffer,
      PDFServicesSdk.CreatePDF.SupportedSourceFormat.docx,
    );
    createPdfOperation.setInput(input);

    console.log("--> [API] Enviando para Adobe...");
    const result = await createPdfOperation.execute(executionContext);
    console.log("--> [API] Sucesso! Baixando PDF...");

    // 5. Retorno
    const chunks = [];
    for await (const chunk of result.saveAsStream()) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("!!! [API ERRO]:", err);
    return res.status(500).json({
      error: err.message,
      details: err.stack,
    });
  }
};
