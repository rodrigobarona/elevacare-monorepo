---
name: tiptap
description: Tiptap Rich Text Editor integration for React 19+ with Tailwind v4 and shadcn/ui. Use when working with rich text editing, tiptap extensions, editor configuration, SSR-safe editor setup, or image upload handling in tiptap.
---

# Tiptap Rich Text Editor

**Status**: Production Ready  
**Dependencies**: React 19+, Tailwind v4, shadcn/ui (recommended)  
**Latest Versions**: @tiptap/react@3.16.0, @tiptap/starter-kit@3.16.0, @tiptap/pm@3.16.0

## Quick Start

### Install Dependencies

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-image @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-typography
```

### Create SSR-Safe Editor

```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export function Editor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello World!</p>',
    immediatelyRender: false, // CRITICAL for SSR/Next.js
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none min-h-[200px] p-4',
      },
    },
  })

  return <EditorContent editor={editor} />
}
```

**CRITICAL**: Always set `immediatelyRender: false` for Next.js/SSR apps to prevent hydration mismatch.

## Critical Rules

### Always Do

- Set `immediatelyRender: false` in `useEditor()` for SSR apps
- Install `@tailwindcss/typography` for prose styling
- Use upload handler for images (not base64)
- Memoize editor configuration to prevent re-renders
- Include `@tiptap/pm` peer dependency

### Never Do

- Use `immediatelyRender: true` (default) with Next.js/SSR
- Store images as base64 in database (use URL after upload)
- Forget to add `prose` classes to editor container
- Use EditorProvider and useEditor together (choose one)

## Extension Configuration

```typescript
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      bulletList: { keepMarks: true },
    }),
    Image.configure({
      inline: true,
      allowBase64: false, // Prevent base64 bloat
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-primary underline' },
    }),
    Typography,
  ],
})
```

**Extension order matters** - dependencies must load first.

## Markdown Support

```typescript
import { Markdown } from '@tiptap/markdown'

const editor = useEditor({
  extensions: [StarterKit, Markdown],
  content: '# Hello World\n\nThis is **Markdown**!',
  contentType: 'markdown',
  immediatelyRender: false,
})

const markdownOutput = editor.getMarkdown()
```

Always specify `contentType: 'markdown'` when setting markdown content.

## Form Integration with react-hook-form

```typescript
import { useForm, Controller } from 'react-hook-form'

function BlogForm() {
  const { control, handleSubmit } = useForm()
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="content"
        control={control}
        render={({ field }) => (
          <Editor
            content={field.value}
            onUpdate={({ editor }) => field.onChange(editor.getHTML())}
          />
        )}
      />
    </form>
  )
}
```

## Known Issues Prevention

1. **SSR Hydration Mismatch**: Set `immediatelyRender: false`
2. **Editor Re-renders**: Use `useEditorState()` hook or memoization
3. **Unstyled Content**: Install `@tailwindcss/typography` + add `prose` classes
4. **Base64 Image Bloat**: Set `allowBase64: false`, use upload handler
5. **ProseMirror Version Conflicts**: Use package resolutions to force single version
6. **EditorProvider vs useEditor**: Choose one, don't use both together

## Tailwind Prose Styling

```css
.tiptap {
  @apply prose prose-sm sm:prose-base dark:prose-invert max-w-none;
}
```

## Official Documentation

- API Reference: https://tiptap.dev/docs/editor/api/editor
- Extensions: https://tiptap.dev/docs/editor/extensions
- Installation: https://tiptap.dev/docs/editor/installation/react
