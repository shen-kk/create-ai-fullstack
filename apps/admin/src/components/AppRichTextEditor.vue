<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { onBeforeUnmount, watch } from 'vue';

const props = withDefaults(
  defineProps<{ modelValue: string; ariaLabel?: string; placeholder?: string }>(),
  {
    ariaLabel: '富文本内容',
    placeholder: '请输入正文内容',
  },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const editor = useEditor({
  content: props.modelValue || '<p></p>',
  extensions: [StarterKit],
  editorProps: {
    attributes: {
      class: 'app-rich-text-content',
      'aria-label': props.ariaLabel,
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', currentEditor.isEmpty ? '' : currentEditor.getHTML());
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const nextValue = value || '<p></p>';
    if (editor.value.getHTML() !== nextValue) {
      editor.value.commands.setContent(nextValue, { emitUpdate: false });
    }
  },
);

onBeforeUnmount(() => editor.value?.destroy());
</script>

<template>
  <div class="app-rich-text-editor" :class="{ 'is-focused': editor?.isFocused }">
    <div class="rich-text-toolbar" role="toolbar" aria-label="正文格式工具栏">
      <button
        type="button"
        :class="{ active: editor?.isActive('bold') }"
        title="加粗"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        :class="{ active: editor?.isActive('italic') }"
        title="斜体"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        :class="{ active: editor?.isActive('heading', { level: 2 }) }"
        title="二级标题"
        @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        H2
      </button>
      <span class="toolbar-divider" />
      <button
        type="button"
        :class="{ active: editor?.isActive('bulletList') }"
        title="无序列表"
        @click="editor?.chain().focus().toggleBulletList().run()"
      >
        • 列表
      </button>
      <button
        type="button"
        :class="{ active: editor?.isActive('orderedList') }"
        title="有序列表"
        @click="editor?.chain().focus().toggleOrderedList().run()"
      >
        1. 列表
      </button>
      <button
        type="button"
        :class="{ active: editor?.isActive('blockquote') }"
        title="引用"
        @click="editor?.chain().focus().toggleBlockquote().run()"
      >
        引用
      </button>
      <span class="toolbar-divider" />
      <button type="button" title="撤销" @click="editor?.chain().focus().undo().run()">↶</button>
      <button type="button" title="重做" @click="editor?.chain().focus().redo().run()">↷</button>
      <button
        type="button"
        title="清除格式"
        @click="editor?.chain().focus().clearNodes().unsetAllMarks().run()"
      >
        清除格式
      </button>
    </div>
    <EditorContent v-if="editor" :editor="editor" />
    <p v-if="editor?.isEmpty" class="rich-text-placeholder">{{ placeholder }}</p>
  </div>
</template>

<style scoped>
.app-rich-text-editor {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dce3f0;
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.app-rich-text-editor.is-focused {
  border-color: #6672e5;
  box-shadow: 0 0 0 3px rgb(89 101 216 / 12%);
}
.rich-text-toolbar {
  display: flex;
  min-height: 48px;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  background: #f7f9fc;
  border-bottom: 1px solid #e4e8f1;
}
.rich-text-toolbar button {
  min-width: 32px;
  height: 32px;
  padding: 0 9px;
  color: #4b566a;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.rich-text-toolbar button:hover,
.rich-text-toolbar button.active {
  color: #4653d4;
  background: #e9edff;
}
.toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: #dfe4ed;
}
:deep(.app-rich-text-content) {
  min-height: 220px;
  padding: 16px 18px;
  color: #20283a;
  font-size: 14px;
  line-height: 1.75;
  outline: none;
}
:deep(.app-rich-text-content p) {
  margin: 0 0 10px;
}
:deep(.app-rich-text-content h2) {
  margin: 18px 0 8px;
  font-size: 20px;
}
:deep(.app-rich-text-content ul),
:deep(.app-rich-text-content ol) {
  margin: 10px 0;
  padding-left: 24px;
}
:deep(.app-rich-text-content blockquote) {
  margin: 12px 0;
  padding: 8px 14px;
  color: #626d81;
  background: #f7f8fb;
  border-left: 3px solid #6672e5;
}
.rich-text-placeholder {
  position: absolute;
  top: 65px;
  left: 18px;
  margin: 0;
  color: #a3abba;
  pointer-events: none;
}
@media (max-width: 640px) {
  .rich-text-toolbar {
    align-items: flex-start;
  }
  .toolbar-divider {
    display: none;
  }
}
</style>
