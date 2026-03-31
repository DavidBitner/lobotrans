/* api/geocode.js */
module.exports = async (req, res) => {
  // 1. Configuração de CORS (Permite que seu site acesse esta função)
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  // Responde rápido se o navegador estiver apenas testando a conexão (Preflight)
  if (req.method === "OPTIONS") return res.status(200).end();

  // 2. Segurança: Pega a chave do cofre do Vercel
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "Chave de API não configurada no servidor." });
  }

  // 3. Validação dos dados que chegam do Front-end
  const { lat, lng } = req.body || {};
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "Latitude e Longitude são obrigatórias." });
  }

  try {
    // 4. Pergunta ao Google (Server-to-Server)
    // A chave fica aqui, segura no servidor
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=pt-BR`;

    const googleRes = await fetch(url);
    const data = await googleRes.json();

    // Se o Google reclamar (Ex: Cota excedida, Erro de chave), repassa o erro
    if (data.status !== "OK") {
      console.error("Erro Google Geocoding:", data);
      throw new Error(`Google API retornou status: ${data.status}`);
    }

    // 5. Sucesso: Pega o primeiro resultado (o mais preciso)
    const result = data.results[0];

    return res.status(200).json({
      address: result.formatted_address,
      components: result.address_components, // Enviamos os componentes para tentar extrair Bairro/Número no front
    });
  } catch (err) {
    console.error("Erro interno no Geocoding:", err);
    return res
      .status(500)
      .json({ error: "Erro ao buscar endereço.", details: err.message });
  }
};
