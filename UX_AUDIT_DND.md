# UX Audit: Drag-and-Drop Tiling

Дата повторного аудита: 2026-05-30

Фокус: UX перетаскивания окон мышью в Cinnamon extension после последних правок. Аудит сделан по коду и unit-тестам, без live GUI-тестирования.

## Статус Итерации 2026-05-30

Выполнена первая инженерная итерация по этому плану:

- добавлен experimental swap одинаковых по форме tiled-окон;
- swap вынесен в настройку `experimentalSwapSameShapeWindows` и выключен по умолчанию;
- swap срабатывает только при центральном попадании в target-окно, чтобы не конфликтовать с edge insertion/carving;
- preview-схлопывание source vacancy теперь использует тот же `collapseVacancy`, что и настоящий floating-out;
- порядок обработки окон сделан детерминированнее через сортировку по grid-позиции;
- добавлена проверка конфликтного layout: результат с overlap не показывается и не коммитится extension-ом;
- при отмене конфликтного DnD для tiled-окна окно возвращается в исходную tiled-геометрию;
- `floating-out` теперь отличает обычный drag без modifier от DnD-сессии, где modifier уже был задействован;
- при extraction из узкого вертикального stack-а вакансия схлопывается внутри stack-а, а широкие боковые окна не залезают в узкую дырку;
- оставшиеся окна узкого vertical stack-а после extraction перераспределяются равномерно, чтобы обратная вставка была естественной;
- добавлены unit-тесты на swap enabled/disabled, edge-hit fallback и different-shape fallback;
- `settings-schema.json` добавлен в репозиторий и копируется при `npm run build:extension`.

Выполнена вторая инженерная итерация:

- выбор DnD target вынесен из Cinnamon-specific `extension.ts` в pure-helper `computeDragTarget`;
- магнитные vertical zones покрыты unit-тестами: верхняя половина, full-height center, нижняя половина;
- cursor-to-target логика vertical stack insertion покрыта unit-тестом на вставку рядом с границей stack-а;
- добавлен guard для tight stack: если еще одно окно не помещается по `minSpan`, helper не предлагает stack insertion и оставляет базовый magnetic target;
- `extension.ts` теперь отвечает в основном за сбор контекста окон и preview/commit, а не за UX-математику target-а;
- для конфликтного DnD layout добавлен визуальный blocked preview: красная dashed-рамка target-а вместо молча исчезающего preview.

## Краткий вывод

DnD заметно повзрослел. Самые болезненные сценарии с Chrome, плавающим терминалом справа/слева, верхней половиной экрана и нижним chat-окном теперь покрыты явными правилами и тестами. Поведение уже ближе к пользовательскому контракту: preview не должен случайно записывать floating-окна в cache, tiled-окно можно вынести из сетки, а соседние окна чаще двигаются по ожидаемой горизонтальной оси.

Но до "конфетки" осталось несколько важных UX-слоев:

- target под курсором уже вынесен в тестируемый helper, но пока остается эвристическим, а не полноценным intent solver со статусами;
- часть решений все еще может зависеть от порядка окон в сложных tie-сценариях, хотя базовая сортировка уже добавлена;
- есть базовый визуальный blocked preview для overlap-конфликтов, но solver еще не возвращает полноценные причины `wouldOverlap/tooSmall/unstable`;
- вертикальный stack insertion теперь покрыт базовыми cursor-to-target тестами, но все еще требует ручной обкатки в плотных real-world раскладках;
- experimental swap уже добавлен, но его нужно обкатать руками и решить, стоит ли делать его дефолтным.

Оценка DnD UX после изменений: примерно 7/10. Это уже рабочая и приятная база, но в плотных раскладках с несколькими соседями пользователь все еще может увидеть "магическое" решение.

## Что Стало Сильно Лучше

### 1. Разведены commit, cancel и floating-out

В `dragSession` появились отдельные флаги `cancelled` и `floated`; commit происходит на `grab-op-end`, а не в середине preview. Для floating-окна отмена больше не должна превращать его в tiled-участника без явного commit.

UX-эффект: пользователь может примерять DnD безопаснее, а tiled-окно можно вынести из сетки с последующим схлопыванием источника.

Осторожность: отпускание modifier для tiled-окна сейчас трактуется как намерение сделать окно floating. Это полезно для фичи extraction, но может быть опасно при случайном отпускании клавиши.

### 2. Cursor-centered target по X стал намного понятнее

Горизонтальная цель теперь строится вокруг курсора и preferred width окна, а не вокруг левого края окна. Это исправляет главный UX-разрыв: пользователь ведет рукой в конкретное место, и preview следует за рукой.

UX-эффект: drop справа/слева от Chrome стал предсказуемее, особенно если окно схвачено не за левый край.

### 3. Возвращены вертикальные magnetic zones

Верхняя зона экрана дает верхнюю половину, нижняя зона дает нижнюю половину, центр дает полную высоту. Это важная "ручка", потому что пользователь получает быстрый жест для top/bottom/full-height без точного попадания в сеточные строки.

UX-эффект: поведение снова похоже на ручное примагничивание, а не на сухой grid editor.

### 4. Горизонтальный carving закрыл главный Chrome-сценарий

При пересечении target с большим окном solver сначала пытается вырезать место по горизонтали, и только потом по вертикали. Это исправляет кейс, где Chrome схлопывался по вертикали, хотя пользователь визуально вставлял терминал справа.

UX-эффект: широкое окно остается широким контекстом, а вставляемый терминал забирает колонку, не ломая нижний chat.

### 5. Floating-окна больше не создают фантомные вакансии

Dragged floating window не добавляется как transient tiled-окно в active layout. Это убирает класс багов, где новое плавающее окно сначала "как будто" занимает место в сетке, а потом solver пытается эту несуществующую вакансию схлопнуть.

UX-эффект: плавающее окно становится участником сетки только через понятный drop.

### 6. Появился вертикальный stack insertion

Если курсор рядом с границей вертикального стека, target может стать слотом между окнами или между краем экрана и окном. Это закрывает важный сценарий: "впихнуть окно в колонку", а не только "положить половиной сверху/снизу".

UX-эффект: DnD начинает ощущаться не только как snapping, но и как insertion.

## Главные Оставшиеся UX-Риски

### 1. Unconditional horizontal priority может быть слишком грубым правилом

Сейчас `calculateDragTransitions` всегда пробует `carveHorizontalAwayFromTarget` перед `carveVerticalAwayFromTarget`. Для Chrome-справа это идеально. Но в других сценариях это может дать странность.

Пограничный пример:

- есть full-height окно в колонке;
- пользователь ведет новое окно в верхнюю половину этой же области;
- визуально он ожидает вертикальное разделение: старое окно вниз, новое вверх;
- solver может сначала попробовать горизонтально сжать старое окно, если это математически возможно.

Рекомендация: заменить абсолютное "horizontal first" на intent-aware scoring.

Правило должно учитывать:

- target находится у левого/правого края большого окна -> предпочесть horizontal carving;
- target находится у верхнего/нижнего края большого окна -> предпочесть vertical carving;
- есть защищаемые окна в соседней вертикальной половине -> не трогать их без необходимости;
- если обе оси валидны, выбирать вариант с меньшим суммарным движением и меньшей потерей площади у соседей.

### 2. Source vacancy preview и final floating collapse используют разные алгоритмы

Во время `calculateDragTransitions` старая вакансия dragged-окна схлопывается простым neighbor-first правилом. При реальном floating-out вызывается отдельный `collapseVacancy`, где уже есть scoring кандидатов, проверка overlap и partial expansion.

UX-риск: preview при перемещении tiled-окна внутри сетки и итоговое схлопывание при выносе из сетки могут ощущаться как разные "физики". Пользователь будет учиться одному preview, а получать немного другое поведение в соседнем сценарии.

Рекомендация: вынести collapse vacancy в один pure-модуль и использовать один и тот же алгоритм:

- для preview;
- для floating-out;
- для cross-monitor source collapse;
- для тестов.

### 3. Extraction не знает, кто кого сжал

Сейчас при выносе окна из сетки `collapseVacancy` заполняет освободившееся место ближайшим валидным кандидатом. Это корректно геометрически, но не всегда идеально UX-семантически.

Проблемный пример:

- терминал был вставлен справа сверху и сжал Chrome;
- затем терминал вытаскивают из сетки;
- пользователь может ожидать, что Chrome вернется в "свое" прежнее состояние;
- solver вместо этого ищет безопасное заполнение вакансии, потому что не хранит историю "этот терминал сжал именно Chrome".

Рекомендация: добавить in-memory transaction journal для DnD.

При commit DnD сохранять:

- dragged window id;
- affected window ids;
- previous states affected окон;
- resulting states after commit;
- причину изменения: `carvedByTarget`, `pushedByTarget`, `vacancyCollapse`.

При extraction:

- если affected-соседи все еще находятся в ожидаемых resulting states;
- и восстановление previous states не создаст overlap;
- тогда восстановить именно их;
- иначе fallback на текущий `collapseVacancy`.

Так пользователь получит ощущение "если я вынул то, что только что вставил, раскладка чинится обратно", но без опасного blind undo.

### 4. Нет визуального invalid preview

Сейчас solver почти всегда пытается найти хоть какое-то валидное положение: сжимает, clamp-ит, частично вырезает, прогоняет sanitize. Для пользователя это иногда выглядит как "я просто подвел окно, а система решила переизобрести раскладку".

Статус после итерации: добавлен guard `hasLayoutOverlaps`; extension не коммитит результат, если итоговые states пересекаются. После второй итерации вместо полного исчезновения preview показывается красная dashed-рамка заблокированного target-а.

Оставшаяся рекомендация: `calculateDragTransitions` должен возвращать не только states, но и статус:

- `valid`;
- `blocked`;
- `wouldOverlap`;
- `tooSmall`;
- `unstable`.

Следующий слой: `calculateDragTransitions` должен возвращать причины блокировки, чтобы UI мог различать overlap, недостаточный `minSpan` и нестабильный solver, а не просто показывать общий blocked state.

### 5. Tie-сценарии все еще могут зависеть от порядка окон

В `calculateDragTransitions` пересекающиеся окна обрабатываются в порядке `activeWindows`. В `collapseVacancy` кандидаты сортируются по priority, но при равном priority порядок также приходит из списка окон.

UX-риск: одинаковая геометрия может дать разный результат после перезапуска Cinnamon, смены focus order или переиндексации cache.

Статус после итерации: добавлена базовая сортировка окон по grid-позиции и stable id, а vacancy candidates получили stable tie-breaker.

Оставшаяся рекомендация:

- сортировать intersecting windows детерминированно: расстояние до target, площадь overlap, затем стабильный window id;
- сортировать vacancy candidates по priority, overlap, площади изменения, направлению, затем stable id;
- добавить regression test, где один и тот же набор окон подается в разном порядке и дает одинаковый результат.

### 6. Vertical stack insertion есть, но target-эвристика пока хрупкая

Сама математика "вставить между двумя vertical windows" покрыта unit-тестом через готовый `targetVSpan`. Пользовательский слой, который превращает координаты курсора в этот `targetVSpan`, теперь вынесен в `computeDragTarget` и покрыт базовыми unit-тестами.

Пограничные сценарии:

- stack из 3-5 окон, где новый slot уже не помещается без нарушения `minSpan`;
- неравные высоты соседей, например `[0,8]` и `[8,12]`;
- курсор около границы magnetic zone и одновременно около stack boundary;
- narrow targetHSpan пересекает два разных вертикальных стека по горизонтали.

Статус после второй итерации: pure-helper добавлен, extension использует его напрямую. Следующий слой - расширить тесты на неоднозначные пересечения двух stack-ов, неравные высоты соседей и дребезг около границ.

### 7. Preferred height считается, но почти не используется

В `extension.ts` вычисляется `windowHeight`, но итоговый `targetVSpan` в основном определяется зонами 28%/72% или stack insertion. Это не ошибка само по себе, потому что edge/full-height gestures нужны. Но сейчас код как будто обещает "учитываю высоту окна", а UX фактически говорит "по вертикали решают зоны".

Рекомендация:

- либо явно принять продуктовый контракт: vertical DnD = top half / full height / bottom half / stack insertion;
- либо использовать preferred height в центральной зоне, когда пользователь тащит окно внутри уже существующего vertical stack или свободной области.

Для текущего продукта я бы оставил магнитные зоны как главный жест, но добавил preferred-height только для точного insertion внутри плотных стеков.

### 8. Modifier release для tiled-окна слишком много значит

Текущее поведение полезное: отпустил modifier у tiled-окна, продолжил обычный floating drag, на mouse release source vacancy схлопнулась. Именно так работает extraction.

Но UX-риск остается: случайное отпускание modifier внутри сетки тоже переводит сценарий в floating-out. Пользователь может думать, что он отменил preview, а в итоге при отпускании мыши сетка схлопнется.

Рекомендация:

- добавить extraction threshold: tiled window становится `floated`, только если cursor/window center ушел достаточно далеко от source slot или modifier отпущен за пределами валидного target preview;
- либо показывать отдельный source-vacancy preview после перехода в floating mode, чтобы было ясно: "если отпустить мышь сейчас, окно выйдет из сетки".

### 9. Experimental swap для равноценных окон добавлен

Пользователь часто мыслит не "вставить окно в сетку", а "поменять эти два окна местами". Если два окна имеют одинаковую форму в grid и не являются соседями, перетаскивание одного в центр другого должно ощущаться как прямой обмен, а не как повод запускать общий solver.

Пограничный пример:

- terminal A занимает `[0,2] x [0,6]`;
- terminal B занимает `[8,10] x [6,12]`;
- пользователь тащит A прямо в центр B;
- ожидаемый результат: A и B меняются местами, остальные окна не участвуют.

Статус после итерации: swap добавлен как отключаемая экспериментальная функция `experimentalSwapSameShapeWindows`, по умолчанию выключен.

Контракт срабатывания:

- настройка `experimentalSwapSameShapeWindows` включена;
- dragged window и target window имеют одинаковую ширину и высоту в grid;
- курсор находится в центральной зоне target window, например центральные 50-60% по обеим осям;
- target window не является непосредственным соседом dragged window, либо соседний swap требует более строгой центральной зоны;
- target не находится рядом с boundary, который пользователь мог использовать для insertion;
- edge magnetic zones имеют приоритет над swap.

Почему feature flag важен:

- swap меняет ментальную модель DnD, поэтому его лучше выкатывать как experimental;
- часть пользователей может ожидать только insertion/carve;
- разработчикам проще собирать обратную связь и быстро отключать спорное поведение без отката всей DnD-логики.

Визуальный контракт:

- source slot и target slot подсвечиваются как пара обмена;
- target window получает preview переезда в source slot;
- third-party windows не показываются как affected;
- если swap невозможен, UI возвращается к обычному solver preview или invalid preview.

## Проверка Текущих Тестов

Запуск `npm test -- --runInBand` прошел успешно: 44/44 тестов зеленые.

Хорошо покрыто:

- вставка floating terminal справа от Chrome;
- вставка floating terminal слева от Chrome;
- top-right terminal без движения bottom-right chat;
- приоритет horizontal carving;
- collapse vacancy после extraction;
- базовая математика vertical stack insertion;
- cursor-to-target расчет в `computeDragTarget`;
- magnetic zones: top half, full-height center, bottom half;
- отказ от stack insertion, если новый slot не помещается по `minSpan`.

Не покрыто:

- hysteresis и дребезг около границ 28%/72%;
- одинаковый результат при разном порядке active windows;
- invalid/blocked states;
- extraction threshold;
- cross-monitor DnD;
- сценарии с плотным vertical stack, где сумма `minSpan` уже близка к высоте grid.
- experimental same-shape swap: enabled/disabled, center-zone hit, neighbor ambiguity, order independence.

## Рекомендуемый Следующий План

### Этап 1: Зафиксировать target intent

Статус: реализовано. Расчет target вынесен из `extension.ts` в `computeDragTarget` и покрыт базовыми тестами:

- top edge -> top half;
- center -> full height;
- bottom edge -> bottom half;
- boundary between vertical stack windows -> insertion slot;
- boundary between screen edge and window -> edge insertion slot;
- cursor near boundary but not close enough -> не прыгать в stack insertion.

Следующий слой для этого этапа - добавить hysteresis и тесты на неоднозначные зоны, где курсор стоит почти на границе двух возможных намерений.

### Этап 2: Сделать solver result объяснимым

Перейти от `Record<string, WindowState>` к результату вида:

```ts
type DragSolveResult = {
  status: 'valid' | 'blocked';
  states: Record<string, WindowState>;
  affected: string[];
  reason?: string;
};
```

Статус: частично сделано на UI-стороне для overlap-конфликтов. Следующий слой - вернуть статус прямо из solver-а, чтобы UI показывал нормальный preview, disabled preview или вообще не commit-ил опасный результат с понятной причиной.

### Этап 3: Убрать order-dependence

Статус: частично сделано. Добавлена базовая deterministic sorting по grid-позиции и stable id. Следующий слой - property-style regression tests:

- один и тот же layout;
- разные permutation входных окон;
- один и тот же результат solver-а.

Для пользователя это даст ощущение стабильности: "эта раскладка всегда ведет себя одинаково".

### Этап 4: Experimental same-shape swap

Статус: реализовано. Добавлена отключаемая настройка расширения: `experimentalSwapSameShapeWindows`.

Приоритет в target intent:

1. Edge magnetic zones.
2. Boundary insertion в vertical/horizontal stack.
3. Experimental same-shape swap, если курсор явно в центре target window.
4. Free slot occupy.
5. Carve/push solver.

Покрытые и желательные тесты:

- two non-neighbor same-shape windows swap places - сделано;
- disabling setting returns to normal solver behavior - сделано;
- same area but different shape does not swap - сделано;
- cursor near target edge does not swap and can trigger insertion/carve - сделано;
- neighboring windows do not swap unless center hit is unambiguous;
- swap preview affects only dragged and target windows.

Это даст пользователю очень приятный короткий жест: "положил одно окно на такое же другое - они поменялись", но без навязывания экспериментального поведения всем.

### Этап 5: Transaction journal для обратимого DnD

Добавить короткую историю последнего DnD commit, чтобы extraction мог не просто схлопывать вакансию, а восстанавливать окна, которые именно этот dragged window сжал.

Это даст самый приятный UX-эффект: "вставил окно - вынул окно - раскладка разумно вернулась".

### Этап 6: Полировка extraction

Оставить фичу Ctrl/modifier extraction, но сделать ее более очевидной:

- source vacancy outline остается видимым после перехода в floating mode;
- floating-out commit происходит только на mouse release;
- желательно добавить threshold, чтобы случайное отпускание modifier не превращалось в вынос из сетки.

## Итог

Текущая реализация уже закрыла главную боль: DnD больше не выглядит как непредсказуемая перестройка всей сетки. Но следующий качественный скачок будет не от еще одной локальной эвристики, а от явного UX-контракта:

- сначала понять intent под курсором;
- затем решить layout с deterministic scoring;
- затем показать valid или invalid preview;
- затем commit-ить только то, что пользователь уже увидел.

Самые приоритетные оставшиеся улучшения: solver result со статусами и причинами, более глубокие permutation-тесты, transaction journal для extraction и ручная обкатка experimental swap. После этого DnD станет не просто рабочим, а таким, которому начинаешь доверять рукой.
