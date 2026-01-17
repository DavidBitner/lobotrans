/* api/convert-pdf.js - Solução Serverless FileSystem (/tmp) */
const PDFServicesSdk = require("@adobe/pdfservices-node-sdk");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

  // Cria caminhos temporários seguros para Entrada e Saída
  const tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}.docx`);
  const tempOutputPath = path.join(os.tmpdir(), `output-${Date.now()}.pdf`);

  try {
    console.log("--> [API] Iniciando...");

    // 2. Recebe e Salva o DOCX no disco temporário
    // (O SDK 3.4.0 é muito mais estável lendo de arquivo do que de memória)
    const inputBuffer = await getRawBody(req);
    if (!inputBuffer || inputBuffer.length === 0)
      throw new Error("Arquivo vazio recebido.");

    fs.writeFileSync(tempInputPath, inputBuffer);
    console.log("--> [API] DOCX salvo em:", tempInputPath);

    // 3. Credenciais
    const clientId = process.env.ADOBE_CLIENT_ID;
    const clientSecret = process.env.ADOBE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error("Faltam chaves de API no Vercel.");

    const credentials =
      PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(clientId)
        .withClientSecret(clientSecret)
        .build();

    // 4. Execução Adobe
    const executionContext =
      PDFServicesSdk.ExecutionContext.create(credentials);
    const createPdfOperation = PDFServicesSdk.CreatePDF.Operation.createNew();

    // Configura entrada (Do disco)
    const input = PDFServicesSdk.FileRef.createFromLocalFile(tempInputPath);
    createPdfOperation.setInput(input);

    console.log("--> [API] Enviando para Adobe...");
    const result = await createPdfOperation.execute(executionContext);

    // 5. Salva o PDF no disco temporário (Resolve o erro saveAsStream)
    console.log("--> [API] Salvando PDF temporário...");
    await result.saveAsFile(tempOutputPath);

    // 6. Lê o PDF de volta para memória para enviar ao usuário
    const pdfBuffer = fs.readFileSync(tempOutputPath);

    console.log("--> [API] Sucesso! PDF lido. Limpando arquivos...");

    // 7. Envia para o navegador
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("!!! [API ERRO]:", err);
    return res.status(500).json({ error: err.message, details: err.stack });
  } finally {
    // 8. Limpeza (Deleta arquivos temporários para não lotar o servidor)
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    } catch (e) {
      console.error("Erro ao limpar temp:", e);
    }
  }
};

// Helper para ler o corpo da requisição corretamente no Vercel
async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
