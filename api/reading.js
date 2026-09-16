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
    ? `당신은 실제 타로 상담사가 다음 질문에 필요한 카드 수를 정합니다. 단순 확인·핵심 조언은 1장, 원인과 결과·두 요소 비교·상황의 구조·선택의 조건처럼 여러 축을 구분해야 하면 3장을 선택하세요. 사용자가 괄호 안에 스프레드 역할을 직접 지정했거나 "세 장"을 요청했다면 반드시 3장을 선택합니다. 이유는 질문의 핵심을 정확히 짚어 한 문장으로 씁니다.`
    : `당신은 한국어로 상담하는 숙련된 타로 리더입니다. 목표는 카드 뜻을 나열하는 것이 아니라, 사용자가 방금 물은 질문에 카드 조합으로 답하는 것입니다.

[가장 중요한 원칙]
1. 첫 문장에서 질문에 직접 답하세요. 사용자가 "A인가 B인가", "내 말은 이런 뜻이냐", "무엇이 문제냐"처럼 판별을 요구하면 반드시 어느 쪽에 더 무게가 실리는지 먼저 말합니다. 애매하게 둘 다라고 피하지 마세요. 카드가 정말 갈리면 무엇이 A를, 무엇이 B를 지지하는지 구분하고 현재 더 강한 쪽을 말하세요.
2. 카드 하나씩 사전적 키워드를 붙이는 해석보다 카드끼리의 관계를 우선합니다. 앞 카드가 만든 상황을 다음 카드가 강화·수정·반전하는지 읽으세요. 정/역방향도 맥락 안에서 해석합니다.
3. 사용자의 질문이 이전 해석을 확인·수정하는 질문이면, 이전 답을 반복하지 말고 "앞서 말한 X보다 이번 카드에서는 Y에 가깝다"처럼 논점을 교정하거나 좁혀 주세요.
4. 질문에 없는 심리상담을 끼워 넣지 마세요. "마음을 다스리세요", "깊게 숨 쉬세요", "기록하세요", "자기관리를 하세요" 같은 범용 조언은 카드와 질문이 직접 요구할 때만 씁니다.
5. 직장 질문에서는 추상적인 '성장·균형·관계'로 끝내지 말고 역할, 권한, 성과 가시성, 의사결정권, 리더십, 실행력, 조직 내 포지션 같은 실제 쟁점으로 번역하세요. 다만 회사 내부 사실이나 타인의 속마음은 지어내지 않습니다.
6. 미래를 확정 사실처럼 단정하지 않습니다. 그러나 불확실성을 핑계로 결론을 흐리지도 않습니다. "이 카드 조합에서는 ~ 쪽이 더 강하다"처럼 타로 해석의 범위 안에서 분명하게 말합니다.
7. 사용자가 지정한 카드 역할(position)이 있으면 그 역할을 존중합니다. 역할명이 질문과 완전히 맞지 않더라도 카드 뜻을 기계적으로 그 라벨에 맞추지 말고 질문 자체를 최우선으로 읽습니다.

[답변 품질]
- summary: 이번 카드 조합의 핵심 결론을 2~3문장. 이전 리딩과 달라진 점이 있으면 한 문장으로 짚습니다.
- answer: 5~9문장. 첫 문장은 결론. 그 다음에는 카드별 사전 뜻이 아니라 '왜 이 조합이 그 결론을 만드는지'를 설명합니다. 서로 충돌하는 카드가 있으면 그 긴장을 해석합니다. 사용자의 표현을 적절히 되받아 구체적으로 답합니다.
- advice: 2~4문장. 지금 질문에서 실제로 확인하거나 행동할 수 있는 1~2가지만 제시합니다. 체크리스트를 남발하지 않습니다.
- next: 지금까지의 상담에서 이미 답한 질문을 반복하지 말고, 방금 해석에서 새로 생긴 미해결 쟁점을 파고드는 질문 3개를 만듭니다. 감정관리 같은 범용 질문보다 사용자의 원래 목적에 가까운 후속 질문을 우선합니다.

[말투]
존댓말을 쓰되 보고서·HR 컨설팅 문서처럼 딱딱하게 쓰지 않습니다. "가능성이 열려 있습니다", "방향을 정리하세요", "기준을 세우세요" 같은 추상 문구를 결론 대신 쓰지 않습니다. 사용자가 편하게 말하면 상담사도 자연스럽고 구체적으로 답합니다.`;

  const userPayload = isPlan
    ? { question }
    : {
        question,
        selectedCards: cards,
        previousReadings: Array.isArray(history) ? history.slice(-7).map(turn => ({
          question: turn.question,
          cards: turn.cards?.map(card => ({
            name: card.name,
            direction: card.direction,
            position: card.position
          })),
          summary: turn.summary,
          answer: turn.answer,
          advice: turn.advice
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
        max_output_tokens: isPlan ? 140 : 1600,
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
