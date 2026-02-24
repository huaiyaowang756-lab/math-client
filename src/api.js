import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export async function listLLMModels() {
  const res = await api.get('/llm-models/');
  return res.data?.models || [];
}

/** 统一聊天入口：意图识别后路由到推荐试题或闲聊 */
export async function chat(query, limit = 5, llmModel = null) {
  const body = { query, limit };
  if (llmModel) body.llm_model = llmModel;
  const res = await api.post('/chat/', body);
  return res.data;
}

/** 流式聊天：使用 SSE，无超时限制，适合生成试题等长耗时场景 */
export function chatStream(query, limit, llmModel, onEvent) {
  const body = JSON.stringify({ query, limit, llm_model: llmModel || undefined });
  const url = '/api/chat/stream/';
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const evt = JSON.parse(line.slice(6));
            onEvent?.(evt);
          } catch (_) {}
        }
      }
    }
    if (buf.startsWith('data: ')) {
      try {
        const evt = JSON.parse(buf.slice(6));
        onEvent?.(evt);
      } catch (_) {}
    }
  });
}

/** 直接推荐试题（跳过意图识别，用于兼容或显式调用） */
export async function recommendQuestions(query, limit = 5, llmModel = null) {
  const body = { query, limit };
  if (llmModel) body.llm_model = llmModel;
  const res = await api.post('/questions/recommend/', body);
  return res.data;
}

/** 导出题目为 Word 试卷（用于组卷后下载），返回 blob */
export async function exportQuestionsDocx(ids, mode = 'student') {
  const res = await api.post('/questions/export/', { ids, mode }, { responseType: 'blob' });
  return res.data;
}

export default api;
