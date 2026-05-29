# Архитектура и технические ограничения `dynamic-tiler`

Этот документ описывает внутреннюю структуру проекта `dynamic-tiler`, ответственность его модулей, особенности и ограничения текущей X11-реализации, а также содержит руководство по проектированию нативных портов для сред рабочего стола (Cinnamon, GNOME Shell) с поддержкой управления окнами с помощью мыши (Drag-and-Drop).

---

## 1. Слои Архитектуры и Зоны Ответственности

Проект построен по принципам **Чистой Архитектуры (Clean Architecture)**. Направление зависимостей идет снаружи внутрь: **Инфраструктура $\rightarrow$ Сценарии использования $\rightarrow$ Чистое ядро**.

```
src/
├── core/                       # СЛОЙ DOMAIN & APPLICATION (Чистый TypeScript, без внешних зависимостей)
│   ├── types.ts                # Базовые сущности: WindowState, Geometry, Config, ScreenInfo
│   ├── TilingEngine.ts         # Единый Фасад ядра (выступает точкой входа для расчетов)
│   ├── ports/                  # СЛОЙ ИНТЕРФЕЙСОВ (Порты ввода-вывода)
│   │   ├── IShellAdapter.ts    # Интерфейс для взаимодействия с оконным менеджером/сервером
│   │   ├── ICacheManager.ts    # Интерфейс для работы с кэшем оконных состояний
│   │   └── IConfigProvider.ts  # Интерфейс для получения конфигурации сеток и отступов
│   └── usecases/               # СЛОЙ СЦЕНАРИЕВ ИСПОЛЬЗОВАНИЯ
│       └── TilingUseCase.ts    # Оркестратор сценариев тайлинга (tile, restore, clear)
│
└── infrastructure/             # СЛОЙ ИНФРАСТРУКТУРЫ (Специфичные адаптеры и сетевой демон)
    ├── cache/
    │   └── JsonFileCache.ts    # Сохранение кэша в файл ~/.cache/dynamic-tiler/state.json
    ├── config/
    │   └── JsonFileConfigProvider.ts # Чтение пользовательского файла конфига ~/.config/...
    ├── daemon/
    │   └── UdpDaemon.ts        # Высокопроизводительный фоновый UDP-сервер на Node.js dgram
    └── x11/
        └── X11ShellAdapter.ts  # Реализация X11/CLI (wmctrl, xdotool, xwininfo, xprop)
```

### Подробная ответственность модулей ядра (`src/core/engine/`)

Чтобы избежать разрастания кода (God Object), математический аппарат ядра декомпозирован на 5 специализированных модулей:

* **`GridSpans.ts`**: отвечает строго за логическое представление 12-колоночной симметричной разметки. Содержит шкалы координат горизонтали/вертикали и мапперы спанов в индексы.
* **`GeometryConverter.ts`**: преобразует абстрактные логические индексы колонок `[startCol, endCol]` в физические координаты пикселей с учетом отступов (gaps) экрана и выполняет обратное округление физических координат в логические ячейки.
* **`InitialLayout.ts`**: решает задачу "умного прилипания" для нового окна. Анализирует карту занятости монитора другими окнами и находит ближайший свободный стык справа/слева/сверху/снизу, занимая не более половины экрана по умолчанию.
* **`ChainBlockDetector.ts`**: реализует алгоритм **Chain Block Detection**. В реальном времени вычисляет суммарную ширину соприкасающихся соседей и определяет, есть ли у цепочки резерв для дальнейшего сжатия (учитывая лимит минимального размера окна в 2 колонки/строки).
* **`ChainTransitions.ts`**: самый сложный математический модуль. Вычисляет эластичное расталкивание ("гармошку") соприкасающихся окон. Если активное окно расширяется, этот модуль сдвигает соседей в свободное пространство, сохраняя их форму, и начинает пропорционально сжимать их только при реальном упоре в край экрана.

---

## 2. Технические ограничения текущей реализации X11/CLI

Текущая реализация для X11 работает как внешний CLI-клиент и UDP-демон. Из-за природы протокола X11 и утилит автоматизации существуют следующие архитектурные ограничения, которые важно учитывать:

### А. Накладные расходы на запуск процессов (Синхронность ввода-вывода)
* **Проблема**: Запуск любой CLI-утилиты (например, `xdotool` или `wmctrl`) в Node.js через `execSync` порождает новый форк процесса в ОС. Время запуска Node.js (bootstrap) составляет около 150мс, а время работы `execSync` — 15-30мс.
* **Как решено сейчас**: Был реализован фоновый **UDP-демон** (`UdpDaemon.ts`). Сам Node.js процесс запускается один раз в фоне, а хоткеи Cinnamon шлют ему легковесные UDP-дейтаграммы. Это сократило время отклика тайлинга с **~180мс** до **~8-12мс** (мгновенный отклик для человеческого глаза).
* **В нативном порте (Extension)**: Это ограничение **полностью отпадает**. Код нативного расширения выполняется прямо внутри движка GJS (Gnome JavaScript) в контексте оконного менеджера, давая нулевые задержки без UDP.

### Б. Проблема Client-Side Decorations (CSD теней) в GTK3/4
* **Проблема**: Окна приложений (Nemo, настройки Cinnamon, VS Code) отрисовывают свои тени как часть физической геометрии окна. Для X11 окно `300x500` на самом деле может быть `370x570` из-за невидимой 35-пиксельной рамки тени. Если располагать их стык-в-стык по чистым пикселям, окна будут накладываться тенями друг на друга, создавая визуальную щель.
* **Как решено сейчас**: Адаптер `X11ShellAdapter` считывает свойство окна `_GTK_FRAME_EXTENTS` с помощью `xprop` и вычитает эти пиксели перед расчетом логического спана, а при применении размеров — прибавляет их обратно.
* **В нативном порте (Extension)**: В Mutter/Muffin оконный менеджер оперирует понятием `Meta.Window.get_frame_rect()` (координаты чистого фрейма без теней) и `Meta.Window.get_buffer_rect()` (с тенями). В адаптере расширения CSD-компенсация больше не нужна, так как Mutter делает это нативно.

### В. Асинхронность оконного менеджера (Проблема развернутых окон)
* **Проблема**: В X11 перед тем как изменить размер максимизированного (развернутого на весь экран) окна, его нужно размаксимизировать. Команда `wmctrl -b remove,maximized_horz` выполняется асинхронно. Если сразу же послать команду `wmctrl -e` на изменение размера, оконный менеджер проигнорирует её, так как окно еще не завершило анимацию разворачивания.
* **Как решено сейчас**: В `X11ShellAdapter.unmaximizeWindow` добавлена принудительная микро-пауза: `execSync('sleep 0.05')` (50мс), чтобы дать Cinnamon применить состояние. Это компромиссное решение, замедляющее тайлинг первого нажатия.
* **В нативном порте (Extension)**: В Mutter размаксимизация и ресайз делаются одной атомарной операцией в одном фрейме рендеринга: `window.unmaximize(Meta.MaximizeFlags.BOTH); window.move_resize_frame(true, x, y, w, h);`. Никаких задержек и слипов.

---

## 3. Проектирование нативного порта для Cinnamon / GNOME Shell

При реализации нативного расширения (Cinnamon Spice или GNOME Shell Extension) на GJS, архитектура проекта позволяет переиспользовать **100% математического кода ядра** (`src/core/`).

Вам потребуется написать **только новые реализации инфраструктурных адаптеров**:

### А. Cinnamon / GNOME Адаптер Окон (`CinnamonShellAdapter`)
Вместо вызовов `wmctrl` и `xdotool`, этот адаптер будет работать с Mutter API напрямую:

```javascript
// Примерная реализация порта IShellAdapter для Cinnamon (GJS)
const Meta = imports.gi.Meta;

class CinnamonShellAdapter {
  getActiveWindowId() {
    // В Mutter ID окна — это обычно ссылка на объект MetaWindow
    let activeWindow = global.display.focus_window;
    return activeWindow ? activeWindow.get_stable_sequence().toString() : null;
  }

  getWindowGeometry(windowId) {
    let win = this._findMetaWindow(windowId);
    let rect = win.get_frame_rect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  applyGeometry(windowId, geom) {
    let win = this._findMetaWindow(windowId);
    if (win.maximized_horz || win.maximized_vert) {
      win.unmaximize(Meta.MaximizeFlags.BOTH);
    }
    // move_resize_frame принимает (user_op, x, y, width, height)
    win.move_resize_frame(true, geom.x, geom.y, geom.width, geom.height);
  }

  raiseWindow(windowId) {
    let win = this._findMetaWindow(windowId);
    win.activate(global.get_current_time());
  }

  _findMetaWindow(stableSequence) {
    let actor = global.get_window_actors().find(a => 
      a.meta_window.get_stable_sequence().toString() === stableSequence
    );
    return actor ? actor.meta_window : null;
  }
  
  // ... остальные методы IShellAdapter
}
```

### Б. Cinnamon / GNOME Адаптер настроек (`CinnamonConfigProvider`)
Вместо чтения JSON-файла, расширение должно считывать конфигурацию из GSettings, чтобы пользователь мог настраивать отступы (gaps) через стандартное графическое окно настроек расширения:

```javascript
const Gio = imports.gi.Gio;

class CinnamonConfigProvider {
  constructor() {
    this.settings = new Gio.Settings({ schema_id: 'org.cinnamon.extensions.dynamic-tiler' });
  }

  getConfig() {
    return {
      horizontalFractions: [2, 3, 4, 5, 6, 7, 8], // Статично или из настроек
      verticalFractions: [2, 3, 4],
      gaps: this.settings.get_int('gaps-size') // Чтение из DConf нативно
    };
  }
}
```

---

## 4. Реализация Drag-and-Drop тайлинга (Прилипание мышью)

Один из главных UX-сценариев будущего — **динамическое прилипание окна при его перетаскивании мышью в свободные зоны**.

Благодаря декомпозированному `GeometryConverter`, это реализуется следующим образом:

1. **Перехват начала перетаскивания**:
   В Mutter мы подписываемся на события оконного менеджера `grab-op-begin` (пользователь зажал заголовок окна левой кнопкой мыши и начал движение):
   ```javascript
   global.display.connect('grab-op-begin', (display, screen, window, op) => {
     if (op === Meta.GrabOp.MOVING) {
       // Запоминаем ID перетаскиваемого окна
       this.draggedWindowId = window.get_stable_sequence().toString();
       // Начинаем отслеживать координаты мыши/окна по таймеру
     }
   });
   ```

2. **Отслеживание движения (Realtime Preview)**:
   Пока пользователь тащит окно, мы считываем его временные физические координаты `currentGeom`:
   ```javascript
   let currentGeom = this.shellAdapter.getWindowGeometry(this.draggedWindowId);
   let monitor = this.shellAdapter.findMonitorForWindow(currentGeom, monitors);
   ```

3. **Расчет логической зоны под курсором**:
   Мы передаем физические координаты в чистый domain-конвертер `GeometryConverter.geometryToHSpan` и `geometryToVSpan`:
   ```javascript
   let targetHSpan = GeometryConverter.geometryToHSpan(currentGeom, monitor);
   let targetVSpan = GeometryConverter.geometryToVSpan(currentGeom, monitor);
   ```

4. **Анализ свободных зон**:
   * Мы сканируем занятые спаны других окон на этом мониторе.
   * Если логический спан перетаскиваемого окна `targetHSpan` попадает в зону, которая пустует (или пересекается с ней более чем на 50%), мы подсвечиваем эту зону на экране красивым полупрозрачным прямоугольником (Overlay Preview) с помощью Clutter API (`new Clutter.Actor()`).

5. **Прилипание при отпускании мыши (`grab-op-end`)**:
   Когда пользователь отпускает левую кнопку мыши, срабатывает событие окончания перетаскивания:
   ```javascript
   global.display.connect('grab-op-end', (display, screen, window, op) => {
     if (this.draggedWindowId) {
       // Получаем финальные координаты
       let finalGeom = this.shellAdapter.getWindowGeometry(this.draggedWindowId);
       let monitor = this.shellAdapter.findMonitorForWindow(finalGeom, monitors);
       
       // Вычисляем логический спан стыка
       let snapHSpan = GeometryConverter.geometryToHSpan(finalGeom, monitor);
       let snapVSpan = GeometryConverter.geometryToVSpan(finalGeom, monitor);
       
       // Строим новое состояние WindowState
       let nextState = {
         hIndex: TilingEngine.spanToHIndex(snapHSpan),
         vIndex: TilingEngine.spanToVIndex(snapVSpan),
         hSpan: snapHSpan,
         vSpan: snapVSpan,
         lastDirection: 'right' // Условное направление для инициализации
       };
       
       // Принудительно затягиваем окно в сетку
       let snappedGeom = TilingEngine.stateToGeometry(nextState, monitor, config);
       this.shellAdapter.applyGeometry(this.draggedWindowId, snappedGeom);
       
       // Сохраняем состояние окна в кэш, чтобы к нему применялся цепной тайлинг по стрелкам клавиатуры!
       this.cacheManager.saveState(this.draggedWindowId, nextState, snappedGeom, originalGeom);
       
       this.draggedWindowId = null;
     }
   });
   ```

### Результат:
Благодаря такому подходу, перетащенное мышкой окно **бесшовно интегрируется в общую цепочку окон**. Если пользователь притянул окно к свободному правому краю мышкой, а затем сфокусировался на среднем окне и нажал `Super+Right` — среднее окно плавно сдвинет притянутое мышкой окно в сторону, соблюдая все законы эластичной "тянучки"!
