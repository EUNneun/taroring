const OPENAI_URL = 'https://api.openai.com/v1/responses';

const planSchema = {
  type: 'object',
  properties: {
    cardCount: { type: 'integer', enum: [1, 3] },
    reason: { type: 'string' }
  },
  required: ['cardCount', 'reason'],
  additionalProperties: false
};

const readingSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    answer: { type: 'string' },
    advice: { type: 'string' },
    next: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          recommendedCardCount: { type: 'integer', enum: [1, 3] }
        },
        required: ['question', 'recommendedCardCount'],
        additionalProperties: false
      }
    }
  },
  required: ['summary', 'answer', 'advice', 'next'],
  additionalProperties: false
};

function extractOutputText(data) {
  if (data.output_text) return data.output_text;
  return data.output?.flatMap(item => item.content || [])
    .find(item => item.type === 'output_text')?.text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });

  const { action, question, cards = [], history = [] } = req.body || {};
  if (!question || !['plan', 'read'].includes(action)) return res.status(400).json({ error: 'Invalid request' });

  const isPlan = action === 'plan';
  const schema = isPlan ? planSchema : readingSchema;
  const system = isPlan
    ? `당신은 타로 상담의 스프레드를 설계합니다. 질문이 단순한 핵심 확인이면 1장, 감정·원인·흐름·선택을 함께 봐야 하면 3장을 선택하세요. 이유는 사용자에게 말하듯 한 문장으로 씁니다.`
    : `당신은 한국어 타로 상담가입니다. 사용자가 직접 뽑은 카드만 해석하세요. 카드 키워드를 나열하지 말고 질문에 직접 답하세요. 단정적인 예언, 공포 조장, 의료·법률·투자 확언은 피합니다. 이전 상담이 있으면 반복하지 말고 연결해서 해석하세요. 후속 질문은 서로 다른 관점 3개로, 카드 리딩으로 확인 가능한 구체적인 질문이어야 합니다.`;

  const userPayload = isPlan
    ? { question }
    : { question, selectedCards: cards, previousReadings: history.slice(-7) };

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        input: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userPayload) }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: isPlan ? 'tarot_reading_plan' : 'tarot_reading',
            strict: true,
            schema
          }
        }
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'OpenAI request failed' });
    const output = extractOutputText(data);
    if (!output) return res.status(502).json({ error: 'Empty model response' });
    return res.status(200).json(JSON.parse(output));
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected server error' });
  }
}
