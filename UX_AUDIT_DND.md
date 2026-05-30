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
- для конфликтного DnD layout добавлен визуальный blocked preview: красная dashed-рамка target-а вместо молча исчезающего preview;
- добавлен `solveDragTransitions` со статусом `valid/blocked`, причиной блокировки и списком affected-окон;
- extension переведен с прямого `calculateDragTransitions` на `solveDragTransitions`;
- добавлены regression-тесты на причины `wouldOverlap/tooSmall`, affected windows и стабильный результат при разном порядке окон.

Выполнена третья инженерная итерация:

- добавлен `DragTransactionSnapshot` для последнего успешного DnD commit-а;
- extension сохраняет `before/after/affected` для DnD-сессии;
- при extraction сначала вызывается `restoreDragTransaction`: если dragged-окно и affected-соседи все еще стоят в ожидаемых after-states, соседи получают прежние spans;
- если состояние изменилось или восстановление создает конфликт, поведение безопасно падает обратно в обычный `collapseVacancy`;
- добавлены regression-тесты на успешное transaction restore и fallback после ручного изменения соседа.

Выполнена четвертая инженерная итерация:

- wide dragged-окно теперь может принимать ширину узкого vertical stack-а под курсором;
- tight stack insertion больше не блокируется автоматически, если stack узкий и есть горизонтальный маневр;
- solver пробует перенести pinned vertical stack в соседнюю колонку и ужать горизонтальный blocker, если это дает валидную раскладку;
- full-width tight stack по-прежнему не предлагает insertion, если по вертикали новый slot не помещается;
- добавлен horizontal edge insertion: можно впихнуть окно между крайним окном horizontal stack-а и краем экрана;
- wide dragged-окно при horizontal edge insertion сужается до ширины ближайшего slot-а, а не тащит свой текущий preferred width;
- horizontal edge insertion сдвигает настоящий row-stack внутрь, а одиночного крайнего соседа сдвигает только при явном screen-edge intent;
- wide clamped target теперь считает экранный край намеренной границей edge insertion, даже если курсор ближе к внутренней границе соседа;
- solver получает исходный `preferredWidth`, чтобы отличить auto-narrow edge insertion от скрытого swap;
- добавлены regression-тесты на narrow-stack target adoption, horizontal relief для pinned stack, edge insertion для horizontal stack, single-edge neighbor, auto-narrow wide dragged-окна и wide clamped edge insertion.

Выполнена пятая инженерная итерация:

- добавлен `DnD trace` в extension для диагностики blocked/stack-решений без live-debugger;
- floating dragged-окно теперь передает в target solver текущую геометрию окна во время drag-а, а не stale source geometry;
- interior horizontal insertion умеет auto-narrow: если широкий dragged-slot не помещается между двумя окнами, target сжимается до минимально валидного slot-а;
- horizontal insertion между соседями и у края экрана теперь закрывает кейсы, где раньше широкое окно блокировало очевидный пользовательский маневр;
- добавлена session-память последнего DnD target-а: top/bottom/full magnetic zones и stack-boundary insertion имеют hysteresis и не прыгают от микродрожания курсора;
- добавлены regression-тесты на interior horizontal auto-narrow, magnetic height hysteresis, vertical stack-boundary hysteresis и horizontal boundary hysteresis.

Выполнена шестая инженерная итерация:

- добавлен pure-helper `shouldFloatAfterModifierRelease` для безопасного определения намерения extraction;
- случайное отпускание DnD modifier почти без движения мыши теперь трактуется как cancel, а не как вынос окна из сетки;
- реальный floating-out происходит только если курсор ушел от точки начала drag-а примерно на 80px;
- после перехода в floating mode source vacancy outline остается видимым до mouse release, чтобы пользователь видел будущую вакансию;
- edge insertion стал терпимее к минимальному крайнему окну: если dragged target пересекает edge-neighbor минимальной ширины, target может сжаться до edge-slot и сдвинуть соседа внутрь;
- по DnD trace исправлен edge-case, где target уже был правильным, но solver блокировал drop из-за попытки сдвинуть весь row-stack;
- вместо отдельных правого/левого костылей добавлен общий edge corridor solver: он сдвигает цепочку минимальных колонок от края внутрь и сжимает первый широкий donor, например справа Chrome `[4,10] -> [4,8]`, edge-window `[10,12] -> [8,10]`, а слева `[0,2] -> [2,4]`, `[2,4] -> [4,6]`, Chrome `[4,10] -> [6,10]`;
- blocked preview начал визуально различать причины блокировки: overlap, too-small и out-of-bounds получают разные dashed-сигналы без текстовых подсказок в UI;
- добавлены regression-тесты на accidental modifier release и intentional extraction.

Выполнена седьмая инженерная итерация:

- последний DnD commit заменен на bounded transaction history последних DnD-вставок;
- extraction теперь ищет подходящую restorable-транзакцию по dragged window, monitor и текущим after-state, а не слепо смотрит только на последнюю операцию;
- если после вставки одного окна пользователь сделал DnD другого окна, первое окно все еще может корректно вернуть своих сжатых соседей при extraction;
- для одного и того же dragged-окна сохраняется свежая транзакция, чтобы не откатывать устаревшую историю после повторной вставки;
- добавлены regression-тесты на restore из истории после чужой DnD-операции и на выбор самого свежего matching snapshot-а.

Выполнена восьмая инженерная итерация:

- unconditional `horizontal first` carving заменен на scoring реальных horizontal/vertical кандидатов;
- solver теперь выбирает ось по меньшей потере площади окна, edge-intent у target-а и стабильному tie-breaker-у;
- верхняя/нижняя вставка в широкое окно больше не должна превращаться в странное боковое сжатие, если вертикальный carve явно сохраняет больше полезной площади;
- Chrome/top-right сценарии сохранены: при равной цене и выраженном правом edge-intent поведение остается горизонтальным;
- добавлен regression-тест на vertical carving для top insertion в широкое окно.

Выполнена девятая инженерная итерация:

- vertical stack insertion получил более сильный приоритет над horizontal relief, если существующая колонка уже покрывает всю высоту и новое окно физически помещается по `minSpan`;
- вместо переноса всей узкой колонки в соседний слот solver перераспределяет высоты stack-а на месте: например 3 окна по 4 строки становятся 4 окнами по 3 строки;
- маленький локальный tight-stack, который занимает только часть высоты экрана, по-прежнему может использовать horizontal relief;
- исправлен UX-разрыв, где preview обещал insertion в vertical stack, а итоговый commit создавал новую вертикаль сбоку;
- добавлен regression-тест на in-place redistribution full-height vertical stack-а перед horizontal relief.

## Краткий вывод

DnD заметно повзрослел. Самые болезненные сценарии с Chrome, плавающим терминалом справа/слева, верхней половиной экрана, нижним chat-окном, узкими вертикальными стеками и широким dragged-окном теперь покрыты явными правилами и тестами. Поведение уже ближе к пользовательскому контракту: preview не должен случайно записывать floating-окна в cache, tiled-окно можно вынести из сетки, а соседние окна чаще двигаются по ожидаемой горизонтальной оси.

Но до "конфетки" осталось несколько важных UX-слоев:

- target под курсором уже вынесен в тестируемый helper и получил session hysteresis, но пока остается эвристическим, а не полноценным intent solver со статусами;
- часть решений все еще может зависеть от порядка окон в сложных tie-сценариях, хотя базовая сортировка уже добавлена;
- есть визуальный blocked preview и solver result с причинами `wouldOverlap/tooSmall/outOfBounds`; UI уже различает эти причины цветом/стилем рамки, но без текстового объяснения;
- extraction теперь умеет возвращать сжатого DnD-соседа назад через transaction journal/history и защищена threshold-ом от случайного отпускания modifier;
- вертикальный stack insertion теперь покрыт базовыми cursor-to-target тестами, умеет in-place redistribution для full-height stack-а, horizontal relief для локального pinned stack-а и получил hysteresis, но все еще требует ручной обкатки в плотных real-world раскладках;
- experimental swap уже добавлен, но его нужно обкатать руками и решить, стоит ли делать его дефолтным.

Оценка DnD UX после изменений: примерно 8.7/10. Это уже рабочая и приятная база, но в плотных раскладках с несколькими соседями пользователь все еще может увидеть "магическое" решение.

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

### 1. Intent-aware carving нужно расширить на multi-window scoring

Базовый `horizontal first` уже заменен на scoring horizontal/vertical carve-кандидатов. Это закрывает главный UX-разрыв: верхняя вставка в широкое окно предпочитает вертикальный carve, а правый Chrome-кейс сохраняет горизонтальный carve.

Оставшийся риск теперь тоньше: scoring пока принимает решение локально для конкретного пересекающегося окна. В сложной раскладке несколько окон могут быть затронуты каскадно, и глобально лучший вариант может отличаться от локально лучшего.

Оставшаяся рекомендация: поднять scoring на уровень всего layout-кандидата.

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

Статус после третьей итерации: базовый in-memory transaction journal добавлен.

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

Статус после седьмой итерации: вместо одного snapshot-а хранится bounded history последних DnD-вставок. Это не полноценный multi-step undo layout-а, но закрывает более естественный сценарий: "вставил окно A, потом подвигал окно B, потом вынул A" - A все еще может вернуть именно тех соседей, которых оно сжало, если текущие after-state совпадают и восстановление не создает overlap.

### 4. Нет визуального invalid preview

Сейчас solver почти всегда пытается найти хоть какое-то валидное положение: сжимает, clamp-ит, частично вырезает, прогоняет sanitize. Для пользователя это иногда выглядит как "я просто подвел окно, а система решила переизобрести раскладку".

Статус после итерации: добавлен guard `hasLayoutOverlaps`; extension не коммитит результат, если итоговые states пересекаются. После второй итерации вместо полного исчезновения preview показывается dashed-рамка заблокированного target-а, а solver возвращает `status/reason/affected`.

Оставшаяся рекомендация: `calculateDragTransitions` должен возвращать не только states, но и статус:

- `valid`;
- `blocked`;
- `wouldOverlap`;
- `tooSmall`;
- `unstable`.

Статус после шестой итерации: UI использует `reason`, чтобы различать overlap, недостаточный `minSpan` и выход за границы разными blocked preview variants. Это все еще намеренно без текста, чтобы не превращать drag в обучающий попап.

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

Статус после шестой итерации: добавлен extraction threshold. Если modifier отпущен почти без движения мыши от начала drag-а, сценарий считается cancel и на mouse release окно возвращается в сетку. Если курсор ушел примерно на 80px, сценарий становится floating-out, а source vacancy outline остается видимым до отпускания мыши.

Оставшаяся рекомендация:

- обкатать threshold руками на маленьких/больших окнах и при разном drag offset;
- при необходимости вынести расстояния threshold в настройку или константу рядом с DnD tuning.

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

Запуск `npm test -- --runInBand` прошел успешно: 79/79 тестов зеленые.

Хорошо покрыто:

- вставка floating terminal справа от Chrome;
- вставка floating terminal слева от Chrome;
- top-right terminal без движения bottom-right chat;
- приоритет horizontal carving;
- collapse vacancy после extraction;
- базовая математика vertical stack insertion;
- in-place redistribution full-height vertical stack-а при DnD insertion;
- cursor-to-target расчет в `computeDragTarget`;
- magnetic zones: top half, full-height center, bottom half;
- отказ от full-width stack insertion, если новый slot не помещается по `minSpan`;
- narrow-stack target adoption для широкого dragged-окна;
- horizontal relief для pinned vertical stack-а;
- edge insertion в horizontal stack у края экрана;
- auto-narrow wide dragged-окна до ширины edge slot-а;
- single edge neighbor insertion только при явном курсоре у края экрана;
- wide clamped edge insertion, когда курсор не у края, но широкий target уже уперся в край экрана;
- solver result: `valid/blocked`, `wouldOverlap`, `tooSmall`, affected windows;
- стабильность результата при нескольких permutation входного списка окон;
- transaction restore для extraction и безопасный fallback, если сосед изменился после insertion.
- transaction history для extraction после промежуточной DnD-операции другого окна;
- interior horizontal auto-narrow для вставки между full-height соседями;
- magnetic height hysteresis около границ 28%/72%;
- vertical stack-boundary hysteresis;
- horizontal boundary hysteresis.
- extraction threshold: случайное отпускание modifier почти без движения мыши отменяется, явный вынос на 80px+ становится floating-out;
- edge insertion рядом с крайним окном минимальной ширины.
- создание edge-slot через общий corridor solver, когда перевод всего row-stack создает overlap;
- зеркальные left/right edge corridors с цепочкой минимальных колонок и первым широким donor-окном.

Не покрыто:

- cross-monitor DnD;
- сценарии с плотным vertical stack, где сумма `minSpan` уже близка к высоте grid.
- полноценный multi-step undo layout-а, если пользователь ожидает откатить целую цепочку перестроений, а не только восстановить соседей конкретного extracted-окна;
- property/permutation тесты на большие случайные раскладки;
- experimental same-shape swap: neighbor ambiguity и визуальный swap preview.

## Рекомендуемый Следующий План

### Этап 1: Зафиксировать target intent

Статус: реализовано. Расчет target вынесен из `extension.ts` в `computeDragTarget` и покрыт базовыми тестами:

- top edge -> top half;
- center -> full height;
- bottom edge -> bottom half;
- boundary between vertical stack windows -> insertion slot;
- boundary between screen edge and window -> edge insertion slot;
- cursor near boundary but not close enough -> не прыгать в stack insertion.

Дополнительный слой реализован: `extension.ts` хранит последний валидный `DragTargetResult` внутри текущей drag-сессии, а `computeDragTarget` использует его как hysteresis-контекст для magnetic zones и stack boundaries. Это снижает дрожание preview около 28%/72% и около границ вставки.

### Этап 2: Сделать solver result объяснимым

Статус: реализовано на базовом визуальном уровне. Добавлен `solveDragTransitions`:

Перейти от `Record<string, WindowState>` к результату вида:

```ts
type DragSolveResult = {
  status: 'valid' | 'blocked';
  states: Record<string, WindowState>;
  affected: string[];
  reason?: string;
};
```

Extension использует этот результат для blocked preview и запрета commit-а. В шестой итерации причина блокировки стала визуально различимой: overlap, too-small и out-of-bounds показываются разными dashed variants.

### Этап 3: Убрать order-dependence

Статус: частично сделано. Добавлена базовая deterministic sorting по grid-позиции и stable id, плюс regression-тест на несколько permutation входных окон. Следующий слой - расширить property-style coverage:

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

Статус: реализовано в UX-safe форме.

Добавить короткую историю последнего DnD commit, чтобы extraction мог не просто схлопывать вакансию, а восстанавливать окна, которые именно этот dragged window сжал.

Это даст самый приятный UX-эффект: "вставил окно - вынул окно - раскладка разумно вернулась".

После седьмой итерации extension хранит короткую bounded history. При extraction выбирается самый свежий snapshot, который:

- относится к этому dragged window;
- относится к этому monitor;
- совпадает с текущими after-state affected-окон;
- восстанавливается без overlap/min-size/out-of-bounds.

Если подходящего snapshot-а нет, поведение безопасно падает обратно в `collapseVacancy`.

### Этап 6: Полировка extraction

Статус: частично реализовано. Фича Ctrl/modifier extraction оставлена, но стала безопаснее:

- source vacancy outline остается видимым после перехода в floating mode;
- floating-out commit происходит только на mouse release;
- добавлен threshold, чтобы случайное отпускание modifier рядом с source-slot не превращалось в вынос из сетки.

Оставшийся слой: ручная обкатка threshold на разных размерах окон и, если понадобится, настройка чувствительности.

## Итог

Текущая реализация уже закрыла главную боль: DnD больше не выглядит как непредсказуемая перестройка всей сетки. Но следующий качественный скачок будет не от еще одной локальной эвристики, а от явного UX-контракта:

- сначала понять intent под курсором;
- затем решить layout с deterministic scoring;
- затем показать valid или invalid preview;
- затем commit-ить только то, что пользователь уже увидел.

Самые приоритетные оставшиеся улучшения: более глубокие permutation/property-тесты, global layout scoring для multi-window carving/push решений и ручная обкатка experimental swap. После этого DnD станет не просто рабочим, а таким, которому начинаешь доверять рукой.
