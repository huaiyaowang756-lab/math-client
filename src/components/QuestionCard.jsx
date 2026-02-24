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
  const {
    description,
    difficulty,
    categories,
    questionBody = [],
    answer = [],
    analysis = [],
    questionType,
    score,
  } = question;
  const typeMap = { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', solution: '解答' };

  const renderBlocks = (blocks, assetBaseUrl) => (
    <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
      {blocks.map((b, i) => (
        <ContentBlock key={i} block={b} assetBaseUrl={assetBaseUrl} />
      ))}
    </div>
  );

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
      {questionBody.length > 0 && renderBlocks(questionBody, question.assetBaseUrl)}
      {answer.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ color: '#52c41a', fontWeight: 500, marginBottom: 6 }}>【答案】</div>
          {renderBlocks(answer, question.assetBaseUrl)}
        </div>
      )}
      {analysis.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ color: '#1890ff', fontWeight: 500, marginBottom: 6 }}>【解析】</div>
          {renderBlocks(analysis, question.assetBaseUrl)}
        </div>
      )}
    </Card>
  );
}
