# Тексты для Консоли разработчика Яндекс Игр

Готово к копированию. Поля черновика заполняются в [Консоли](https://games.yandex.ru/console) → «Создать игру».

## Название

**Тапок**

Альтернативы, если занято: «Тапок: ШЛЁП! x9», «Тапок и мухи», «Шлёп-Тапок».

## Краткое описание (до 100 символов)

> Шлёпай мух тапком, собирай комбо x9 и прокачивай оружие от газеты до кибер-тапка.

## Полное описание

> На кухне неспокойно: мухи обнаглели и лезут прямо на торт.
>
> Тапай или свайпай по мухам — тапок бьёт точно в точку касания. Каждый быстрый шлепок подряд поднимает комбо-множитель до x9, а вместе с ним и очки. Одна муха доела и улетела — минус терпение. Три промаха, и забег закончен.
>
> Между волнами заходи в магазин: газета, мухобойка, электрошокер и кибер-тапок ждут, когда ты накопишь монеты. Комбо-окно, магнит монет, двойной шлепок и замедление мух — всё это остаётся с тобой навсегда.
>
> Каждая пятая волна — босс. Оса пикирует к столу, жук-броня держит удар, пока не треснет панцирь, а паук-плетун плодит паучат. Урон по боссу растёт вместе с комбо: серия шлепков решает.
>
> Волны идут бесконечно, темы кухни меняются от «Дачного ада» до «Кибер-кухни», а рекорд хранится в облаке — продолжай с любого устройства.

## Как играть

> Тапай или свайпай по мухам — тапок бьёт в точке касания, свайп ведёт шлепок за пальцем.
> Серия быстрых шлепков даёт комбо-множитель до x9: чем длиннее серия, тем больше очков.
> Муха, которая доела еду и улетела, отнимает терпение. Когда терпение кончится, забег завершится.
> Между волнами покупай в магазине оружие и улучшения за монеты — они остаются навсегда.
> Управление одной рукой: второй палец тоже работает, шлепки идут с обеих рук.

## Категории и настройки черновика

| Поле | Значение |
|---|---|
| Жанр | Аркады / казуальные игры |
| Ориентация | Любая (игра адаптируется под портрет и ландшафт) |
| Устройства | Мобильные + десктоп |
| Возрастной рейтинг | 0+ |
| Облачные сохранения | Включить |
| Реклама | Только через SDK: interstitial и rewarded video |
| Внутриигровые покупки | Нет |
| Языки | Русский, английский (автоопределение через SDK) |

## Теги / ключевые слова

мухи, тапок, аркада, казуальная, комбо, кликер, реакции, кухня, оса, паук, улучшения, на время, для одного, без интернета, гиперказуальная

## Медиаматериалы

- Иконка 512×512: `promo/icon-512.png` (запасной размер 1024×1024 — `promo/icon-1024.png`)
- Скриншоты (860×1720, портрет): `promo/01-menu.png`, `promo/02-wave.png`, `promo/03-boss.png`, `promo/04-shop.png`
- Дополнительно: `promo/08-beetle.png`, `promo/09-spider.png`, `promo/10-pause.png`, `promo/07-wide.png` (широкий 2200×1200)

Все материалы сгенерированы кодом самой игры (`tools/shots.ps1`), поэтому совпадают с ней пиксель в пиксель.

## Перед отправкой на модерацию

1. `powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1` → `dist/tapok.zip`.
2. Загрузить архив в черновик, заполнить поля выше.
3. Проверить в предпросмотре: звук, реклама, сохранение прогресса после перезагрузки страницы.
4. Отправить на модерацию (обычно 3–5 рабочих дней).

## Английская версия (для en-локали)

**Short:** Smack flies with a slipper, chain combos up to x9 and upgrade from a newspaper to a cyber slipper.

**Full:**
> The kitchen is under attack: cheeky flies are heading straight for the cake.
>
> Tap or swipe the flies — the slipper hits exactly where you touch. Every fast smack in a row builds a combo multiplier up to x9, and your score with it. One fly that finishes eating costs you patience. Lose three and the run is over.
>
> Between waves visit the shop: newspaper, fly swatter, shocker and cyber slipper are waiting for your coins. Combo window, coin magnet, double smack and fly slowdown stay with you forever.
>
> Every fifth wave brings a boss. The wasp dives at the table, the armoured beetle shrugs off damage until its shell cracks, and the weaver spider keeps dropping spiderlings. Boss damage grows with your combo — a steady smack streak beats random tapping.
>
> Waves never end, kitchen themes change from Country Hell to Cyber Kitchen, and your record is stored in the cloud — keep playing from any device.
