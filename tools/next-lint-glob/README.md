# Next lint directory matching

`@next/eslint-plugin-next@16.3.6` uses `fast-glob` only for
`globSync(pattern, { onlyDirectories: true })` in `get-root-dirs`.
Its dependency chain includes `braces@3.0.3`, affected by
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The published advisory currently lists no patched version.

The root override replaces that dependency with this private development
workspace, backed by pinned `tinyglobby@0.2.17`. The root development dependency
and `$fast-glob` override anchor the local path at the repository root for npm.
The adapter preserves literal directory matching, relative/absolute paths and
directory-only results. It
does not recursively expand a literal directory, and removes trailing slashes
without altering filesystem roots. Other fast-glob APIs are deliberately
unsupported. All Next.js, React, TypeScript and accessibility lint rules remain
enabled; the CI audit still includes development dependencies.

Run `npm run check:lint-tooling --workspace frontend` to exercise the installed
Next plugin's directory discovery and internal-link rule. CI runs this check.
The override applies only to Next's plugin version 16.3.6. Recheck its imports
and this compatibility suite when upgrading; retire the override and workspace
when upstream removes the vulnerable dependency chain.
