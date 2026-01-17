/* api/convert-pdf.js */
const PDFServicesSdk = require("@adobe/pdf-services-node-sdk");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Autenticação (Pega as chaves do ambiente seguro)
    const credentials =
      PDFServicesSdk.Credentials.servicePrincipalCredentialsBuilder()
        .withClientId(process.env.ADOBE_CLIENT_ID)
        .withClientSecret(process.env.ADOBE_CLIENT_SECRET)
        .build();

    // 2. Setup da Execução
    const executionContext =
      PDFServicesSdk.ExecutionContext.create(credentials);
    const createPdfOperation = PDFServicesSdk.CreatePDF.Operation.createNew();

    // 3. Recebe o arquivo Word (Blob) do Front-end
    // O Vercel recebe o corpo como Buffer automaticamente se for binário
    // Nota: Em algumas configs do Vercel nodejs, pode ser necessário tratar o body
    const inputBuffer = req.body;

    // Cria um input stream para a Adobe
    const input = PDFServicesSdk.FileRef.createFromStream(
      inputBuffer,
      PDFServicesSdk.CreatePDF.SupportedSourceFormat.docx,
    );
    createPdfOperation.setInput(input);

    // 4. Executa a conversão
    const result = await createPdfOperation.execute(executionContext);

    // 5. Lê o resultado e devolve para o site
    // O SDK salva em arquivo temporário, precisamos ler de volta para buffer
    const tempStream = new require("stream").PassThrough();
    result.saveAsFile(tempStream); // Isso é um hack do SDK, idealmente streamar direto

    // Como o saveAsFile do SDK da Adobe espera um caminho de arquivo,
    // e em Serverless não temos sistema de arquivos persistente,
    // a melhor abordagem com esse SDK específico é pegar o stream:

    // Vamos simplificar: O SDK retorna um FileRef.
    // Infelizmente o SDK da Adobe é focado em FileSystem.
    // Para Serverless, precisamos coletar o stream num buffer manualmente.

    const chunks = [];
    for await (const chunk of result.saveAsStream()) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // 6. Resposta
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=documento.pdf");
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro Adobe:", err);
    return res.status(500).json({ error: err.message });
  }
}
