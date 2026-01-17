/* api/convert-pdf.js - Fix: Buffer to Stream Wrapper */
const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");
const { Readable } = require("stream"); // Módulo nativo para criar Streams

// Helper para ler o corpo da requisição
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
    console.log("--> [API] Iniciando...");

    // 2. Leitura do Input
    let inputBuffer = req.body;
    if (
      !inputBuffer ||
      (Buffer.isBuffer(inputBuffer) && inputBuffer.length === 0) ||
      (typeof inputBuffer === "object" && Object.keys(inputBuffer).length === 0)
    ) {
      inputBuffer = await getRawBody(req);
    }

    if (!inputBuffer || inputBuffer.length === 0) {
      throw new Error("Arquivo vazio recebido.");
    }

    // 3. FIX CRÍTICO: Converter Buffer para Readable Stream
    // O SDK 3.4.0 exige isso para usar createFromStream
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null); // Sinaliza o fim do arquivo

    // 4. Credenciais
    const clientId = process.env.ADOBE_CLIENT_ID;
    const clientSecret = process.env.ADOBE_CLIENT_SECRET;

    if (!clientId || !clientSecret)
      throw new Error("Faltam chaves de API no Vercel.");

    const credentials =
      PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

    const executionContext =
      PDFServicesSdk.ExecutionContext.create(credentials);
    const createPdfOperation = PDFServicesSdk.CreatePDF.Operation.createNew();

    // 5. Envia o Stream (agora compatível)
    const input = PDFServicesSdk.FileRef.createFromStream(
      inputStream,
      PDFServicesSdk.CreatePDF.SupportedSourceFormat.docx,
    );
    createPdfOperation.setInput(input);

    console.log("--> [API] Enviando para Adobe...");
    const result = await createPdfOperation.execute(executionContext);

    // 6. Retorno
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
