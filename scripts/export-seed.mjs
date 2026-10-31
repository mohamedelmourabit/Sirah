// Run: npm run seed  — writes supabase/seed.sql
import { writeFileSync } from 'node:fs'
import { buildSeed } from './seed-lib.mjs'
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), await buildSeed())
console.log('wrote supabase/seed.sql')
