/* api/convert-pdf.js - VERSÃO COM LOGS SEGUROS */
const PDFServicesSdk = require("@adobe/pdf-services-node-sdk");

export default async function handler(req, res) {
  // Configuração CORS (Padrão)
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
    console.log("1. Iniciando API Handler...");

    // DIAGNÓSTICO DE VARIÁVEIS (SEGURO)
    // Não imprime a chave, apenas diz se ela existe e o tamanho dela
    const clientId = process.env.ADOBE_CLIENT_ID;
    const clientSecret = process.env.ADOBE_CLIENT_SECRET;

    console.log(`2. Status das Chaves:`);
    console.log(
      `   - Client ID: ${clientId ? "OK (" + clientId.length + " chars)" : "MISSING"}`,
    );
    console.log(
      `   - Secret: ${clientSecret ? "OK (" + clientSecret.length + " chars)" : "MISSING"}`,
    );

    if (!clientId || !clientSecret) {
      throw new Error(
        "As variáveis de ambiente ADOBE_CLIENT_ID ou ADOBE_CLIENT_SECRET não foram carregadas.",
      );
    }

    // 3. Recebe o arquivo
    const inputBuffer = req.body;
    console.log(
      `3. Arquivo recebido. É Buffer? ${Buffer.isBuffer(inputBuffer)}. Tamanho: ${inputBuffer ? inputBuffer.length : 0} bytes`,
    );

    if (!inputBuffer || inputBuffer.length === 0) {
      throw new Error("O corpo da requisição (arquivo) chegou vazio.");
    }

    // 4. Setup Adobe
    console.log("4. Configurando Credenciais Adobe...");
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

    // 5. Execução
    console.log(
      "5. Enviando para os servidores da Adobe (Aguardando resposta)...",
    );
    const result = await createPdfOperation.execute(executionContext);
    console.log("6. Sucesso! Resposta recebida da Adobe.");

    // 6. Processamento do Retorno
    const chunks = [];
    for await (const chunk of result.saveAsStream()) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    console.log(
      `7. PDF Final montado. Tamanho: ${pdfBuffer.length} bytes. Enviando para o navegador.`,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
    return res.send(pdfBuffer);
  } catch (err) {
    // ESTE É O LOG IMPORTANTE QUE VAI APARECER NO VERCEL
    console.error("!!! ERRO CRÍTICO NO BACKEND !!!");
    console.error(err);

    // Devolve o erro detalhado para o seu navegador (aparecerá no console do Chrome)
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
}
