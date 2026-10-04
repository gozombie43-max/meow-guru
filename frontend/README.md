This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Capture every route on mobile and desktop

From `frontend` on Windows, run:

```powershell
npm run screenshots:all
```

For the same collection in dark theme, run:

```powershell
npm run screenshots:all:dark
```

The default command captures light theme. Dark archives are named
`Meow-All-Routes-Screenshots_dark_<timestamp>.zip` and use the same folder
structure inside the ZIP. Each capture sets the app's saved theme and the browser
color scheme before navigation, and records and checks the rendered theme.

This clears only `frontend/screenshots`, installs Playwright Chromium if missing,
builds the current frontend, and uses the existing Playwright servers to capture
full-page screenshots at **390 × 844** (mobile) and **1366 × 900** (desktop).
It creates a timestamped ZIP directly in `C:\Users\91906\Downloads`, keeping
previous archives. Timestamps use India time.

```text
Meow-All-Routes-Screenshots/
├── mobile/<route-folder>/screenshot.png
├── desktop/<route-folder>/screenshot.png
└── capture-report.json
```

`/` becomes `home`; nested paths use `__`, such as `admin__users`.
The spec discovers `app/**/page.{tsx,ts,jsx,js}` automatically, ignoring route
groups, and captures one representative URL for each dynamic page family.
Add new dynamic examples in `e2e/all-routes-screenshots.spec.ts` when needed;
unresolved dynamic pages are reported as skipped.

Captures use the existing disposable backend fixture and fixture student login.
Admin captures use a browser-only admin identity to render the admin shell;
the rewards route uses an empty reward-track fixture. Other services absent from
the backend fixture show their actual empty/error states. The mock review fixture
is confidential and shows its review-disabled state. The report
records requested URLs, final URLs, HTTP status, failed fixture API requests,
uncaught browser errors, skips, and test results. Auth callback and alias routes
can redirect; these redirects are recorded. Browser errors are reported as
diagnostics when the screenshot is saved successfully. This is a local UI archive
with one representative URL per dynamic page family.

If captures fail, existing PNGs are still zipped and the command exits with code
1. An empty screenshot set never creates a ZIP. Build failures stop the command.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
