// Утилита очистки HTML перед вставкой через dangerouslySetInnerHTML
// Предотвращает XSS атаки, удаляя скрипты и опасные атрибуты.
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['ruby','rt','br','strong','em','span','div','p','ul','ol','li','a','img','h1','h2','h3','h4','h5','h6','blockquote','code','pre'], ALLOWED_ATTR: ['href','src','alt','class','id'] });
}
