import { access, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const roots = ['apps/admin/src', 'apps/web/app'];
const violations = [];

async function inspect(file) {
  const source = await readFile(file, 'utf8');
  const path = relative(process.cwd(), file).replaceAll('\\', '/');
  const exception = source.match(/UI_STANDARD_EXCEPTION:\s*(docs\/decisions\/[\w.-]+\.md)/);
  if (exception) {
    try {
      await access(exception[1]);
      return;
    } catch {
      violations.push(`${path}: UI 例外引用的 ADR 不存在：${exception[1]}`);
    }
  }
  const rules = [
    [/<select(?:\s|>)/i, '禁止原生 <select>；后台使用 AppSelect，用户端使用 ui/select。'],
    [/@(?:click|mousedown)\.self\s*=/i, '弹窗遮罩不得绑定点击关闭事件。'],
    [/window\.(?:alert|confirm)\s*\(/, '禁止浏览器 alert/confirm；使用统一反馈组件。'],
  ];
  for (const [pattern, message] of rules) {
    if (pattern.test(source)) violations.push(`${path}: ${message}`);
  }

  const approvedSelectImplementations = new Set([
    'apps/admin/src/components/AppSelect.vue',
    'apps/web/app/components/ui/select/Select.vue',
  ]);
  if (
    /role=["'](?:combobox|listbox)["']/.test(source) &&
    !approvedSelectImplementations.has(path)
  ) {
    violations.push(`${path}: 禁止在页面自制选择器；请完善并复用公共 Select 组件。`);
  }

  const legacyDialogPages = new Set([
    'apps/admin/src/views/IntegrationsView.vue',
    'apps/admin/src/views/RolesView.vue',
    'apps/admin/src/views/UsersView.vue',
  ]);
  if (source.includes('dialog-backdrop') && !legacyDialogPages.has(path)) {
    violations.push(`${path}: 禁止新增页面级弹窗结构；请使用公共 Dialog 组件。`);
  }
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (extname(file) === '.vue') await inspect(file);
  }
}

for (const root of roots) await visit(root);

if (violations.length) {
  console.error(`UI 一致性检查失败：\n${violations.map((item) => `- ${item}`).join('\n')}`);
  console.error(
    '\n如果公共组件确实不适用，请先记录 ADR，再在文件中注明 UI_STANDARD_EXCEPTION: docs/decisions/<adr>.md。',
  );
  process.exitCode = 1;
} else {
  console.log('UI 一致性检查通过。');
}
