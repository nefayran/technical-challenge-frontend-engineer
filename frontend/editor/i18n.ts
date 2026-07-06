// Minimal i18n: reactive locale + flat key dictionaries. The brief rules out
// new frameworks and vue-i18n would be overkill for ~60 strings; this is the
// whole mechanism.

import { ref } from "vue";

export const LOCALES = ["en", "ru", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

const STORAGE_KEY = "maze-editor-locale";

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null && (LOCALES as readonly string[]).includes(saved)) {
    return saved as Locale;
  }
  const nav = navigator.language.slice(0, 2);
  return (LOCALES as readonly string[]).includes(nav) ? (nav as Locale) : "en";
}

export const locale = ref<Locale>(initialLocale());

export function setLocale(next: Locale): void {
  locale.value = next;
  localStorage.setItem(STORAGE_KEY, next);
}

type Dict = Record<string, string>;

const en: Dict = {
  "app.title": "Maze Chase — Level Editor",
  "app.play": "Play ↗",
  "app.loading": "Loading…",

  "tool.paint": "Paint",
  "tool.erase": "Erase",
  "tool.line": "Line",
  "tool.rect": "Rect",
  "tool.flood": "Fill",
  "tool.pan": "Pan",
  "tool.paint.hint": "Drag to paint the selected block",
  "tool.erase.hint": "Drag to clear cells",
  "tool.line.hint": "Drag for a straight line",
  "tool.rect.hint": "Drag for a rectangle outline",
  "tool.flood.hint": "Click to flood-fill a region",
  "tool.pan.hint": "Drag to pan (or hold Space)",
  "tool.undo": "Undo",
  "tool.redo": "Redo",
  "tool.fit": "Fit",
  "tool.fit.hint": "Fit board to view",

  "block.wall": "Wall",
  "block.pellet": "Pellet",
  "block.power": "Power",
  "block.player": "Player",
  "block.ghost": "Ghost",

  "status.loading": "Loading…",
  "status.synced": "Saved",
  "status.dirty": "Unsaved changes…",
  "status.saving": "Saving…",
  "status.conflict": "Conflict — needs your call",
  "status.offline": "Backend unreachable — retrying, edits kept locally",
  "status.error": "Error",
  "status.title": "Level {id} · server version {version}",

  "sidebar.levels": "Levels",
  "sidebar.refresh": "Refresh list",
  "sidebar.newBlank": "+ Blank",
  "sidebar.generate": "+ Generate…",
  "sidebar.duplicate": "Duplicate",
  "sidebar.duplicate.hint": "Save a copy as a new level",
  "sidebar.rename.hint": "double-click to rename",

  "newLevel.title": "New blank level",
  "newLevel.width": "Width",
  "newLevel.height": "Height",
  "newLevel.create": "Create",
  "newLevel.cancel": "Cancel",

  "generate.title": "Generate maze",
  "generate.hint": "Deterministic: the same seed and size always produce the same board.",
  "generate.seed": "Seed",
  "generate.size": "Size ({min}–{max})",
  "generate.run": "Generate",
  "generate.running": "Generating…",
  "generate.cancel": "Cancel",

  "conflict.title": "Someone else saved this level",
  "conflict.body":
    "The server has version {version} with different content than yours. Saving now would overwrite it.",
  "conflict.theirs": "Take theirs",
  "conflict.theirs.hint": "Replace my board with the server version (undoable)",
  "conflict.mine": "Keep mine",
  "conflict.mine.hint": "Overwrite the server with my board",

  "draft.banner": "Unsaved local draft from {time} found for this level.",
  "draft.restore": "Restore draft",
  "draft.discard": "Discard",

  "stats.size": "Size",
  "stats.walls": "Walls",
  "stats.pellets": "Pellets",
  "stats.power": "Power",
  "stats.players": "Players",
  "stats.ghosts": "Ghosts",
  "stats.noPlayer": "⚠ No player spawn — the level is not playable",

  "playtest.exit": "[[Esc]] exit · [[←→↑↓]] steer",
  "playtest.pellets": "pellets left",
  "playtest.eaten": "You were caught! [[Esc]] exit, [[R]] restart",
  "playtest.cleared": "Level cleared! [[Esc]] exit, [[R]] restart",

  "error.load": "Failed to load level",
  "tour.welcome.title": "Maze Chase Editor",
  "tour.welcome.body": "A quick walkthrough of the editor. Leave at any time with [[Esc]]; reopen it later from the [[?]] button.",
  "tour.help.title": "Replay this tour",
  "tour.help.body": "This button reopens the walkthrough whenever you need it.",
  "tour.tools.title": "Tools",
  "tour.tools.body": "Paint, erase, straight line, rectangle outline, flood fill, pan. Keys [[1]]–[[6]] switch tools.",
  "tour.palette.title": "Blocks",
  "tour.palette.body": "Pick what the tools place. Players and ghosts carry a spawn direction — the arrow they start moving in.",
  "tour.history.title": "History & view",
  "tour.history.body": "Undo and redo any stroke ([[Cmd/Ctrl+Z]], [[Shift+Cmd/Ctrl+Z]]). Fit brings the whole board into view ([[F]]).",
  "tour.canvas.title": "The board",
  "tour.canvas.body": "Drag to draw, mouse wheel to zoom, hold [[Space]] or use Pan to move around. The canvas is keyboard-accessible too: focus it, move with [[←→↑↓]], place with [[Enter]].",
  "tour.sidebar.title": "Levels",
  "tour.sidebar.body": "Everything lives on the backend. Create a blank board, generate a maze from a seed, duplicate the current level. Double-click a name to rename.",
  "tour.status.title": "Autosave",
  "tour.status.body": "Edits save on their own about a second after you pause. The badge shows the state; if the backend is unreachable your work is kept locally and offered back on reload.",
  "tour.play.title": "Playtest",
  "tour.play.body": "Runs the real game engine on your level right here. [[←→↑↓]] steer, [[R]] restarts, [[Esc]] exits.",
  "tour.theme.title": "Theme & language",
  "tour.theme.body": "Dark or light, and the UI speaks English, Russian and Japanese.",
  "tour.next": "Next",
  "tour.prev": "Back",
  "tour.done": "Done",
  "tour.skip": "Skip tour",
  "tour.open": "Show the tour",
  "toast.remoteUpdate": "Updated from the server — v{version}",
};

const ru: Dict = {
  "app.title": "Maze Chase — редактор уровней",
  "app.play": "Играть ↗",
  "app.loading": "Загрузка…",

  "tool.paint": "Кисть",
  "tool.erase": "Ластик",
  "tool.line": "Линия",
  "tool.rect": "Рамка",
  "tool.flood": "Заливка",
  "tool.pan": "Рука",
  "tool.paint.hint": "Тяните, чтобы рисовать выбранный блок",
  "tool.erase.hint": "Тяните, чтобы очистить клетки",
  "tool.line.hint": "Тяните для прямой линии",
  "tool.rect.hint": "Тяните для контура прямоугольника",
  "tool.flood.hint": "Клик — залить область",
  "tool.pan.hint": "Тяните для панорамы (или зажмите пробел)",
  "tool.undo": "Отменить",
  "tool.redo": "Повторить",
  "tool.fit": "Вписать",
  "tool.fit.hint": "Вписать доску в окно",

  "block.wall": "Стена",
  "block.pellet": "Точка",
  "block.power": "Энерджайзер",
  "block.player": "Игрок",
  "block.ghost": "Призрак",

  "status.loading": "Загрузка…",
  "status.synced": "Сохранено",
  "status.dirty": "Есть несохранённое…",
  "status.saving": "Сохранение…",
  "status.conflict": "Конфликт — нужно ваше решение",
  "status.offline": "Бэкенд недоступен — повторяем, правки хранятся локально",
  "status.error": "Ошибка",
  "status.title": "Уровень {id} · версия сервера {version}",

  "sidebar.levels": "Уровни",
  "sidebar.refresh": "Обновить список",
  "sidebar.newBlank": "+ Пустой",
  "sidebar.generate": "+ Сгенерировать…",
  "sidebar.duplicate": "Дублировать",
  "sidebar.duplicate.hint": "Сохранить копию как новый уровень",
  "sidebar.rename.hint": "двойной клик — переименовать",

  "newLevel.title": "Новый пустой уровень",
  "newLevel.width": "Ширина",
  "newLevel.height": "Высота",
  "newLevel.create": "Создать",
  "newLevel.cancel": "Отмена",

  "generate.title": "Генерация лабиринта",
  "generate.hint": "Детерминированно: одинаковые seed и размер дают одинаковую доску.",
  "generate.seed": "Seed",
  "generate.size": "Размер ({min}–{max})",
  "generate.run": "Сгенерировать",
  "generate.running": "Генерация…",
  "generate.cancel": "Отмена",

  "conflict.title": "Кто-то ещё сохранил этот уровень",
  "conflict.body":
    "На сервере версия {version} с другим содержимым. Сохранение сейчас перезапишет её.",
  "conflict.theirs": "Взять серверную",
  "conflict.theirs.hint": "Заменить мою доску серверной версией (можно отменить)",
  "conflict.mine": "Оставить мою",
  "conflict.mine.hint": "Перезаписать сервер моей доской",

  "draft.banner": "Найден несохранённый локальный черновик от {time}.",
  "draft.restore": "Восстановить черновик",
  "draft.discard": "Отбросить",

  "stats.size": "Размер",
  "stats.walls": "Стены",
  "stats.pellets": "Точки",
  "stats.power": "Энерджайзеры",
  "stats.players": "Игроки",
  "stats.ghosts": "Призраки",
  "stats.noPlayer": "⚠ Нет спавна игрока — уровень неиграбелен",

  "playtest.exit": "[[Esc]] — выход · [[←→↑↓]] — управление",
  "playtest.pellets": "точек осталось",
  "playtest.eaten": "Вас поймали! [[Esc]] — выход, [[R]] — заново",
  "playtest.cleared": "Уровень пройден! [[Esc]] — выход, [[R]] — заново",

  "error.load": "Не удалось загрузить уровень",
  "tour.welcome.title": "Редактор Maze Chase",
  "tour.welcome.body": "Короткая экскурсия по редактору. Выйти — [[Esc]] в любой момент, вернуться — кнопка [[?]].",
  "tour.help.title": "Повторить тур",
  "tour.help.body": "Эта кнопка открывает экскурсию заново в любой момент.",
  "tour.tools.title": "Инструменты",
  "tour.tools.body": "Кисть, ластик, линия, рамка, заливка, панорама. Клавиши [[1]]–[[6]] переключают инструмент.",
  "tour.palette.title": "Блоки",
  "tour.palette.body": "Что именно ставит инструмент. У игроков и призраков есть направление спавна — стрелка, куда они пойдут на старте.",
  "tour.history.title": "История и вид",
  "tour.history.body": "Отмена и повтор любого штриха ([[Cmd/Ctrl+Z]], [[Shift+Cmd/Ctrl+Z]]). Fit вписывает доску в окно ([[F]]).",
  "tour.canvas.title": "Доска",
  "tour.canvas.body": "Тяните, чтобы рисовать; колесо — зум; зажмите [[Space]] или возьмите «Руку», чтобы двигаться. Работает и с клавиатуры: фокус на холст, [[←→↑↓]] — курсор, [[Enter]] — поставить блок.",
  "tour.sidebar.title": "Уровни",
  "tour.sidebar.body": "Всё хранится на бэкенде. Пустая доска, генерация лабиринта по seed, дубликат текущего уровня. Двойной клик по имени — переименовать.",
  "tour.status.title": "Автосохранение",
  "tour.status.body": "Правки сохраняются сами примерно через секунду паузы. Бейдж показывает состояние; если бэкенд недоступен, работа хранится локально и будет предложена после перезагрузки.",
  "tour.play.title": "Плейтест",
  "tour.play.body": "Запускает настоящий игровой движок на вашем уровне прямо здесь. [[←→↑↓]] — управление, [[R]] — заново, [[Esc]] — выход.",
  "tour.theme.title": "Тема и язык",
  "tour.theme.body": "Тёмная или светлая; интерфейс говорит по-английски, по-русски и по-японски.",
  "tour.next": "Дальше",
  "tour.prev": "Назад",
  "tour.done": "Готово",
  "tour.skip": "Пропустить",
  "tour.open": "Показать тур",
  "toast.remoteUpdate": "Обновлено с сервера — v{version}",
};

const ja: Dict = {
  "app.title": "Maze Chase — レベルエディタ",
  "app.play": "プレイ ↗",
  "app.loading": "読み込み中…",

  "tool.paint": "ペイント",
  "tool.erase": "消しゴム",
  "tool.line": "直線",
  "tool.rect": "枠",
  "tool.flood": "塗りつぶし",
  "tool.pan": "移動",
  "tool.paint.hint": "ドラッグで選択ブロックを描画",
  "tool.erase.hint": "ドラッグでセルを消去",
  "tool.line.hint": "ドラッグで直線を引く",
  "tool.rect.hint": "ドラッグで長方形の枠を描く",
  "tool.flood.hint": "クリックで領域を塗りつぶす",
  "tool.pan.hint": "ドラッグで画面移動（スペース長押しでも可）",
  "tool.undo": "元に戻す",
  "tool.redo": "やり直す",
  "tool.fit": "全体表示",
  "tool.fit.hint": "ボードを画面に収める",

  "block.wall": "壁",
  "block.pellet": "ドット",
  "block.power": "パワーエサ",
  "block.player": "プレイヤー",
  "block.ghost": "ゴースト",

  "status.loading": "読み込み中…",
  "status.synced": "保存済み",
  "status.dirty": "未保存の変更…",
  "status.saving": "保存中…",
  "status.conflict": "競合 — 選択してください",
  "status.offline": "サーバーに接続できません — 再試行中、編集はローカルに保持",
  "status.error": "エラー",
  "status.title": "レベル {id} · サーバーバージョン {version}",

  "sidebar.levels": "レベル一覧",
  "sidebar.refresh": "一覧を更新",
  "sidebar.newBlank": "+ 空のレベル",
  "sidebar.generate": "+ 自動生成…",
  "sidebar.duplicate": "複製",
  "sidebar.duplicate.hint": "コピーを新しいレベルとして保存",
  "sidebar.rename.hint": "ダブルクリックで名前を変更",

  "newLevel.title": "新しい空のレベル",
  "newLevel.width": "幅",
  "newLevel.height": "高さ",
  "newLevel.create": "作成",
  "newLevel.cancel": "キャンセル",

  "generate.title": "迷路を生成",
  "generate.hint": "決定的生成：同じシードとサイズは常に同じボードになります。",
  "generate.seed": "シード",
  "generate.size": "サイズ（{min}–{max}）",
  "generate.run": "生成",
  "generate.running": "生成中…",
  "generate.cancel": "キャンセル",

  "conflict.title": "他の誰かがこのレベルを保存しました",
  "conflict.body":
    "サーバーにはバージョン {version}（異なる内容）があります。今保存すると上書きされます。",
  "conflict.theirs": "サーバー版を取得",
  "conflict.theirs.hint": "自分のボードをサーバー版に置き換える（取り消し可能）",
  "conflict.mine": "自分の版を維持",
  "conflict.mine.hint": "自分のボードでサーバーを上書きする",

  "draft.banner": "{time} の未保存ローカル下書きが見つかりました。",
  "draft.restore": "下書きを復元",
  "draft.discard": "破棄",

  "stats.size": "サイズ",
  "stats.walls": "壁",
  "stats.pellets": "ドット",
  "stats.power": "パワーエサ",
  "stats.players": "プレイヤー",
  "stats.ghosts": "ゴースト",
  "stats.noPlayer": "⚠ プレイヤーのスポーンがありません — プレイ不可",

  "playtest.exit": "[[Esc]] 終了 · [[←→↑↓]] 操作",
  "playtest.pellets": "残りドット",
  "playtest.eaten": "捕まりました！[[Esc]] 終了、[[R]] 再開",
  "playtest.cleared": "クリア！[[Esc]] 終了、[[R]] 再開",

  "error.load": "レベルの読み込みに失敗しました",
  "tour.welcome.title": "Maze Chase エディタ",
  "tour.welcome.body": "エディタの簡単なツアーです。[[Esc]] でいつでも終了、[[?]] ボタンで再開できます。",
  "tour.help.title": "ツアーをもう一度",
  "tour.help.body": "このボタンでいつでもツアーを再開できます。",
  "tour.tools.title": "ツール",
  "tour.tools.body": "ペイント、消しゴム、直線、枠、塗りつぶし、移動。[[1]]〜[[6]] キーで切り替え。",
  "tour.palette.title": "ブロック",
  "tour.palette.body": "ツールが置くものを選びます。プレイヤーとゴーストにはスポーン方向があり、開始時にその向きへ動きます。",
  "tour.history.title": "履歴と表示",
  "tour.history.body": "任意のストロークを元に戻す／やり直す（[[Cmd/Ctrl+Z]]、[[Shift+Cmd/Ctrl+Z]]）。Fit はボード全体を表示（[[F]]）。",
  "tour.canvas.title": "ボード",
  "tour.canvas.body": "ドラッグで描画、ホイールでズーム、[[Space]] 長押しか移動ツールで画面移動。キーボードでも操作可能：フォーカスして [[←→↑↓]] で移動、[[Enter]] で配置。",
  "tour.sidebar.title": "レベル",
  "tour.sidebar.body": "すべてバックエンドに保存されます。空のボード、シードから迷路生成、現在レベルの複製。名前のダブルクリックで変更。",
  "tour.status.title": "自動保存",
  "tour.status.body": "編集は約1秒の停止後に自動保存されます。バッジが状態を表示。サーバーに届かない場合、作業はローカルに保持され、再読み込み時に復元を提案します。",
  "tour.play.title": "プレイテスト",
  "tour.play.body": "本物のゲームエンジンでこのレベルをその場で実行。[[←→↑↓]] で操作、[[R]] で再開、[[Esc]] で終了。",
  "tour.theme.title": "テーマと言語",
  "tour.theme.body": "ダーク／ライト切り替え。UI は英語・ロシア語・日本語対応。",
  "tour.next": "次へ",
  "tour.prev": "戻る",
  "tour.done": "完了",
  "tour.skip": "スキップ",
  "tour.open": "ツアーを表示",
  "toast.remoteUpdate": "サーバーから更新されました — v{version}",
};

const DICTS: Record<Locale, Dict> = { en, ru, ja };

export function t(key: string, params?: Record<string, string | number>): string {
  const text = DICTS[locale.value][key] ?? en[key] ?? key;
  if (params === undefined) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
