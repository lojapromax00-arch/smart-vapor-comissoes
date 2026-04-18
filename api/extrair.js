export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { imageBase64, imageMime, texto, excel } = req.body

  const messages = []

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 }
        },
        {
          type: 'text',
          text: `Analise este print de sistema de vendas e extraia os dados do pedido.
Retorne SOMENTE JSON válido sem markdown:
{"nome_cliente":"","telefone":"","numero_pedido":"","data_venda":"DD/MM/YYYY","valor":0,"loja":"VAPOR ou SMART","observacoes":""}`
        }
      ]
    })
  } else if (excel) {
    messages.push({
      role: 'user',
      content: `Você receberá dados de uma planilha de vendas como array de objetos JSON. Mapeie cada linha para o schema abaixo, inferindo qual coluna corresponde a cada campo.

Dados da planilha:
${JSON.stringify(excel, null, 2)}

Retorne SOMENTE um array JSON válido sem markdown, com objetos no formato:
[{"nome_cliente":"","telefone":"","numero_pedido":"","data_venda":"DD/MM/YYYY","valor":0,"loja":"VAPOR ou SMART","observacoes":""}]

Regras:
- loja deve ser "VAPOR" ou "SMART" (maiúsculas). Se não identificável, use "VAPOR".
- data_venda no formato DD/MM/YYYY
- valor como número (sem R$ ou pontos de milhar)
- telefone: manter como string
- Ignorar linhas sem número de pedido ou valor`
    })
  } else if (texto) {
    messages.push({
      role: 'user',
      content: `Extraia os dados de venda do texto abaixo e retorne SOMENTE JSON válido sem markdown:
{"nome_cliente":"","telefone":"","numero_pedido":"","data_venda":"DD/MM/YYYY","valor":0,"loja":"VAPOR ou SMART","observacoes":""}

Texto:
${texto}`
    })
  } else {
    return res.status(400).json({ error: 'Nenhum dado fornecido' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages
      })
    })

    const data = await response.json()

    if (data.error) return res.status(400).json({ error: data.error.message })

    const text = data.content?.[0]?.text || (excel ? '[]' : '{}')
    const clean = text.replace(/```json|```/g, '').trim()

    return res.status(200).json(JSON.parse(clean))
  } catch (err) {
    return res.status(200).json(excel ? [] : { error: 'Não foi possível extrair os dados' })
  }
}
