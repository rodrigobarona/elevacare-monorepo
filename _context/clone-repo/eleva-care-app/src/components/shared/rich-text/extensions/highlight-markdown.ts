/**
 * Highlight extension with Markdown support
 *
 * Extends @tiptap/extension-highlight to support markdown serialization
 * using the ==text== syntax (standard for highlights in extended markdown).
 *
 * This follows the official TipTap Markdown guide:
 * @see https://tiptap.dev/docs/editor/markdown/guides/create-a-highlight-mark
 *
 * @example
 * // In markdown: ==highlighted text==
 * // Renders as: <mark>highlighted text</mark>
 */
import {
  JSONContent,
  Mark,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  mergeAttributes,
} from '@tiptap/core';

export interface HighlightMarkdownOptions {
  multicolor: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlightMarkdown: {
      /**
       * Set a highlight mark
       */
      setHighlight: (attributes?: { color: string }) => ReturnType;
      /**
       * Toggle a highlight mark
       */
      toggleHighlight: (attributes?: { color: string }) => ReturnType;
      /**
       * Unset a highlight mark
       */
      unsetHighlight: () => ReturnType;
    };
  }
}

/**
 * Highlight extension configured for markdown serialization with @tiptap/markdown.
 *
 * Uses the official TipTap Markdown API with:
 * - markdownTokenizer: Recognizes ==text== syntax
 * - parseMarkdown: Converts tokens to TipTap JSON
 * - renderMarkdown: Serializes back to ==text== format
 */
export const HighlightMarkdown = Mark.create<HighlightMarkdownOptions>({
  name: 'highlight',

  addOptions() {
    return {
      multicolor: false,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    if (!this.options.multicolor) {
      return {};
    }

    return {
      color: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-color') || element.style.backgroundColor,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {};
          }

          return {
            'data-color': attributes.color,
            style: `background-color: ${attributes.color}; color: inherit`,
          };
        },
      },
    };
  },

  // Step 1: HTML parsing and rendering
  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  // Step 2: Custom Markdown tokenizer to recognize ==text==
  markdownTokenizer: {
    name: 'highlight',
    level: 'inline',
    // Fast hint for the lexer to find candidate positions
    start: (src: string) => src.indexOf('=='),
    tokenize: (
      src: string,
      _tokens: MarkdownToken[],
      lexer: MarkdownLexerConfiguration,
    ): MarkdownToken | undefined => {
      // Match ==text== at the start of the remaining source
      const match = /^==([^=]+)==/.exec(src);
      if (!match) return undefined;

      return {
        type: 'highlight',
        raw: match[0],
        text: match[1],
        // Let the Markdown lexer process nested inline formatting
        tokens: lexer.inlineTokens(match[1]),
      };
    },
  },

  // Step 3: Parse Markdown token to TipTap JSON
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    // Parse nested inline tokens into TipTap inline content
    const content = helpers.parseInline(token.tokens || []);
    // Apply the 'highlight' mark to the parsed content
    return helpers.applyMark('highlight', content);
  },

  // Step 4: Render TipTap node back to Markdown
  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) => {
    const content = helpers.renderChildren(node.content || []);
    // Wrap serialized children in == delimiters
    return `==${content}==`;
  },

  addCommands() {
    return {
      setHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
      unsetHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-h': () => this.editor.commands.toggleHighlight(),
    };
  },
});

export default HighlightMarkdown;
