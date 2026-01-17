/* api/convert-pdf.js - Nome do pacote corrigido */
// ATENÇÃO: O require abaixo deve ser EXATAMENTE assim (sem hífen em pdfservices)
const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");

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

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("--> Iniciando processamento Adobe...");

    // 2. Verificação de Segurança
    const clientId = process.env.ADOBE_CLIENT_ID;
    const clientSecret = process.env.ADOBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("ERRO: Variáveis de ambiente não encontradas.");
      throw new Error(
        "Configuração do servidor incompleta (Faltam chaves Adobe).",
      );
    }

    // 3. Recebe o arquivo
    const inputBuffer = req.body;

    if (!inputBuffer || inputBuffer.length === 0) {
      throw new Error("O arquivo Word chegou vazio na API.");
    }

    // 4. Autenticação Adobe
    const credentials =
      PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

    const executionContext =
      PDFServicesSdk.ExecutionContext.create(credentials);
    const createPdfOperation = PDFServicesSdk.CreatePDF.Operation.createNew();

    // 5. Prepara e Envia
    const input = PDFServicesSdk.FileRef.createFromStream(
      inputBuffer,
      PDFServicesSdk.CreatePDF.SupportedSourceFormat.docx,
    );
    createPdfOperation.setInput(input);

    console.log("--> Enviando para nuvem Adobe...");
    const result = await createPdfOperation.execute(executionContext);
    console.log("--> Sucesso! Gerando resposta.");

    // 6. Devolve o PDF
    const chunks = [];
    for await (const chunk of result.saveAsStream()) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("!!! ERRO API:", err);
    return res.status(500).json({
      error: err.message,
      details: err.stack,
    });
  }
};
