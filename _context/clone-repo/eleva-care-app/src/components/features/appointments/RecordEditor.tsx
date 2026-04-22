import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import { HighlightMarkdown } from '@/components/shared/rich-text/extensions/highlight-markdown';
import { Button } from '@/components/ui/button';
import { BulletList } from '@tiptap/extension-bullet-list';
import { Link } from '@tiptap/extension-link';
import { ListItem } from '@tiptap/extension-list-item';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  Bold,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  Table as TableIcon,
} from 'lucide-react';
import React, { useRef } from 'react';

interface RecordEditorProps {
  value: string; // Markdown content
  onChange: (value: string) => void; // Returns Markdown content
  readOnly?: boolean;
  autoFocus?: boolean;
}

const RecordEditorInner: React.FC<RecordEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  autoFocus = false,
}) => {
  // Use refs to avoid stale closures and unnecessary re-renders
  const onChangeRef = useRef(onChange);
  const isUpdatingFromProp = useRef(false);

  // Track initialization and external value for proper sync
  const hasInitializedContent = useRef(false);
  const lastExternalValue = useRef(value);
  const initialValueRef = useRef(value);

  // Update the onChange ref when it changes
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // All extensions used by the editor - memoized to prevent unnecessary re-renders
  const extensions = React.useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      // ✅ MARKDOWN SUPPORT: Using official @tiptap/markdown extension
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: false,
        },
      }),
      BulletList,
      ListItem,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline hover:text-primary/80',
        },
      }),
      // ✅ HIGHLIGHT WITH MARKDOWN: Custom extension with ==text== support
      HighlightMarkdown.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'bg-yellow-200 px-1 py-0.5 rounded',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start my-1',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse m-0 overflow-hidden table-fixed w-full border-2 border-gray-300',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class:
            'bg-gray-100 font-bold border-2 border-gray-300 box-border min-w-4 p-1 relative align-top',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border-2 border-gray-300 box-border min-w-4 p-1 relative align-top',
        },
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: '', // Start empty - content will be set in onCreate after editor is fully ready
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-hidden min-h-[200px] h-full px-3 py-2',
      },
    },
    immediatelyRender: false,
    // Set content after editor is fully initialized with all extensions
    onCreate: ({ editor }) => {
      // Use the initial value ref to ensure we use the value from mount time
      const initialContent = initialValueRef.current;
      if (initialContent) {
        editor.commands.setContent(initialContent, {
          emitUpdate: false,
          parseOptions: { preserveWhitespace: 'full' },
        });
      }
      // Mark initialization complete and sync the external value tracker
      hasInitializedContent.current = true;
      lastExternalValue.current = initialContent;
    },
    // Convert editor content to Markdown before calling onChange
    onUpdate: ({ editor }) => {
      // Don't emit changes if we're currently updating from external prop
      if (isUpdatingFromProp.current) {
        return;
      }

      // ✅ OFFICIAL @tiptap/markdown: Use the getMarkdown() method
      try {
        const markdownContent = editor.getMarkdown();
        // Track our own output to avoid comparison issues
        lastExternalValue.current = markdownContent;
        onChangeRef.current(markdownContent);
      } catch (error) {
        console.warn('Failed to convert to Markdown:', error);
        // Fallback to empty content to prevent corruption
        onChangeRef.current('');
      }
    },
  });

  // Handle external content updates while preserving cursor position
  React.useEffect(() => {
    // Skip if editor not ready or initialization hasn't completed (onCreate handles initial content)
    if (!editor || !hasInitializedContent.current) return;

    // Only update if external value actually changed (not from our own edits)
    // This comparison uses the tracked value, avoiding getMarkdown() normalization issues
    if (value === lastExternalValue.current) return;

    // Store current selection/cursor position and focus state
    const { from, to } = editor.state.selection;
    const wasFocused = editor.isFocused;

    // Flag that we're updating from external source
    isUpdatingFromProp.current = true;

    // Update our tracker to the new external value
    lastExternalValue.current = value;

    try {
      // ✅ OFFICIAL @tiptap/markdown: setContent with proper options
      editor.commands.setContent(value || '', {
        emitUpdate: false,
        parseOptions: { preserveWhitespace: 'full' },
      });

      // Restore cursor position after content update if editor was focused
      if (wasFocused) {
        // Use nextTick for reliable timing after content update
        Promise.resolve().then(() => {
          if (editor && !editor.isDestroyed) {
            const newDocSize = editor.state.doc.content.size;

            // Calculate safe cursor positions
            const safeFrom = Math.min(from, Math.max(0, newDocSize - 1));
            const safeTo = Math.min(to, Math.max(0, newDocSize - 1));

            try {
              // Restore selection using setTextSelection command
              if (safeFrom === safeTo) {
                editor.commands.setTextSelection(safeFrom);
              } else {
                editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
              }
              editor.commands.focus();
            } catch (selectionError) {
              console.warn('Cursor position restoration failed, focusing at end:', selectionError);
              editor.commands.focus('end');
            }
          }
        });
      }
    } catch (error) {
      console.warn('Advanced cursor preservation failed, using fallback:', error);
      editor.commands.setContent(value || '', { emitUpdate: false });
      if (wasFocused) {
        editor.commands.focus('end');
      }
    } finally {
      // Reset the flag after the microtask queue completes
      queueMicrotask(() => {
        isUpdatingFromProp.current = false;
      });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  if (readOnly) {
    return <EditorContent editor={editor} className="h-full" />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none border-b bg-muted/30">
        <div className="flex items-center gap-1 overflow-x-auto p-2">
          <div className="flex items-center gap-1 border-r border-border/50 pr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
              data-active={editor.isActive('bold')}
              style={{
                backgroundColor: editor.isActive('bold') ? 'hsl(var(--accent))' : 'transparent',
              }}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
              style={{
                backgroundColor: editor.isActive('italic') ? 'hsl(var(--accent))' : 'transparent',
              }}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="Highlight"
              style={{
                backgroundColor: editor.isActive('highlight')
                  ? 'hsl(var(--accent))'
                  : 'transparent',
              }}
            >
              <Highlighter className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border-r border-border/50 pr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1"
              style={{
                backgroundColor: editor.isActive('heading', { level: 1 })
                  ? 'hsl(var(--accent))'
                  : 'transparent',
              }}
            >
              <Heading1 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
              style={{
                backgroundColor: editor.isActive('heading', { level: 2 })
                  ? 'hsl(var(--accent))'
                  : 'transparent',
              }}
            >
              <Heading2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Heading 3"
              style={{
                backgroundColor: editor.isActive('heading', { level: 3 })
                  ? 'hsl(var(--accent))'
                  : 'transparent',
              }}
            >
              <Heading3 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border-r border-border/50 pr-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet List"
              style={{
                backgroundColor: editor.isActive('bulletList')
                  ? 'hsl(var(--accent))'
                  : 'transparent',
              }}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              title="Task List"
              style={{
                backgroundColor: editor.isActive('taskList') ? 'hsl(var(--accent))' : 'transparent',
              }}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                const url = window.prompt('Enter the URL');
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              title="Insert Link"
              style={{
                backgroundColor: editor.isActive('link') ? 'hsl(var(--accent))' : 'transparent',
              }}
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
              }}
              title="Insert Table"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* 
        ✅ MARKDOWN-POWERED RECORD EDITOR
        
        Features:
        ✅ Native Markdown Support: Uses official @tiptap/markdown extension
        ✅ Highlight with Markdown: Custom HighlightMarkdown extension with ==text== support
        ✅ Bidirectional Conversion: Seamlessly converts between Markdown and HTML
        ✅ Database-Ready: Content stored as markdown, displayed as rich HTML
        ✅ Reliable Initialization: Uses onCreate callback for proper extension setup
        
        Styling Classes (TailwindCSS):
        - Medical Tables: border-collapse border-2 border-gray-300 w-full
        - Table Headers: bg-gray-100 font-bold border-2 border-gray-300 p-1
        - Table Cells: border-2 border-gray-300 p-1 align-top
        - Task Items: flex items-start my-1
        - Highlighted Text: bg-yellow-200 px-1 py-0.5 rounded
        
        Benefits:
        ✅ Proper markdown parsing from database content
        ✅ Rich text editing with markdown storage
        ✅ Consistent rendering between edit and view modes
        ✅ Cursor position preserved during external updates
      */}
    </div>
  );
};

const RecordEditor: React.FC<RecordEditorProps> = (props) => (
  <ComponentErrorBoundary fallbackMessage="Could not load the record editor">
    <RecordEditorInner {...props} />
  </ComponentErrorBoundary>
);

export default RecordEditor;
