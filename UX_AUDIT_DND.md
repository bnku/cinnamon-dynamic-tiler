# UX Audit: Drag-and-Drop Tiling

Дата аудита: 2026-05-30

Фокус: пользовательский опыт перетаскивания окон мышью поверх существующей математики тайлинга. Аудит сделан по коду без live GUI-тестирования.

## Краткий вывод

Текущая реализация уже задает правильное направление: есть отдельный DnD-слой, ghost preview, elastic push соседей, схлопывание вакансии и интеграция результата обратно в общий cache. Но сейчас DnD работает скорее как экспериментальная физика сетки, а не как устойчивый пользовательский контракт.

Главная UX-боль: пользователь не всегда может предсказать, в какой момент окно становится частью сетки, почему выбрана именно эта ячейка, какие соседние окна поедут и как безопасно отменить действие. Для "конфетки" нужно сделать DnD не просто математически корректным, а обратимым, стабильным и объяснимым через поведение.

Оценка текущей готовности DnD UX: примерно 5.5-6/10. База сильная, но пограничные сценарии пока могут ощущаться резкими и магическими.

## Текущая модель

Сейчас DnD включается при начале оконного grab и дальше каждые 30ms пересчитывает preview, если зажат настроенный modifier (`src/extension.ts:159`, `src/extension.ts:198`, `src/extension.ts:282`).

Цель по X считается от левого края окна с учетом `dragOffsetX`; цель по Y считается не от окна, а от положения курсора в workarea: верхние 28% дают верхнюю половину, нижние 28% дают нижнюю половину, центр дает полную высоту или середину между окнами (`src/extension.ts:373`, `src/extension.ts:399`, `src/extension.ts:471`).

Перед показом preview вычисляется новое состояние всех затронутых окон через `calculateDragTransitions`, где сначала схлопывается старая вакансия перетаскиваемого окна, затем цель вставляется в сетку, затем пересекающиеся окна расталкиваются рекурсивно (`src/DragTiling.ts:34`, `src/DragTiling.ts:112`, `src/DragTiling.ts:123`).

На отпускании мыши последнее рассчитанное состояние применяется физически ко всем окнам и сохраняется в cache (`src/extension.ts:569`).

## Что Уже Хорошо

- Есть preview до commit: пользователь видит будущую раскладку до отпускания мыши.
- Dragged window и affected neighbors визуально различаются: основное окно ярче, вторичные окна слабее и dashed (`src/extension.ts:529`, `src/TilePreview.ts:27`).
- DnD не смешан напрямую с core keyboard math: отдельный `DragTiling.ts` помогает развивать UX-правила без поломки клавиатурного сценария.
- Есть попытка сохранять размер перетаскиваемого окна в логической сетке, а не всегда сбрасывать в 1/2 экрана (`src/extension.ts:381`).
- В коде уже есть понятие "вакансии" и ее схлопывания, что правильно для ощущения живой сетки.

## Критичные UX-Риски

### 1. Отмена, выход из режима и commit сейчас смешаны

Если пользователь отпускает modifier во время drag, код может сразу схлопнуть вакансию, очистить состояние окна и вернуть его в floating-геометрию под курсор (`src/extension.ts:315`, `src/extension.ts:329`, `src/extension.ts:341`, `src/extension.ts:654`). Для пользователя это опасный cliff: одно случайное отпускание клавиши меняет сетку прямо во время движения.

Почему это больно:
- человек может отпустить modifier не как команду "вынеси из сетки", а просто потому что меняет хват;
- соседние окна могут поехать до фактического отпускания мыши;
- действие трудно отменить, потому что cache уже изменен.

Решение:
- Ввести явную state machine: `idle -> grabbed -> armed -> previewing -> committed | cancelled | floated`.
- Пока мышь не отпущена, не применять геометрию соседей и не чистить cache.
- Отпускание modifier во время drag должно отменять preview или переводить окно в normal floating drag, но не должно само по себе commit-ить схлопывание.
- Commit сетки только на `grab-op-end`, если в момент отпускания мыши есть валидный preview.
- "Вынести tiled window из сетки" лучше сделать отдельным исходом: пользователь тянет окно достаточно далеко от исходной ячейки без активного DnD modifier и отпускает мышь. Тогда сетка схлопывается один раз на mouse release.

### 2. Preview имеет side effects до commit

Для нового окна без cache код прямо во время `onDragUpdate` сохраняет defaultState в cache (`src/extension.ts:417`, `src/extension.ts:426`). Это означает, что один preview может сделать floating window участником тайлинга даже до отпускания мыши.

Почему это больно:
- пользователь попробовал поднести окно к сетке, передумал, а окно уже оказалось логически зарегистрировано;
- последующие keyboard-команды могут вести себя так, будто окно было осознанно добавлено в layout;
- сложнее реализовать честную отмену.

Решение:
- Все состояния во время preview держать in-memory в `dragSession`.
- Cache менять только в `onGrabEnd` при успешном commit.
- Если нужно учитывать новое окно как участника расчета, создавать transient state вида `{ source: 'preview' }`, но не сохранять его.

### 3. Выбор цели не соответствует тому, что пользователь видит рукой

Горизонтальная цель считается от `winX = mx - dragOffsetX`, то есть от предполагаемого левого края окна (`src/extension.ts:373`, `src/extension.ts:399`). Вертикальная цель считается от самого курсора (`src/extension.ts:471`). Это две разные ментальные модели одновременно.

Пограничный пример:
- пользователь держит окно за правую часть заголовка;
- визуально курсор уже над нужной колонкой;
- но target по X все еще отстает, потому что считается левый край.

Решение:
- Выбрать один "intent hotspot".
- Для приятного UX лучше использовать курсор как insertion point, а текущий размер окна как preferred span.
- Вариант: `targetCenterCol = round((mx - workarea.x) / colWidth)`, затем строить `[center - width/2, center + width/2]` с clamp.
- Для edge snapping можно добавить специальные edge zones, но внутри рабочей области курсор должен ощущаться как точка намерения.

### 4. Нет hysteresis, возможен дребезг цели

Пороговые зоны `0.28` и `0.72` переключают вертикальный span мгновенно (`src/extension.ts:474`). При медленном движении около границы preview может прыгать между верхней половиной и полной высотой.

Решение:
- Добавить hysteresis: зона меняется только если курсор прошел границу плюс запас 4-8% workarea или 1 grid cell.
- Добавить dwell threshold 60-100ms для смены target, если смена вызывает движение соседей.
- Не пересоздавать preview-actors при мелких колебаниях; обновлять только когда target span реально стабилизировался.

### 5. Схлопывание вакансии происходит слишком рано для preview

`calculateDragTransitions` сначала схлопывает старую ячейку dragged window, а потом вставляет окно в target (`src/DragTiling.ts:34`, `src/DragTiling.ts:56`, `src/DragTiling.ts:89`). В preview это может выглядеть так, будто сетка уже "забрала" старое место, хотя пользователь еще не отпустил окно.

Решение:
- Во время preview считать два слоя:
  - source vacancy: старая ячейка подсвечивается как место, которое освободится;
  - target insertion: новая ячейка и affected neighbors.
- Физически и логически схлопывать source vacancy только на commit.
- Для same-monitor reorder можно preview-ить итоговую раскладку, но cache и реальные окна не трогать.

### 6. Cross-monitor сценарии требуют отдельного source/target контракта

Активный монитор во время drag выбирается по положению курсора (`src/extension.ts:357`). Но source window мог быть tiled на другом мониторе. При отпускании modifier или commit логика схлопывает и применяет состояния относительно текущего target monitor (`src/extension.ts:329`, `src/extension.ts:574`).

Почему это риск:
- vacancy может схлопнуться не на том мониторе;
- окно может "перевезти" свой старый span на монитор с другой workarea;
- соседние окна source monitor и target monitor требуют разных операций.

Решение:
- На `grab-op-begin` запоминать `sourceMonitor`, `sourceState`, `sourceGeometry`.
- Во время preview отдельно определять `targetMonitor`.
- Если `sourceMonitor !== targetMonitor`: source monitor только показывает vacancy/collapse preview; target monitor только показывает insertion preview.
- На commit выполнить две независимые операции: collapse source layout, insert into target layout.

## Важные Проблемные Сценарии

### Floating windows не должны случайно становиться tiled

`indexAllWindows` на старте drag переиндексирует все видимые окна кроме dragged (`src/extension.ts:188`, `src/extension.ts:217`, `src/extension.ts:273`). Это полезно для Smart Adapt, но в DnD может превратить обычные floating windows в участников сетки.

Решение:
- Разделить окна на `tiled`, `candidate`, `floatingObstacle`.
- `tiled`: участвуют в layout и могут быть сохранены.
- `candidate`: окно достаточно похоже на grid cell, его можно предложить включить.
- `floatingObstacle`: может учитываться как физическое препятствие для preview, но не получает cache и не двигается без явного включения.

### Вертикальная цель слишком грубая

Сейчас пользователь фактически выбирает только верхнюю половину, нижнюю половину, полную высоту или "середину", если есть окна сверху и снизу (`src/extension.ts:450`, `src/extension.ts:471`). Это не покрывает реальные ожидания drag:
- вставить окно в свободный нижний левый квартал;
- сохранить текущую высоту окна;
- вставить окно в третью строку кастомной сетки;
- подвинуть окно между двумя соседями без превращения в full height.

Решение:
- Target должен строиться от nearest available slot, а не от трех зон экрана.
- Сначала вычислять preferred span текущего окна.
- Затем искать ближайшую валидную область под курсором с учетом minSpan, overlap и свободных ячеек.
- Edge zones оставить как ускорители: верхний край = верхняя половина, нижний край = нижняя половина, левый/правый край = половина по X.

### Расталкивание зависит от порядка окон

В `calculateDragTransitions` сначала находится пересечение target с окнами, затем направление push выбирается по вектору между центрами (`src/DragTiling.ts:239`, `src/DragTiling.ts:252`). Если target пересекает несколько окон, порядок обработки зависит от `activeWindows`, то есть от порядка оконной системы/cache.

Решение:
- Сделать solver детерминированным:
  - сортировать affected windows по расстоянию до target и направлению движения;
  - после расчета прогонять collision resolution;
  - гарантировать инварианты: нет overlap, все внутри grid, размер не меньше minSpan, dragged window получает target или preview помечается invalid.
- Для UX лучше минимизировать суммарное движение соседей, а не просто выбирать направление по центру первого пересечения.

### Нет invalid preview

Сейчас почти любое target-состояние пытается быть примененным: окна сжимаются до minSpan, clamp-ятся к краям и preview показывается как будто все нормально (`src/DragTiling.ts:164`, `src/DragTiling.ts:222`, `src/extension.ts:518`).

Решение:
- Ввести результат solver-а: `{ status: 'valid' | 'blocked' | 'wouldOverlap' | 'tooSmall' }`.
- Если layout невозможен без неприятного сжатия: показывать нейтральный/disabled preview и не commit-ить.
- Не прятать невозможность за молчаливым minSpan: пользователь должен понять, что "сюда не влезает".

### Commit применяет окна по одному

На `grab-op-end` каждое окно получает `applyGeometry`, а внутри `applyGeometry` есть дополнительная preview-анимация и delayed move через 60ms (`src/extension.ts:585`, `src/CinnamonAdapters.ts:140`, `src/CinnamonAdapters.ts:146`). После DnD preview это может ощущаться как двойная анимация и временное рассинхронизированное движение.

Решение:
- Для DnD commit использовать отдельный apply path: без повторного TilePreview, с одним коротким batch transition.
- Применять сначала соседей, потом dragged window, или все окна в одном tick без per-window delay.
- Cache сохранять после успешного физического применения, либо хранить rollback data на случай ошибки одного окна.

## UX-Контракт, Который Стоит Зафиксировать

### Базовое правило

Drag-and-drop должен ощущаться как "перетащи окно в место сетки", а не как "перетащи окно и надейся, что физика правильно угадала".

### Состояния

- `grabbed`: пользователь тащит окно обычным способом, сетка не меняется.
- `armed`: modifier зажат, но target еще не стабилен.
- `previewing`: показан валидный target и affected neighbors.
- `cancelled`: modifier отпущен или курсор вышел из валидной зоны, preview исчез, layout не изменен.
- `committed`: mouse released при валидном preview, layout применен.
- `floated`: tiled window вынесено из сетки и source vacancy схлопнута на mouse release.

### Правила commit/cancel

- Preview никогда не пишет в cache.
- Соседние окна физически не двигаются до mouse release.
- Modifier release во время drag отменяет DnD preview, но не схлопывает layout немедленно.
- Mouse release без валидного preview не меняет tiled layout.
- Mouse release с валидным preview применяет layout атомарно.

### Правила выбора target

- Cursor = основная точка намерения.
- Текущий span окна = preferred size.
- Edge zones = быстрые крупные раскладки.
- Внутри экрана solver ищет ближайший валидный slot под курсором.
- Если target меняется резко, нужна hysteresis.

### Правила движения соседей

- Dragged window имеет приоритет.
- Соседи двигаются минимально возможным образом.
- Окна не должны пересекаться после solver-а.
- Окна не должны становиться меньше `minSpan`.
- Если решение невозможно, показывается invalid preview и commit запрещен.

## Рекомендуемая Дорожная Карта

### Этап 1: Сделать DnD безопасным

1. Убрать запись в cache из `onDragUpdate`.
2. Ввести `DragSession` с source monitor/state/geometry, target monitor, transient states.
3. Развести cancel, float и commit.
4. Запретить реальные движения соседей до `grab-op-end`.

Это даст пользователю главное чувство: "я могу пробовать и не сломаю раскладку".

### Этап 2: Сделать target предсказуемым

1. Перейти на cursor-centered insertion point.
2. Добавить hysteresis для зон и target span.
3. Заменить грубую vertical zone модель на nearest available slot.
4. Явно поддержать edge zones как быстрые намерения.

Это даст чувство точности: "окно идет туда, куда я его веду".

### Этап 3: Сделать solver надежным

1. Возвращать из `calculateDragTransitions` статус, affected windows и причины блокировки.
2. Добавить финальную проверку инвариантов: bounds, minSpan, no overlap.
3. Сделать порядок affected windows детерминированным.
4. Покрыть DnD-математику отдельными unit tests, не только keyboard engine.

Это снизит боль разработчиков: спорные кейсы станут тестируемыми правилами.

### Этап 4: Отполировать визуальный язык

1. Primary landing: яркая solid рамка.
2. Affected neighbors: слабая dashed рамка.
3. Source vacancy: отдельный тонкий outline, чтобы пользователь видел, что освободится.
4. Invalid target: приглушенная рамка, без commit.
5. Не запускать повторный TilePreview при DnD commit, если preview уже был показан.

Это даст ощущение контроля: "я понимаю последствия до отпускания мыши".

## Обязательные Тестовые Сценарии

- Floating window dragged with modifier, then modifier released before mouse release: layout/cache unchanged.
- Floating window previewed over grid, then cancelled: window is not added to cache.
- Tiled window dragged within same monitor and cancelled: source layout unchanged.
- Tiled window dragged out of grid and released as floating: source vacancy collapses once.
- Tiled window moved from monitor A to monitor B: A collapses, B inserts, no cross-monitor cache corruption.
- Cursor near 28%/72% boundary: target does not flicker.
- Drag by far-right part of titlebar: target follows cursor intent, not surprising left-edge math.
- Target overlaps multiple windows: deterministic result independent of window enumeration order.
- Not enough room for minSpan: invalid preview, no commit.
- DnD commit with preview enabled: no double-preview/delayed second animation.

## Итоговая Рекомендация

Не пытаться сразу довести elastic push до идеальной "физики". Сначала нужно зафиксировать UX-контракт и state machine. Как только cancel/commit/source/target станут строгими, остальная математика начнет обсуждаться проще: каждый пограничный кейс будет либо валидной вставкой, либо отменой, либо invalid preview, а не внезапным переездом окон.

Самая важная продуктовая мысль: DnD должен быть игровым и безопасным. Пользователь должен иметь возможность водить окно над сеткой, смотреть варианты, передумывать и отпускать только тогда, когда preview обещает ровно тот результат, который он хочет.
