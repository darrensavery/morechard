import { describe, it, expect } from 'vitest';
import { draftReplyToHtml } from './replyFormat.js';

describe('draftReplyToHtml', () => {
  it('wraps blank-line-separated paragraphs in <p>, joining internal lines with <br>', () => {
    const html = draftReplyToHtml('Hi Darren,\n\nThanks for reaching out.\n\nBest,\nMorechard Support');
    expect(html).toBe('<p>Hi Darren,</p>\n<p>Thanks for reaching out.</p>\n<p>Best,<br>Morechard Support</p>');
  });

  it('renders a numbered list block as <ol><li>', () => {
    const html = draftReplyToHtml('1. First step\n2. Second step');
    expect(html).toBe('<ol><li>First step</li><li>Second step</li></ol>');
  });

  it('renders a bulleted list block as <ul><li>', () => {
    const html = draftReplyToHtml('- Alpha\n- Beta');
    expect(html).toBe('<ul><li>Alpha</li><li>Beta</li></ul>');
  });

  it('converts **bold** markers to <strong>', () => {
    const html = draftReplyToHtml('Please check the **6-character invite code**.');
    expect(html).toBe('<p>Please check the <strong>6-character invite code</strong>.</p>');
  });

  it('HTML-escapes raw text before applying markup, preventing injection via the draft text', () => {
    const html = draftReplyToHtml('Use <script>alert(1)</script> & "quotes"');
    expect(html).toBe('<p>Use &lt;script&gt;alert(1)&lt;/script&gt; &amp; "quotes"</p>');
  });

  it('handles mixed paragraphs and lists in one draft', () => {
    const text = 'Hi Darren,\n\n1. **Character mix:** codes are 6 chars\n2. **Any error?**\n\nBest,\nMorechard Support';
    const html = draftReplyToHtml(text);
    expect(html).toBe(
      '<p>Hi Darren,</p>\n' +
      '<ol><li><strong>Character mix:</strong> codes are 6 chars</li><li><strong>Any error?</strong></li></ol>\n' +
      '<p>Best,<br>Morechard Support</p>',
    );
  });
});
