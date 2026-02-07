import axios from "axios";

function normalizeCEP(cep) {
  return String(cep || "").replace(/\D/g, "");
}

export default async function handler(req, res) {
  // --- CORS (ajuda o Botpress e qualquer frontend) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = process.env.FRENET_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "FRENET_TOKEN não configurado na Vercel" });
    }

    const body = req.body || {};
    const cep = normalizeCEP(body.cep);
    const peso = Number(body.peso);
    const length = Number(body.length);
    const width = Number(body.width);
    const height = Number(body.height);

    // --- validações ---
    if (!cep || cep.length !== 8) {
      return res.status(400).json({ error: "CEP inválido. Envie no formato 00000000 ou 00000-000." });
    }
    if (!Number.isFinite(peso) || peso <= 0) {
      return res.status(400).json({ error: "Peso inválido. Envie peso em KG (ex: 1.56)." });
    }
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return res.status(400).json({ error: "Dimensões inválidas. Envie length/width/height em CM." });
    }

    // --- chamada Frenet ---
    const frenetPayload = {
      SellerCEP: "01001-000", // troque se quiser seu CEP de origem real
      RecipientCEP: `${cep.slice(0, 5)}-${cep.slice(5)}`,
      ShipmentInvoiceValue: 150, // pode parametrizar depois
      ShippingServiceCode: null,
      ShippingItemArray: [
        {
          Height: height,
          Length: length,
          Width: width,
          Weight: peso,
          Quantity: 1
        }
      ]
    };

    const frenetResp = await axios.post(
      "https://api.frenet.com.br/shipping/quote",
      frenetPayload,
      {
        headers: {
          "Content-Type": "application/json",
          token
        },
        timeout: 15000
      }
    );

    const services = frenetResp?.data?.ShippingSevicesArray || [];

    // --- filtrar só: Loggi, Jadlog, PAC e SEDEX ---
    const allowed = services
      .filter(s => Number(s.ShippingPrice) > 0 && Number(s.DeliveryTime) > 0)
      .filter(s => {
        const carrier = String(s.Carrier || "").toUpperCase();
        const desc = String(s.ServiceDescription || "").toUpperCase();

        const isLoggi = carrier.includes("LOGGI") || desc.includes("LOGGI");
        const isJadlog = carrier.includes("JADLOG") || desc.includes("JADLOG");
        const isSedex = desc.includes("SEDEX");
        const isPac = desc.includes("PAC");

        return isLoggi || isJadlog || isSedex || isPac;
      })
      .map(s => ({
        transportadora: s.Carrier,
        servico: s.ServiceDescription,
        valor: Number(s.ShippingPrice),
        prazo: Number(s.DeliveryTime)
      }))
      // ordena por prazo (mais rápido primeiro). Se preferir por valor, troque.
      .sort((a, b) => a.prazo - b.prazo);

    return res.status(200).json({
      opcoes: allowed,
      meta: {
        cep,
        peso,
        caixa: { length, width, height }
      }
    });
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;

    console.error("Erro Frenet:", status, data || err?.message);

    // se a Frenet respondeu com erro, repassamos algo útil
    if (status) {
      return res.status(502).json({
        error: "Erro ao consultar a Frenet",
        frenet_status: status,
        frenet: data || null
      });
    }

    return res.status(500).json({ error: "Erro interno ao calcular frete" });
  }
}
