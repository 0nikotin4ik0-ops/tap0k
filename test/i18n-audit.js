/* Аудит локализации: собирает ключи, которые игра реально запрашивает,
   и проверяет, что каждый есть и в ru, и в en. Плюс семьи динамических ключей.
   Запуск: node test/i18n-audit.js */
'use strict';

const fs = require('fs');
const path = require('path');
const h = require('./harness').load();
const i18n = h.T.i18n;

const jsDir = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));

const staticKeys = new Set();
const dynamicFamilies = new Set();

const reStatic = /\.t\(\s*'([A-Za-z0-9_]+)'\s*[,)]/g;
const reDynamic = /\.t\(\s*'([A-Za-z0-9_]*)'\s*\+/g;

for (const f of files) {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  let m;
  while ((m = reStatic.exec(src))) {
    // ключ сразу после него не склеивается, значит это статический ключ
    staticKeys.add(m[1]);
  }
  while ((m = reDynamic.exec(src))) dynamicFamilies.add(m[1]);
}

/* Семьи, собранные в коде из частей */
const families = [];
// запасной ключ имени босса: t(boss.nameKey || 'bossName')
families.push('bossName');
// волны: 'w' + (1..12)
for (let i = 1; i <= 12; i++) families.push('w' + i);
// достижения: id берём из save.js
const saveSrc = fs.readFileSync(path.join(jsDir, 'save.js'), 'utf8');
const achIds = [...saveSrc.matchAll(/id:\s*'([a-z0-9]+)'/g)].map((m) => m[1]);
for (const id of achIds) { families.push('ach_' + id); families.push('ach_' + id + 'd'); }
// боссы: nameKey из конфига
const fliesSrc = fs.readFileSync(path.join(jsDir, 'flies.js'), 'utf8');
const bossKeys = [...fliesSrc.matchAll(/name:\s*'([a-z_]+)'/g)].map((m) => m[1]);
for (const k of bossKeys) families.push(k);

function missingIn(lang, keys) {
  i18n.setLang(lang);
  const miss = [];
  for (const k of keys) {
    if (i18n.t(k) === k) miss.push(k);
  }
  return miss;
}

const all = [...staticKeys].sort().concat(families);
const missRu = missingIn('ru', all);
const missEn = missingIn('en', all);
// префиксы семей уже развёрнуты вручную выше
const dynNote = [...dynamicFamilies].filter((k) => k !== 'w' && k !== 'ach_');

console.log('статических ключей в коде: ' + staticKeys.size);
console.log('динамических семей в коде: ' + (dynNote.join(', ') || 'нет') + ' (развёрнуты вручную)');
console.log('проверено всего ключей: ' + all.length);
console.log('не хватает в ru: ' + (missRu.length ? missRu.join(', ') : 'нет'));
console.log('не хватает в en: ' + (missEn.length ? missEn.join(', ') : 'нет'));

const fails = missRu.length + missEn.length;
console.log(fails ? '\nПРОВАЛЕНО' : '\nЛОКАЛИЗАЦИЯ ПОЛНАЯ');
process.exit(fails ? 1 : 0);
