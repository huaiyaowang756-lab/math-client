import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export async function listLLMModels() {
  const res = await api.get('/llm-models/');
  return res.data?.models || [];
}

export async function recommendQuestions(query, limit = 5, llmModel = null) {
  const body = { query, limit };
  if (llmModel) body.llm_model = llmModel;
  const res = await api.post('/questions/recommend/', body);
  return res.data;
}

export default api;
