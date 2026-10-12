// Material Symbols (Outlined) path data for the playback controls (viewBox "0 -960 960 960"). The same paths the Windows app draws
// (src/MaterialIcons.cs). Drawn as inline SVG with currentColor so they follow the theme and the active (gold) state.
export const ICONS = {
  play: 'M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z',
  pause: 'M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z',
  next: 'M660-240v-480h80v480h-80Zm-440 0v-480l360 240-360 240Zm80-240Zm0 90 136-90-136-90v180Z',
  prev: 'M220-240v-480h80v480h-80Zm520 0L380-480l360-240v480Zm-80-240Zm0 90v-180l-136 90 136 90Z',
  shuffle: 'M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z',
  repeat: 'M280-80 120-240l160-160 56 58-62 62h406v-160h80v240H274l62 62-56 58Zm-80-440v-240h486l-62-62 56-58 160 160-160 160-56-58 62-62H280v160h-80Z',
  repeatOne: 'M460-360v-180h-60v-60h120v240h-60ZM280-80 120-240l160-160 56 58-62 62h406v-160h80v240H274l62 62-56 58Zm-80-440v-240h486l-62-62 56-58 160 160-160 160-56-58 62-62H280v160h-80Z',
};

export function iconSvg(name) {
  return '<svg class="mi" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>';
}
