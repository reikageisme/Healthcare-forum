import { Category } from '../types';

/** Cha -> con -> cháu. Cùng con số với backend (MAX_CATEGORY_DEPTH). */
export const MAX_CATEGORY_DEPTH = 3;

export type CategoryLike = Pick<Category, 'id' | 'name'> & {
  parent_id?: string | null;
  sort_order?: number | null;
};

/** Con trực tiếp của từng chuyên mục, giữ nguyên thứ tự API trả về. */
export function childrenMap<T extends CategoryLike>(list: T[]): Map<string, T[]> {
  const byId = new Set(list.map((c) => c.id));
  const map = new Map<string, T[]>();
  for (const item of list) {
    // A child whose parent is missing is treated as a root, never dropped.
    if (!item.parent_id || !byId.has(item.parent_id)) continue;
    const bucket = map.get(item.parent_id) ?? [];
    bucket.push(item);
    map.set(item.parent_id, bucket);
  }
  return map;
}

export function rootsOf<T extends CategoryLike>(list: T[]): T[] {
  const byId = new Set(list.map((c) => c.id));
  return list.filter((c) => !c.parent_id || !byId.has(c.parent_id));
}

/** Số cấp tính từ gốc: chuyên mục gốc là 1. */
export function depthOf(id: string, list: CategoryLike[]): number {
  const byId = new Map(list.map((c) => [c.id, c]));
  let depth = 1;
  let cursor = byId.get(id)?.parent_id ?? null;
  // Bounded so a cycle in legacy data cannot hang the render.
  for (let i = 0; i < MAX_CATEGORY_DEPTH + 1 && cursor; i += 1) {
    depth += 1;
    cursor = byId.get(cursor)?.parent_id ?? null;
  }
  return depth;
}

/** Chiều cao nhánh: không có con là 1, có cháu là 3. */
export function branchHeight<T extends CategoryLike>(id: string, children: Map<string, T[]>): number {
  const kids = children.get(id) ?? [];
  if (kids.length === 0) return 1;
  return kids.some((k) => (children.get(k.id) ?? []).length > 0) ? 3 : 2;
}

export function descendantIds<T extends CategoryLike>(id: string, children: Map<string, T[]>): Set<string> {
  const out = new Set<string>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length > 0) {
    const item = stack.pop()!;
    if (out.has(item.id)) continue;
    out.add(item.id);
    stack.push(...(children.get(item.id) ?? []));
  }
  return out;
}

/**
 * Depth-first order with the depth of each row, which is what a table or a
 * <select> needs to indent by. The API already returns the list in this
 * order; rebuilding it here keeps the callers honest if that ever changes.
 */
export function flattenTree<T extends CategoryLike>(list: T[]): Array<{ item: T; depth: number }> {
  const children = childrenMap(list);
  const out: Array<{ item: T; depth: number }> = [];
  const seen = new Set<string>();
  const walk = (item: T, depth: number) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push({ item, depth });
    for (const child of (children.get(item.id) ?? []) as T[]) walk(child, depth + 1);
  };
  for (const root of rootsOf(list)) walk(root, 1);
  for (const item of list) if (!seen.has(item.id)) out.push({ item, depth: 1 });
  return out;
}

/**
 * Nhãn cho <option> trong ô chọn chuyên mục: một <select> không lồng được
 * phần tử, nên cấp được thể hiện bằng khoảng trắng cứng và dấu └.
 */
export function indentLabel(name: string, depth: number, icon?: string | null): string {
  const pad = '\u00a0\u00a0\u00a0'.repeat(Math.max(0, depth - 1));
  const arrow = depth > 1 ? '\u2514 ' : '';
  return `${pad}${arrow}${icon ? `${icon} ` : ''}${name}`;
}
