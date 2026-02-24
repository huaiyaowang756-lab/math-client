import { Card, Tag } from 'antd';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function ContentBlock({ block, assetBaseUrl = '' }) {
  if (!block) return null;
  if (block.type === 'text') {
    const content = block.content || '';
    return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</span>;
  }
  if (block.type === 'latex' && block.content) {
    try {
      const html = katex.renderToString(block.content, {
        throwOnError: false,
        displayMode: false,
        errorColor: '#cc0000',
        strict: false,
      });
      return (
        <span className="content-latex-wrap" style={{ display: 'inline-block', maxWidth: '100%', verticalAlign: 'middle', margin: '0 0.1em' }}>
          <span className="content-latex" style={{ fontSize: '1.05em' }} dangerouslySetInnerHTML={{ __html: html }} />
        </span>
      );
    } catch {
      return <span>{block.content}</span>;
    }
  }
  if (block.type === 'image' || block.type === 'svg') {
    const rawUrl = (block.url || '').trim();
    const src = rawUrl.startsWith('http') ? rawUrl : (assetBaseUrl ? `${assetBaseUrl}${rawUrl}` : rawUrl);
    const w = block.width;
    const h = block.height;
    const imgStyle = {
      maxWidth: 240,
      maxHeight: 120,
      width: typeof w === 'number' && w > 0 ? w : undefined,
      height: typeof h === 'number' && h > 0 ? h : undefined,
      objectFit: 'contain',
      verticalAlign: 'middle',
      margin: '0 0.2em',
    };
    return <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}><img src={src} alt="" style={imgStyle} /></span>;
  }
  return null;
}

export default function QuestionCard({ question }) {
  const { description, difficulty, categories, questionBody = [], questionType, score } = question;
  const typeMap = { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', solution: '解答' };

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {typeof score === 'number' && (
          <Tag color="green">相关度 {score} 分</Tag>
        )}
        {difficulty && <Tag>{difficulty}</Tag>}
        {questionType && <Tag color="blue">{typeMap[questionType] || questionType}</Tag>}
        {(categories || []).map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </div>
      {description && <p style={{ color: '#666', marginBottom: 8 }}>{description}</p>}
      <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        {questionBody.map((b, i) => (
          <ContentBlock key={i} block={b} assetBaseUrl={question.assetBaseUrl} />
        ))}
      </div>
    </Card>
  );
}
