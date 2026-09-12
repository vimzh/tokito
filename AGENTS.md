# Repository conventions

- This repository is a reusable hackathon starter. Keep shared setup generic and add product-specific behavior only when a project requires it.
- Prefer SQLite through Bun’s built-in `bun:sqlite` module for prototype persistence. Do not introduce Docker or a remote database unless concrete requirements exceed SQLite’s concurrency, scale, or feature limits.
- Run `bun run setup` when initializing a fresh copy of the template.
- Before implementing a medium or large feature, review `docs/idea.md` when it contains a product brief so decisions reflect the product’s purpose. Skip this step for small, direct user requests and proceed with those as written.

## Web app design

- Keep Tokito’s interface minimal, clean, and easy to use. Every UI element must serve a clear purpose; omit unnecessary decoration and controls.
- Do not use gradients, decorative left-only borders, or corner-only border accents on cards, panels, or callouts.
- Avoid generic AI-generated styling: excessive glow, glassmorphism, decorative blobs, gratuitous animations, and unnecessary badges or icons. Use deliberate spacing, clear hierarchy, restrained colors, and readable typography.
- Use Geist Pixel Square for headings. Use Manrope for descriptions, supporting text, navigation, buttons, and other interface text; do not apply the pixel font to entire page containers. Use Lucide icons wherever an icon is useful; do not add icons solely for decoration.
- Reuse shared shadcn/ui components first, checking `apps/web/src/components/ui` before adding anything. If a suitable shadcn/ui component is not installed, add and use it. Create a custom component only when shadcn/ui does not provide the required component or behavior, and reuse existing shared components within it.
- Preserve semantic HTML, accessible labels, keyboard navigation, visible focus states, and sufficient contrast while keeping the presentation simple.
