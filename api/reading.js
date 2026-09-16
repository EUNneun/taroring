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
    : `당신은 한국어로 편안하게 대화하는 타로 상담가입니다. 사용자가 직접 뽑은 카드만 해석하고 질문에 먼저 답하세요. 존댓말을 쓰되 보고서나 회사 문서 같은 말투를 피하고, 일상에서 쓰는 쉬운 말로 말하세요. '흐름', '변수', '가능성이 열려 있다', '기준을 세우세요', '방향을 정리하세요'처럼 뜻이 흐릿한 표현을 결론 대신 반복하지 마세요. summary는 카드가 질문에서 가리키는 핵심을 1~2문장으로, answer는 질문에 대한 결론을 첫 문장에 놓고 각 카드가 왜 그런 해석으로 이어지는지 2~4문장으로, advice는 사용자가 바로 해볼 수 있는 행동 하나를 1~2문장으로 쓰세요. 직장 질문이면 질문의 초점(이직·승진·상사·동료·업무 등)에 맞춰 구체적으로 답하고, 질문에 없는 사실이나 타인의 속마음을 지어내지 마세요. 카드가 한 방향을 분명히 가리키지 않으면 무엇 때문에 판단이 갈리는지 짚어 주세요. 미래를 사실처럼 단정하거나 공포를 조장하지 말고, 의료·법률·투자 확언을 피하세요. 이전 상담이 있으면 반복하지 말고 연결하세요. 후속 질문 3개는 서로 다른 관점에서 실제로 궁금할 만한 구체적인 질문으로 쓰세요.`;

  const userPayload = isPlan
    ? { question }
    : {
        question,
        selectedCards: cards,
        previousReadings: Array.isArray(history) ? history.slice(-3).map(turn => ({
          question: turn.question,
          cards: turn.cards?.map(card => ({ name: card.name, direction: card.direction })),
          summary: turn.summary
        })) : []
      };

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        max_output_tokens: isPlan ? 120 : 1100,
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
