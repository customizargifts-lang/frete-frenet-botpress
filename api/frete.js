import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { cep, peso, length, width, height } = req.body;

    const response = await axios.post(
      "https://api.frenet.com.br/shipping/quote",
      {
        SellerCEP: "01001-000",
        RecipientCEP: cep,
        ShipmentInvoiceValue: 100,
        ShippingServiceCode: null,
        ShippingItemArray: [
  {
    Height: Number(height),
    Length: Number(length),
    Width: Number(width),
    Weight: Number(peso),
    Quantity: 1
  }
]

      },
      {
        headers: {
          "Content-Type": "application/json",
          token: process.env.FRENET_TOKEN
        }
      }
    );

    const services = response.data.ShippingSevicesArray || [];

    const allowed = services.filter(s => {
      const priceOk = Number(s.ShippingPrice) > 0;
      const timeOk = Number(s.DeliveryTime) > 0;

      const isLoggi = s.Carrier === "Loggi";
      const isJadlog = s.Carrier === "Jadlog";
      const isSedex =
        s.Carrier === "Correios" &&
        s.ServiceDescription?.toUpperCase().includes("SEDEX");
      const isPac =
        s.Carrier === "Correios" &&
        s.ServiceDescription?.toUpperCase().includes("PAC");

      return priceOk && timeOk && (isLoggi || isJadlog || isSedex || isPac);
    });

    if (allowed.length === 0) {
      return res.status(200).json({
        message: "Nenhuma opção de frete disponível"
      });
    }

    const opcoes = allowed.map(s => ({
      transportadora: s.Carrier,
      servico: s.ServiceDescription,
      valor: Number(s.ShippingPrice),
      prazo: Number(s.DeliveryTime)
    }));

    return res.status(200).json({ opcoes });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ error: "Erro ao calcular frete" });
  }
}
