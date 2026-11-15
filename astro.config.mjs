import { defineConfig } from 'astro/config';

// Tema de código con la paleta de kitty
const kitty = {
  name: 'kitty',
  type: 'dark',
  colors: {
    'editor.background': '#07070b',
    'editor.foreground': '#ffe4ea',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#b86b7e', fontStyle: 'italic' } },
    { scope: ['string.unquoted'], settings: { foreground: '#ffe4ea' } },
    { scope: ['string', 'string.quoted', 'punctuation.definition.string'], settings: { foreground: '#8fbfa3' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#f2c27a' } },
    { scope: ['constant.other.option', 'variable.parameter.option', 'variable.parameter'], settings: { foreground: '#e0a458' } },
    { scope: ['keyword', 'storage', 'keyword.control'], settings: { foreground: '#ff3b5c' } },
    { scope: ['keyword.operator', 'keyword.operator.pipe', 'punctuation.separator'], settings: { foreground: '#e45a96' } },
    { scope: ['entity.name.function', 'entity.name.command', 'support.function', 'meta.function-call'], settings: { foreground: '#9aa8d8' } },
    { scope: ['variable', 'variable.other', 'support.variable'], settings: { foreground: '#92c0c8' } },
    { scope: ['entity.name.type', 'entity.name.tag', 'support.class', 'support.type'], settings: { foreground: '#e45a96' } },
    { scope: ['punctuation'], settings: { foreground: '#d9c5cb' } },
    { scope: ['markup.inserted'], settings: { foreground: '#8fbfa3' } },
    { scope: ['markup.deleted'], settings: { foreground: '#ff3b5c' } },
  ],
};

export default defineConfig({
  site: 'https://algol0.github.io',
  markdown: { shikiConfig: { theme: kitty } },
});

