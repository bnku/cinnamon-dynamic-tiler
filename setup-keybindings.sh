#!/bin/bash

# Скрипт для автоматической настройки горячих клавиш dynamic-tiler в Cinnamon

# Список хоткеев
declare -A names
declare -A commands
declare -A bindings

names[0]="Tile Left"
commands[0]="dynamic-tiler tile left"
bindings[0]="['<Super>Left']"

names[1]="Tile Right"
commands[1]="dynamic-tiler tile right"
bindings[1]="['<Super>Right']"

names[2]="Tile Up"
commands[2]="dynamic-tiler tile up"
bindings[2]="['<Super>Up']"

names[3]="Tile Down"
commands[3]="dynamic-tiler tile down"
bindings[3]="['<Super>Down']"

names[4]="Shift Left (Fast 1/2)"
commands[4]="dynamic-tiler shift left"
bindings[4]="['<Primary><Super>Left']" # <Primary> обозначает клавишу Ctrl в gsettings

names[5]="Shift Right (Fast 1/2)"
commands[5]="dynamic-tiler shift right"
bindings[5]="['<Primary><Super>Right']"

names[6]="Shift Up (Fast 1/2)"
commands[6]="dynamic-tiler shift up"
bindings[6]="['<Primary><Super>Up']"

names[7]="Shift Down (Fast 1/2)"
commands[7]="dynamic-tiler shift down"
bindings[7]="['<Primary><Super>Down']"

names[8]="Restore Window"
commands[8]="dynamic-tiler restore"
bindings[8]="['<Super>BackSpace']"

echo "Отключаем стандартные конфликтующие хоткеи Cinnamon для Super + стрелки..."
gsettings set org.cinnamon.desktop.keybindings.window-muffin tile-to-left "['disabled']" 2>/dev/null
gsettings set org.cinnamon.desktop.keybindings.window-muffin tile-to-right "['disabled']" 2>/dev/null
gsettings set org.cinnamon.desktop.keybindings.window-muffin maximize "['disabled']" 2>/dev/null
gsettings set org.cinnamon.desktop.keybindings.window-muffin unmaximize "['disabled']" 2>/dev/null

echo "Регистрируем кастомные хоткеи в gsettings..."

# Получаем текущие кастомные биндинги
current_bindings=$(gsettings get org.cinnamon.settings-daemon.plugins.media-keys custom-keybindings)

# Инициализируем массив путей
paths=()

for i in {0..8}; do
    path="/org/cinnamon/settings-daemon/plugins/media-keys/custom-keybindings/custom_tiler$i/"
    paths+=("'$path'")
    
    # Записываем значения для каждого хоткея
    gsettings set org.cinnamon.settings-daemon.plugins.media-keys.custom-keybinding:$path name "${names[$i]}"
    gsettings set org.cinnamon.settings-daemon.plugins.media-keys.custom-keybinding:$path command "${commands[$i]}"
    gsettings set org.cinnamon.settings-daemon.plugins.media-keys.custom-keybinding:$path binding "${bindings[$i]}"
done

# Объединяем пути в массив gsettings формата ['path1', 'path2', ...]
# Нам нужно сохранить существующие кастомные хоткеи, но исключить старые custom_tiler, если они были, и добавить наши новые
new_bindings_list=""
clean_bindings=$(echo "$current_bindings" | tr -d "[]'")
IFS=',' read -ra ADDR <<< "$clean_bindings"
for val in "${ADDR[@]}"; do
    val_trimmed=$(echo "$val" | xargs)
    if [[ -n "$val_trimmed" && ! "$val_trimmed" =~ "custom_tiler" ]]; then
        new_bindings_list+="'$val_trimmed', "
    fi
done

# Добавляем наши новые хоткеи
for p in "${paths[@]}"; do
    new_bindings_list+="$p, "
done

# Убираем лишнюю запятую на конце
new_bindings_list=$(echo "$new_bindings_list" | sed 's/, $//')

# Устанавливаем итоговый список в gsettings
gsettings set org.cinnamon.settings-daemon.plugins.media-keys custom-keybindings "[ $new_bindings_list ]"

echo "Горячие клавиши dynamic-tiler для Cinnamon успешно настроены!"
echo "Назначены следующие комбинации:"
echo "  • Super + Left / Right / Up / Down -> Эластичный тайлинг по сетке"
echo "  • Ctrl + Super + Left / Right / Up / Down -> Быстрый перенос в 1/2 экрана"
echo "  • Super + Backspace                -> Восстановление исходных координат окна (Restore)"
