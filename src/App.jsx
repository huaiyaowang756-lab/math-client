import { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Spin, Empty, ConfigProvider, Select, Tooltip } from 'antd';
import { SendOutlined, PaperClipOutlined, ThunderboltOutlined, AppstoreOutlined, AudioOutlined } from '@ant-design/icons';
import { recommendQuestions, listLLMModels } from './api';
import QuestionCard from './components/QuestionCard';
import './index.css';

const { TextArea } = Input;

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [llmModels, setLLMModels] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState(null);
  const [deepThink, setDeepThink] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    listLLMModels().then(setLLMModels).catch(() => setLLMModels([]));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    const q = query.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await recommendQuestions(q, 5, selectedLLM || null);
      const qs = res?.questions || [];
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: qs.length > 0 ? `为您推荐了 ${qs.length} 道相关题目：` : '暂未找到匹配的题目，请尝试换一种描述方式。',
          questions: qs,
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '推荐失败';
      setMessages((prev) => [...prev, { role: 'assistant', content: `请求失败：${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8 },
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxWidth: 720,
        margin: '0 auto',
        width: '100%',
        background: '#fff',
      }}>
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
          }}
        >
            {messages.length === 0 && !loading && (
              <Empty description="在下方输入框输入需求开始" style={{ marginTop: 80 }} />
            )}
            <List
              dataSource={messages}
              renderItem={(m) => (
                <List.Item
                  style={{
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    border: 'none',
                    padding: '8px 0',
                    flexDirection: 'column',
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: m.role === 'user' ? '#4f46e5' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#1f2937',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.questions?.length > 0 && (
                    <div style={{ maxWidth: '100%', marginTop: 12 }}>
                      {m.questions.map((q) => (
                        <QuestionCard key={q.id} question={q} />
                      ))}
                    </div>
                  )}
                </List.Item>
              )}
            />
            {loading && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin tip="正在为您推荐题目..." />
              </div>
            )}
        </div>

        <div style={{
          flexShrink: 0,
          padding: '12px 16px 16px',
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
        }}>
          {llmModels.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Select
                placeholder="选择大模型"
                allowClear
                style={{ width: 160 }}
                value={selectedLLM || undefined}
                onChange={(v) => setSelectedLLM(v || null)}
                options={llmModels.map((m) => ({ label: m.name, value: m.model }))}
              />
            </div>
          )}
          <TextArea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder='发消息或输入 "/" 选择技能'
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={loading}
            style={{ marginBottom: 10, resize: 'none' }}
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <Tooltip title="上传文件">
              <Button type="text" icon={<PaperClipOutlined />} style={{ color: '#8c8c8c' }} />
            </Tooltip>
            <Button
              type={deepThink ? 'primary' : 'default'}
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => setDeepThink(!deepThink)}
              style={{ borderRadius: 16 }}
            >
              深度思考
            </Button>
            <Button
              type="default"
              size="small"
              icon={<AppstoreOutlined />}
              style={{ borderRadius: 16 }}
            >
              技能
            </Button>
            <div style={{ flex: 1 }} />
            <Tooltip title="语音输入">
              <Button type="text" icon={<AudioOutlined />} style={{ color: '#8c8c8c' }} />
            </Tooltip>
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
