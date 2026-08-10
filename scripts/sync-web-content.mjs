import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
mkdirSync(resolve(root,'apps/web/public'),{recursive:true});
copyFileSync(resolve(root,'content/catalog.json'),resolve(root,'apps/web/public/catalog.json'));
