// Type declaration for the <iconify-icon> web component loaded via CDN.
// See https://iconify.design/docs/iconify-icon/
declare namespace JSX {
  interface IntrinsicElements {
    'iconify-icon': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        icon?: string;
        width?: string | number;
        height?: string | number;
        rotate?: string | number;
        flip?: string;
        mode?: 'svg' | 'bg' | 'mask';
        inline?: boolean | string;
      },
      HTMLElement
    >;
  }
}
