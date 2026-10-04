/** Keep public theme hooks alongside CSS Module class names. */
export function bindStyleClasses(styles: Record<string, string>) {
  return (value: string | null | undefined | false) => {
    if (!value) return undefined;
    const names = value.split(/\s+/).filter(Boolean);
    return [...names, ...names.map(name => styles[name]).filter(Boolean)].join(' ');
  };
}
