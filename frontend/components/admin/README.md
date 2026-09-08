# Admin layout conventions

All administration destinations share the route-group `AdminShell`. It owns the
fixed header, safe-area spacing, page gutters, maximum content width, and theme
tokens. Route content should not add a second viewport shell or page gutter.

- Use `AdminLayout.module.css` for panels, responsive record tables and dialogs.
  Table cells need a `data-label` so mobile cards retain their field labels.
- Use `AdminTool.module.css` for upload forms, inputs, action buttons, previews
  and import rows. Keep grid children at `min-width: 0`.
- Use `AdminDisclosure` for optional workflows that should not push the main
  task below long forms.
- Use inherited `--admin-*` tokens for surfaces, text, borders and status colors.
  Keep white text on filled primary buttons independent of surface tokens.
- At narrow widths, stack form fields and present records as labeled cards.
  Reserve horizontal scrolling for code previews and navigation.
- Keep all mutations in existing handlers. Responsive markup must preserve
  selection, edit, upload, pagination and confirmation behavior.

Before handing off a layout change, check populated and empty states at 320px,
390px, 768px and desktop widths in both themes. See `frontend/design.md` for
the safe-area and document-flow contract.
