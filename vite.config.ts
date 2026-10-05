import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const fake = (file: string) => fileURLToPath(new URL(`./src/planner/dev/${file}`, import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  // `npm run dev:fake`: Firebase is swapped for an in-memory fake with
  // invented data, so the planner never talks to the real project.
  resolve:
    mode === 'fake'
      ? {
          alias: [
            { find: /^firebase\/firestore$/, replacement: fake('fakeFirestore.ts') },
            { find: /^firebase\/app$/, replacement: fake('fakeApp.ts') },
            { find: /^firebase\/auth$/, replacement: fake('fakeApp.ts') },
          ],
        }
      : undefined,
}))
