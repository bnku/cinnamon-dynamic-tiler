# Dynamic Tiler

[English](README.md) | Русский

Dynamic Tiler - это Cinnamon extension для умного тайлинга окон. Он оставляет обычный stacking desktop, но добавляет к нему самое приятное из tiling window manager: быстрые клавиатурные раскладки, аккуратное перетаскивание мышью, понятные preview, обмен окон местами и предсказуемое поведение в тесных и пограничных сценариях.

Внутри проекта есть чистое TypeScript-ядро с математикой сетки и Cinnamon-обертка, которая отвечает за пользовательский опыт: горячие клавиши, Drag-and-Drop, настройки под разные мониторы, подсветку, диагностику и интеграцию с Muffin.

## Почему Это Приятно Использовать

- Клавиатурный тайлинг не бинарный: повторные нажатия стрелок эластично двигают, расширяют и сужают окно по сетке.
- У resize есть короткая память: если ты нажал не туда и сразу жмешь противоположную стрелку, окно возвращается в прошлую форму, а не начинает новый неожиданный маневр.
- Drag-and-Drop понимает раскладку: окно можно вставить в стек, между соседями, к краю экрана или в узкую колонку, а solver постарается сохранить естественный layout.
- Swap сделан явно: зажимаешь swap-модификатор, и окна меняются геометрией с отдельной понятной подсветкой.
- Вытаскивание из сетки безопасное: если вытащить tiled-окно с модификатором, исходная ячейка схлопывается только когда жест явно ушел из источника.
- Сетки можно адаптировать под разные мониторы: обычный горизонтальный, вертикальный и ultrawide могут иметь разные column/row профили.

## Возможности

- Нативное Cinnamon extension для клавиатуры и мыши.
- Drag-and-Drop snapping с вставкой в горизонтальные и вертикальные стеки.
- Вставка между крайним окном и границей монитора.
- Intent-aware carving: широкое окно можно впихнуть в узкий стек без ручного предварительного сужения.
- Swap mode с настраиваемым модификатором.
- Профили сетки для горизонтальных, вертикальных и ultrawide мониторов.
- Настраиваемые gaps, preview, shortcuts, DnD modifier, swap modifier и debug logs.
- Чистое TypeScript-ядро с unit, regression и property/fuzz тестами.
- Legacy CLI/X11 режим для экспериментов и прямых команд.

## Установка

### Требования

- Linux Mint / Cinnamon на X11.
- Node.js и npm.
- Только для legacy CLI: `wmctrl`, `xdotool`, `x11-utils`.

На Ubuntu/Linux Mint:

```bash
sudo apt update
sudo apt install nodejs npm wmctrl xdotool x11-utils
```

### Сборка И Установка Cinnamon Extension

```bash
npm install
npm test
npm run build:extension
```

`npm run build:extension` делает две вещи:

- собирает локальный bundle расширения в `build/extension/`;
- устанавливает этот же bundle в `~/.local/share/cinnamon/extensions/dynamic-tiler@cinnamon.org/`.

После сборки перезагрузи Cinnamon или перезагрузи расширение через приложение Cinnamon Extensions, чтобы Cinnamon подхватил новые `extension.js`, `settings-schema.json` и `metadata.json`.

Полная сборка вместе с legacy CLI:

```bash
npm run build
```

## Настройки

Открой Cinnamon Extensions, выбери Dynamic Tiler и перейди в настройки расширения.

Настройки разнесены по вкладкам:

- Layout: gaps, preview, default grid, monitor profiles и per-monitor overrides.
- Drag & Drop: включение DnD и snap modifier.
- Keyboard: shortcuts для tile, shift и restore.
- Diagnostics: debug logging.

Текущие дефолты:

- default grid: `12 x 6`;
- обычные горизонтальные мониторы: `6 x 6`;
- вертикальные мониторы: `6 x 12`;
- ultrawide мониторы: `12 x 6`;
- минимальный размер окна: `2 x 2` ячейки.

Формат ручных per-monitor overrides:

```text
0:12x6, 1:6x12, 2:12x6
```

Debug logs по умолчанию выключены. Если включить их в Diagnostics, Dynamic Tiler будет писать подробные trace-логи в `~/.xsession-errors`.

## Управление С Клавиатуры

Базовые shortcuts настраиваются в settings расширения:

| Действие | Shortcut по умолчанию | Результат |
| --- | --- | --- |
| Tile left | `Super + Left` | Двинуть или изменить активное окно влево |
| Tile right | `Super + Right` | Двинуть или изменить активное окно вправо |
| Tile up | `Super + Up` | Двинуть или изменить активное окно вверх |
| Tile down | `Super + Down` | Двинуть или изменить активное окно вниз |
| Shift left/right/up/down | Настраивается | Быстро отправить окно к стороне |
| Restore | Настраивается | Вернуть сохраненную геометрию до тайлинга |

Клавиатурная модель специально сделана forgiving. Если ты изменил окно и быстро нажал противоположную стрелку, Dynamic Tiler считает это исправлением ошибки и возвращает предыдущую геометрию. Через короткую паузу противоположная стрелка снова работает как обычный resize.

## Управление Мышью

Зажми настроенный DnD modifier во время перетаскивания окна, чтобы оно участвовало в сетке.

Типовые жесты:

- бросить окно около стороны экрана, чтобы примагнитить его к этой стороне;
- бросить ближе к верху/низу/центру, чтобы выбрать верхнюю половину, нижнюю половину или полную высоту;
- бросить между окнами в стеке, чтобы вставить туда новый слот;
- бросить между крайним окном и границей монитора, чтобы создать слот у края;
- зажать swap modifier, чтобы обменять два окна местами вместо вставки.

Preview должен заранее показывать, что произойдет после отпускания мыши. Обычная вставка, blocked placement и swap отличаются визуально.

## Разработка

```bash
npm install
npm test
npm run build:cli
npm run build:extension
```

Важные пути:

- `src/core/` - чистая математика тайлинга и use cases.
- `src/DragTiling.ts` - выбор DnD target, insertion, carving, swap и vacancy collapse.
- `src/extension.ts` - Cinnamon integration, settings, shortcuts, previews и drag hooks.
- `settings-schema.json` - UI настроек Cinnamon.
- `tests/` - regression, use-case и property/fuzz покрытие.
- `build/extension/` - локальный собранный bundle расширения.
- `~/.local/share/cinnamon/extensions/dynamic-tiler@cinnamon.org/` - установленный Cinnamon bundle.

## Legacy CLI

CLI все еще существует для экспериментов и прямой X11-автоматизации:

```bash
npm run build:cli
node dist/cli.js tile left
node dist/cli.js tile right
node dist/cli.js restore
```

Для обычного использования основной продукт - Cinnamon extension.

## Статус

Dynamic Tiler - активный UX-first эксперимент над тайлингом. Главный фокус сейчас на местах, где реальные пользователи чаще всего злятся: узкие стеки, края экрана, разные мониторы, случайно отпущенные modifiers, вытаскивание окон из сетки и тонкая разница между "хочу вставить окно сюда" и "хочу поменять эти два окна местами".
