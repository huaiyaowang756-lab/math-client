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

/** 直接推荐试题（跳过意图识别，用于兼容或显式调用） */
export async function recommendQuestions(query, limit = 5, llmModel = null) {
  const body = { query, limit };
  if (llmModel) body.llm_model = llmModel;
  const res = await api.post('/questions/recommend/', body);
  return res.data;
}

export default api;
