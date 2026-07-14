/**
 * Converts an LLM-drafted reply (plain text with blank-line-separated
 * paragraphs/lists and **bold**) into safe HTML for the outbound Zoho Desk
 * reply. Mirrors the client-side renderer in routes/admin-ui.ts (which
 * builds the same structure via DOM APIs for the admin preview) but this
 * copy runs server-side against real customer email, so all text is HTML-
 * escaped before any markup is introduced.
 */

interface ReplyBlock {
  type: 'p' | 'ul' | 'ol';
  items: string[];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseReplyBlocks(text: string): ReplyBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReplyBlock[] = [];
  let current: ReplyBlock | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) { current = null; continue; }

    const bulletMatch = /^[-*]\s+(.*)$/.exec(trimmed);
    const numMatch = /^\d+\.\s+(.*)$/.exec(trimmed);

    if (bulletMatch) {
      if (!current || current.type !== 'ul') { current = { type: 'ul', items: [] }; blocks.push(current); }
      current.items.push(bulletMatch[1]);
    } else if (numMatch) {
      if (!current || current.type !== 'ol') { current = { type: 'ol', items: [] }; blocks.push(current); }
      current.items.push(numMatch[1]);
    } else {
      if (!current || current.type !== 'p') { current = { type: 'p', items: [] }; blocks.push(current); }
      current.items.push(trimmed);
    }
  }

  return blocks;
}

function renderInline(line: string): string {
  return escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export function draftReplyToHtml(text: string): string {
  const blocks = parseReplyBlocks(text);
  return blocks.map((block) => {
    if (block.type === 'p') {
      return `<p>${block.items.map(renderInline).join('<br>')}</p>`;
    }
    const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join('');
    return `<${block.type}>${items}</${block.type}>`;
  }).join('\n');
}
