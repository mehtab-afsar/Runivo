/**
 * Metro has no tree shaking, so `import { Play } from 'phosphor-react-native'`
 * pulls all 1,500 icons into the bundle (about 5.7 MB of JS). This rewrites
 * each named import to the icon's own file, which the package exports as
 * `phosphor-react-native/src/icons/<Name>`:
 *
 *   import { Play, PathIcon, type Icon } from 'phosphor-react-native'
 *   → import { Play } from 'phosphor-react-native/src/icons/Play'
 *     import { PathIcon } from 'phosphor-react-native/src/icons/Path'
 *     import { type Icon } from 'phosphor-react-native'   (types only: erased)
 */
const fs = require('fs');
const path = require('path');

let iconFiles = null;
function iconFileFor(name) {
  if (!iconFiles) {
    const dir = path.join(path.dirname(require.resolve('phosphor-react-native/src/icons/Play')));
    iconFiles = new Set(fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => f.slice(0, -4)));
  }
  if (iconFiles.has(name)) return name;
  if (name.endsWith('Icon') && iconFiles.has(name.slice(0, -4))) return name.slice(0, -4);
  return null;
}

module.exports = function phosphorPerIcon({ types: t }) {
  return {
    name: 'phosphor-per-icon',
    visitor: {
      ImportDeclaration(p) {
        if (p.node.source.value !== 'phosphor-react-native' || p.node.importKind === 'type') return;
        const keep = [];
        const split = [];
        for (const spec of p.node.specifiers) {
          if (!t.isImportSpecifier(spec) || spec.importKind === 'type') { keep.push(spec); continue; }
          const imported = spec.imported.name ?? spec.imported.value;
          const file = iconFileFor(imported);
          if (!file) { keep.push(spec); continue; }
          split.push(t.importDeclaration(
            [t.importSpecifier(spec.local, t.identifier(imported))],
            t.stringLiteral(`phosphor-react-native/src/icons/${file}`),
          ));
        }
        if (split.length === 0) return;
        if (keep.length) p.insertAfter(split); else p.replaceWithMultiple(split);
        if (keep.length) p.node.specifiers = keep;
      },
    },
  };
};
