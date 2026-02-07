import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { cep, peso } = req.body;

    const response = await axios.post(
      "https://api.frenet.com.br/shipping/quote",
      {
        SellerCEP: "01001-000",
        RecipientCEP: cep,
        ShipmentInvoiceValue: 100,
        ShippingServiceCode: null,
        ShippingItemArray: [
          {
            Height: 2,
            Length: 16,
            Width: 11,
            Weight: peso,
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

    const validServices = services.filter(
      s => s.ShippingPrice && s.DeliveryTime
    );

    if (validServices.length === 0) {
      return res.status(200).json({
        message: "Nenhum frete disponível para os dados informados"
      });
    }

    const cheapest = validServices.reduce((prev, curr) =>
      curr.ShippingPrice < prev.ShippingPrice ? curr : prev
    );

    return res.status(200).json({
      transportadora: cheapest.Carrier,
      valor_frete: cheapest.ShippingPrice,
      prazo_frete: cheapest.DeliveryTime
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ error: "Erro ao calcular frete" });
  }
}
