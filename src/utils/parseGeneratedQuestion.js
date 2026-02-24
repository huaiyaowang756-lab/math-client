/**
 * 将生成试题的纯文本解析为题目卡片协议格式。
 * 格式：【题干】...【答案】...【解析】...，公式支持多种 LaTeX 包裹：
 * $$...$$、\(...\)
 */

function parseBlocks(text) {
  if (!text || !text.trim()) return [];
  const blocks = [];
  // 匹配 $$..$$ 或 \(..\)；单 $ 易误匹配，不处理
  const re = /\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    if (before) blocks.push({ type: 'text', content: before });
    const latex = (m[1] ?? m[2] ?? '').trim();
    if (latex) blocks.push({ type: 'latex', content: latex });
    lastIndex = m.index + m[0].length;
  }
  const after = text.slice(lastIndex);
  if (after) blocks.push({ type: 'text', content: after });
  return blocks.length ? blocks : [{ type: 'text', content: text.trim() }];
}

function extractSection(text, tag) {
  const regex = new RegExp(`【${tag}】([\\s\\S]*?)(?=【|$)`, 'i');
  const m = text.match(regex);
  return m ? m[1].trim() : '';
}

/**
 * @param {string} content - 生成试题的纯文本
 * @returns {{ questionBody: Array, answer: Array, analysis: Array } | null}
 */
export function parseGeneratedQuestion(content) {
  if (!content || typeof content !== 'string') return null;
  const t = content.trim();
  const stem = extractSection(t, '题干');
  const answerText = extractSection(t, '答案');
  const analysisText = extractSection(t, '解析');

  if (!stem && !answerText) return null;

  const questionBody = stem ? parseBlocks(stem) : [];
  const answer = answerText ? parseBlocks(answerText) : [];
  const analysis = analysisText ? parseBlocks(analysisText) : [];

  return {
    questionBody: questionBody.length ? questionBody : [{ type: 'text', content: t }],
    answer,
    analysis,
  };
}
