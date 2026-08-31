import React, { useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Loader2,
  Unlink,
} from 'lucide-react';
import { uploadService } from '../../services/uploadService';
import { describeUploadError, validateImageFile } from '../../lib/uploadError';
import { cn } from '../../lib/utils';

interface RichTextEditorProps {
  content?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  onChange,
  placeholder = 'Viết nội dung bài viết sức khỏe chi tiết tại đây...',
  className,
  minHeight = '300px',
}) => {
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rounded-xl max-w-full my-4 border border-border shadow-sm mx-auto',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline font-medium hover:text-primary-dark cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-blue max-w-none focus:outline-none p-4 text-text',
          'prose-headings:text-text prose-p:text-text prose-strong:text-text prose-li:text-text'
        ),
        style: `min-height: ${minHeight};`,
      },
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editor) return;

    const file = files[0];
    const localError = validateImageFile(file);
    if (localError) {
      window.alert(localError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploadingImage(false);
      return;
    }

    try {
      setIsUploadingImage(true);
      const res = await uploadService.uploadImage(file);
      editor.chain().focus().setImage({ src: res.url, alt: file.name }).run();
    } catch (error) {
      console.error('Failed to upload image', error);
      window.alert(describeUploadError(error));
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Nhập đường dẫn URL:', previousUrl || 'https://');

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) {
    return (
      <div className="border border-border rounded-xl p-8 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn('border border-border rounded-xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all', className)}>
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-border text-slate-700 select-none">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('heading', { level: 1 }) && 'bg-primary/10 text-primary font-bold'
          )}
          title="Tiêu đề 1"
        >
          <Heading1 size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('heading', { level: 2 }) && 'bg-primary/10 text-primary font-bold'
          )}
          title="Tiêu đề 2"
        >
          <Heading2 size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('heading', { level: 3 }) && 'bg-primary/10 text-primary font-bold'
          )}
          title="Tiêu đề 3"
        >
          <Heading3 size={18} />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Basic Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('bold') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Đậm (Ctrl+B)"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('italic') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Nghiêng (Ctrl+I)"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('strike') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Gạch ngang"
        >
          <Strikethrough size={18} />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('bulletList') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Danh sách dấu chấm"
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('orderedList') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Danh sách số"
        >
          <ListOrdered size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('blockquote') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Trích dẫn"
        >
          <Quote size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('codeBlock') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Khối mã"
        >
          <Code size={18} />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={setLink}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors',
            editor.isActive('link') && 'bg-primary/10 text-primary font-bold'
          )}
          title="Chèn liên kết"
        >
          <LinkIcon size={18} />
        </button>
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-danger transition-colors"
            title="Xóa liên kết"
          >
            <Unlink size={18} />
          </button>
        )}

        {/* Image upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingImage}
          className={cn(
            'p-1.5 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1',
            isUploadingImage && 'opacity-50 cursor-not-allowed'
          )}
          title="Chèn ảnh từ thiết bị"
        >
          {isUploadingImage ? (
            <Loader2 size={18} className="animate-spin text-primary" />
          ) : (
            <ImageIcon size={18} />
          )}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo size={18} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo size={18} />
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
