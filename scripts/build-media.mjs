// Bundles media-src/panel.ts into media/panel.js (esbuild). Skips with a warning if esbuild isn't installed,
// so `npm run compile` still works with the prebuilt media/ that ships in the repo.
let esbuild
try { esbuild = await import('esbuild') } catch { console.warn('[build-media] esbuild not installed; keeping existing media/panel.js'); process.exit(0) }
await esbuild.build({ entryPoints: ['media-src/panel.ts'], outfile: 'media/panel.js', bundle: true, minify: true, format: 'iife', target: 'es2022', legalComments: 'none', logLevel: 'info' })
