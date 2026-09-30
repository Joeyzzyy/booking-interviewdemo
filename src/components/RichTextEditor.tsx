"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImagePlus,
  Loader2,
} from "lucide-react";

/** 工具列按鈕 */
function ToolBtn({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // 保持編輯器焦點
        onClick();
      }}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-[#35a07a]/15 text-[#2a8163]" : "text-[#5d6b85] hover:bg-black/[0.04] hover:text-[#161b2e]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 輕量富文本編輯器（TipTap）：粗斜體/刪除線/列表/引用/連結/圖片上傳。
 * 圖片走 /api/board/upload（Supabase 公共桶），內容以 HTML 輸出（服務端會再 sanitize）。
 */
export default function RichTextEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image.configure({ inline: false }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: e }: { editor: Editor }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: "tiptap px-4 py-3" },
    },
  });

  const pickImage = async (f: File | null) => {
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (!f || !editor) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/board/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "圖片上傳失敗");
        return;
      }
      editor.chain().focus().setImage({ src: data.url }).run();
    } catch {
      setUploadError("網絡錯誤，圖片上傳失敗");
    } finally {
      setUploading(false);
    }
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("連結地址：", prev || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  };

  return (
    <div className="rounded-xl border border-black/[0.08] bg-white focus-within:border-[#35a07a]/50">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-black/[0.06] px-2 py-1.5">
        <ToolBtn label="粗體" active={editor?.isActive("bold")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn label="斜體" active={editor?.isActive("italic")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn label="底線" active={editor?.isActive("underline")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={15} />
        </ToolBtn>
        <ToolBtn label="刪除線" active={editor?.isActive("strike")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-black/[0.08]" aria-hidden="true" />
        <ToolBtn label="點列" active={editor?.isActive("bulletList")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolBtn>
        <ToolBtn label="數字列" active={editor?.isActive("orderedList")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolBtn>
        <ToolBtn label="引用" active={editor?.isActive("blockquote")} disabled={!editor || disabled}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolBtn>
        <span className="mx-1 h-5 w-px bg-black/[0.08]" aria-hidden="true" />
        <ToolBtn label="連結" active={editor?.isActive("link")} disabled={!editor || disabled} onClick={setLink}>
          <Link2 size={15} />
        </ToolBtn>
        <ToolBtn label="插入圖片" disabled={!editor || disabled || uploading}
          onClick={() => imageInputRef.current?.click()}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        </ToolBtn>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void pickImage(e.target.files?.[0] || null)}
        />
      </div>
      <EditorContent editor={editor} />
      {uploadError && <p className="px-4 pb-3 text-[12px] font-medium text-red-600">{uploadError}</p>}
    </div>
  );
}
