import axios from "axios";

export default async function handler(req, res) {
  try {
    const { cep, peso } = req.body;

    const frenetResponse = await axios.post(
      "https://api.frenet.com.br/shipping/quote",
      {
        SellerCEP: "01001-000",
        RecipientCEP: cep,
        ShipmentInvoiceValue: 150,
        ShippingServiceCode: null,
        ShippingItemArray: [
          {
            Height: 17,
            Length: 22,
            Width: 22,
            Weight: peso,
            Quantity: 1
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "token": process.env.FRENET_TOKEN
        }
      }
    );

    const services = frenetResponse.data.ShippingSevicesArray;

    if (!services || services.length === 0) {
      return res.json({ erro: "Nenhum frete disponível" });
    }

    const maisBarato = services.reduce((a, b) =>
      a.ShippingPrice < b.ShippingPrice ? a : b
    );

    res.json({
      valor_frete: maisBarato.ShippingPrice,
      prazo_frete: maisBarato.DeliveryTime,
      transportadora: maisBarato.ServiceDescription
    });

  } catch (error) {
    res.status(500).json({ erro: "Erro na cotação" });
  }
}
