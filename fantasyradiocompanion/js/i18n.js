// Languages. English text is the key: t('Leave') returns the string for the current language, or the English itself when a
// language has no entry. Parameters are written {name} and filled from the second argument: t('{n} tracks', { n: 3 }).
// Saved games and settings never contain translated text, so switching language never touches progress.

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'zh', name: '简体中文' },
];

const ES = {
  // Page
  'Adventure': 'Aventura', 'Music': 'Música', 'Radio': 'Radio', 'Menu': 'Menú', 'Language': 'Idioma',
  'Export progress': 'Exportar progreso', 'Import progress': 'Importar progreso', 'Restart adventure': 'Reiniciar aventura', 'About': 'Acerca de',
  'Choose music folder…': 'Elegir carpeta de música…', 'Search songs…': 'Buscar canciones…',
  'Select your music folder of choice to play local music.': 'Elige tu carpeta de música para reproducir música local.',
  'Add playlist…': 'Añadir lista…', 'Stations from .m3u / .m3u8 / .pls files or links are kept in this browser.': 'Las emisoras de archivos o enlaces .m3u / .m3u8 / .pls se guardan en este navegador.',
  'Add link…': 'Añadir enlace…', 'Paste a station or .pls / .m3u link': 'Pega el enlace de una emisora o de un .pls / .m3u', 'Add': 'Añadir',
  "That doesn't look like a web address.": 'Eso no parece una dirección web.', 'Reading the link…': 'Leyendo el enlace…',
  'No stations found in that playlist.': 'No se encontraron emisoras en esa lista.',
  "Couldn't read that playlist (the site may be offline or may not allow it). Download the file and use Add playlist…, or paste the station's stream address.": 'No se pudo leer esa lista (el sitio puede estar sin conexión o no permitirlo). Descarga el archivo y usa Añadir lista…, o pega la dirección de la emisora.',
  'Added {n} station(s): {name}': 'Se añadieron {n} emisora(s): {name}',
  'Shuffle': 'Aleatorio', 'Previous': 'Anterior', 'Play or pause': 'Reproducir o pausar', 'Next': 'Siguiente', 'Repeat': 'Repetir',
  'SUPPORT': 'APOYAR', 'Theme': 'Tema', 'Custom Theme {n}': 'Tema personalizado {n}', 'Music volume': 'Volumen de la música', 'Music volume:': 'Volumen de la música:',
  'the slider sets the level': 'el control ajusta el nivel',
  'this station plays outside the page: the slider only mutes it, the device volume buttons set the level': 'esta emisora suena fuera de la página: el control solo la silencia, el nivel lo ajustan los botones de volumen del dispositivo',
  'this stream plays outside the page: the slider only mutes it, the device volume buttons set the level': 'esta transmisión suena fuera de la página: el control solo la silencia, el nivel lo ajustan los botones de volumen del dispositivo',
  'This stream plays outside the page, so the Music slider can only mute it. Use the device volume buttons.': 'Esta transmisión suena fuera de la página, así que el control de Música solo puede silenciarla. Usa los botones de volumen del dispositivo.',
  'Sound effects volume': 'Volumen de efectos', 'FX': 'FX',
  'Nothing playing': 'Nada en reproducción', 'Radio Stations': 'Emisoras', 'Local Music': 'Música local', 'Close': 'Cerrar', 'Choose folder…': 'Elegir carpeta…',
  'Tap a station to tune in and return to the party.': 'Toca una emisora para sintonizarla y volver al grupo.',
  'MONSTER COMPENDIUM': 'COMPENDIO DE MONSTRUOS', 'Tuner': 'Sintonizador', 'Monster Compendium': 'Compendio de monstruos',
  'A pixel-art adventure that marches to your music. Your party grows as you listen to radio; local music makes camp.': 'Una aventura de pixel art que marcha al ritmo de tu música. Tu grupo crece mientras escuchas la radio; la música local hace acampar.',
  'All pixel art is original. Radio stations are independent third-party streams; no music is included or uploaded: the music folder is read in your browser only.': 'Todo el pixel art es original. Las emisoras son transmisiones independientes de terceros; no se incluye ni se sube música: la carpeta de música solo se lee en tu navegador.',
  "Radio: stations that allow it also drive the scene's reactions; others just play. Final Fantasy Radio is http-only and plays in the Windows app.": 'Radio: las emisoras que lo permiten también dirigen las reacciones de la escena; las demás solo suenan. Final Fantasy Radio solo funciona por http y se reproduce en la app de Windows.',
  'Sound effects:': 'Efectos de sonido:', 'Play test sound': 'Reproducir sonido de prueba',
  'on (volume {n}%)': 'activados (volumen {n}%)', 'not supported by this browser': 'no compatible con este navegador', 'waiting for a click or key press ({s})': 'esperando un clic o una tecla ({s})',
  // Library and radio
  '{folder} ({n} tracks)': '{folder} ({n} pistas)', '{a} of {b} match': '{a} de {b} coinciden', '{folder} - {n} matching': '{folder} - {n} coinciden',
  'Scanning...': 'Escaneando...', 'Reopen "{name}"': 'Reabrir "{name}"', 'From playlist: {s}': 'De la lista: {s}',
  'Plays and drives the scene': 'Suena y dirige la escena', 'Plays (no audio reactions)': 'Suena (sin reacción al audio)', 'Plays; reactions if the station allows': 'Suena; reacciona si la emisora lo permite',
  'http only: needs a relay, so it only plays in the Windows app': 'solo http: necesita un relé, así que solo suena en la app de Windows',
  'Change folder...': 'Cambiar carpeta...', 'Select music folder...': 'Elegir carpeta de música...',
  'Playing': 'Reproduciendo', 'Connecting...': 'Conectando...', 'Buffering...': 'Almacenando en búfer...', 'Error: {msg}': 'Error: {msg}',
  'this station only streams over plain http': 'esta emisora solo transmite por http simple', 'could not play': 'no se pudo reproducir',
  ' - no audio reactions': ' - sin reacción al audio',
  // Compendium and progress
  'Not yet encountered.': 'Aún no encontrado.', 'HP {n}': 'Vida {n}', 'DEFEATED': 'DERROTADOS', 'DISCOVERED {a}/{b}   DEFEATED {n}': 'DESCUBIERTOS {a}/{b}   DERROTADOS {n}',
  "Progress copied. Paste it into Import on another device, or into the Windows app's saved settings.": 'Progreso copiado. Pégalo en Importar en otro dispositivo, o en la configuración guardada de la app de Windows.',
  'Copy your progress:': 'Copia tu progreso:', 'Paste a progress string:': 'Pega una cadena de progreso:',
  'Progress paused while game was minimized.': 'El progreso se pausó mientras el juego estaba minimizado.',
  'RESTART': 'REINICIAR',
  'This resets your adventure: your party goes back to just the Paca, levels, gold and the compendium are cleared, and the day and season start over.\n\nType {word} to confirm.': 'Esto reinicia tu aventura: tu grupo vuelve a ser solo la Alpaca, se borran niveles, oro y compendio, y el día y la estación empiezan de nuevo.\n\nEscribe {word} para confirmar.',
  // The party
  'Paca': 'Alpaca', 'Thief': 'Ladrón', 'Warrior': 'Guerrero', 'Light Mage': 'Mago de luz', 'Fire Mage': 'Mago de fuego', 'Fae': 'Hada',
  'Quick, quiet and always one step ahead.': 'Rápido, sigiloso y siempre un paso por delante.',
  'A stalwart front-liner who never backs down.': 'Un firme combatiente de primera línea que nunca retrocede.',
  'Keeps the whole party hale and humming.': 'Mantiene a todo el grupo sano y animado.',
  'A short fuse and a flair for the dramatic.': 'Mecha corta y gusto por lo dramático.',
  'A glimmering lucky charm who never tires.': 'Un amuleto brillante de la suerte que nunca se cansa.',
  'Fast, loyal and always out front.': 'Veloz, leal y siempre al frente.',
  'Spring': 'Primavera', 'Summer': 'Verano', 'Fall': 'Otoño', 'Winter': 'Invierno', 'Year {y}  Day {d}': 'Año {y}  Día {d}',
  // Traits
  'Item Storage: +{n} slot for the party': 'Almacenaje: +{n} ranura para el grupo', 'Item Storage: +{n} slots for the party': 'Almacenaje: +{n} ranuras para el grupo',
  'Heal: {hp} HP to the weakest ally every {s} s': 'Curar: {hp} PV al aliado más débil cada {s} s',
  'Fireball: casts one to the right every {s} s': 'Bola de fuego: lanza una a la derecha cada {s} s',
  'Lucky Coins: {p}% chance of {n} coins together': 'Monedas de la suerte: {p}% de probabilidad de {n} monedas juntas',
  'Huzzah!: party damage x{m} for {d} s every {s} s': '¡Hurra!: daño del grupo x{m} durante {d} s cada {s} s',
  'Star Hat: party wears one for {d} min every {s} min': 'Sombrero estelar: el grupo lo lleva {d} min cada {s} min',
  'Huzzah!': '¡Hurra!', 'Blood Moon!': '¡Luna de Sangre!',
  // HUD and shop
  'Tuner: music & radio stations': 'Sintonizador: música y emisoras', 'Tap: use   Hold: switch': 'Toca: usar   Mantén: cambiar', 'Restart': 'Reiniciar',
  'Merchant': 'Mercader', 'In bag: {n}': 'En la bolsa: {n}', 'Leave': 'Salir', 'Tap anywhere to close': 'Toca en cualquier lugar para cerrar', 'Click anywhere to close': 'Haz clic en cualquier lugar para cerrar',
  'Synergy Elixir': 'Elixir de sinergia', 'Red Potion': 'Poción roja', 'Blue Potion': 'Poción azul', 'Healing Potion I': 'Poción de curación I',
  'Heals one party member for 10 HP. After using it, tap the member to heal.': 'Cura 10 PS a un miembro del grupo. Tras usarla, toca al miembro que quieras curar.', 'Choose who to heal': 'Elige a quién curar', 'HP full': 'Vida al máximo', 'Fainted!': '¡Se desmayó!',
  'A placeholder potion. It does nothing yet.': 'Una poción de relleno. Todavía no hace nada.',
  "Resets every party member's skills so they all fire together within a second, Huzzah! first so the damage skills get its full benefit.": 'Reinicia las habilidades de todo el grupo para que se activen juntas en un segundo, con ¡Hurra! primero para que las de daño aprovechen todo su efecto.',
  'Bought {name}': 'Compraste {name}', 'Safe travels!': '¡Buen viaje!', 'Synergy!': '¡Sinergia!', '{name}: nothing happens yet': '{name}: todavía no pasa nada',
  // Story
  'Resting at camp: play a radio stream to keep adventuring': 'Descansando en el campamento: reproduce una emisora para seguir la aventura',
  'A tavern! Your last companion is waiting.': '¡Una taberna! Tu último compañero te espera.', 'A tavern! Who joins the party?': '¡Una taberna! ¿Quién se une al grupo?',
  'Give the crystal to someone in your party': 'Dale el cristal a alguien de tu grupo', 'LEVEL UP': 'SUBIR', 'Lv. {n}': 'Nv. {n}', '{name} reached Lv. {n}!': '¡{name} alcanzó el nivel {n}!',
  'Old Man': 'Anciano', "Quite the journey you've been on.": 'Qué viaje has tenido.',
  'Are you prepared to level up your adventure?': '¿Estás listo para subir de nivel tu aventura?',
  'It matters not, for that is your destiny.': 'No importa, pues ese es tu destino.', 'It so happens I have what you need.': 'Da la casualidad de que tengo lo que necesitas.',
  'The Old Man throws you a blue crystal.': 'El Anciano te lanza un cristal azul.', 'Give this to someone in your party.': 'Dale esto a alguien de tu grupo.',
  'You found a Fantasy Crystal! Give it to someone in your party.': '¡Encontraste un Cristal de Fantasía! Dáselo a alguien de tu grupo.',
  // Monsters
  'Sheller': 'Caparazón', 'Orc': 'Orco', 'Nightmare': 'Pesadilla', 'Gargogryph': 'Gargogrifo',
  'Roams by day': 'Merodea de día', 'Roams day and night': 'Merodea de día y de noche', 'Roams after dark': 'Merodea al anochecer', 'Only under a dark sky': 'Solo bajo un cielo oscuro',
  'A grumpy shell-back. Punches first, claws second.': 'Un gruñón con caparazón. Primero puñetazos, luego zarpazos.',
  'Fond of shiny earrings and swinging big sticks.': 'Aficionado a los pendientes brillantes y a blandir grandes garrotes.',
  'A cloaked drifter that only calls after dark.': 'Un errante encapuchado que solo aparece al anochecer.',
  'A stone lion-ox with eagle wings, hard to hurt. Wingbeats throw razor feathers, and it can call down a Blood Moon.': 'Un león-buey de piedra con alas de águila, difícil de herir. Sus aletazos lanzan plumas afiladas y puede invocar una Luna de Sangre.',
};

const ZH = {
  // Page
  'Adventure': '冒险', 'Music': '音乐', 'Radio': '电台', 'Menu': '菜单', 'Language': '语言',
  'Export progress': '导出进度', 'Import progress': '导入进度', 'Restart adventure': '重新开始冒险', 'About': '关于',
  'Choose music folder…': '选择音乐文件夹…', 'Search songs…': '搜索歌曲…',
  'Select your music folder of choice to play local music.': '请选择你的音乐文件夹以播放本地音乐。',
  'Add playlist…': '添加播放列表…', 'Stations from .m3u / .m3u8 / .pls files or links are kept in this browser.': '来自 .m3u / .m3u8 / .pls 文件或链接的电台保存在此浏览器中。',
  'Add link…': '添加链接…', 'Paste a station or .pls / .m3u link': '粘贴电台或 .pls / .m3u 链接', 'Add': '添加',
  "That doesn't look like a web address.": '这看起来不是网址。', 'Reading the link…': '正在读取链接…',
  'No stations found in that playlist.': '该播放列表中没有电台。',
  "Couldn't read that playlist (the site may be offline or may not allow it). Download the file and use Add playlist…, or paste the station's stream address.": '无法读取该播放列表（网站可能已离线或不允许）。请下载文件并使用“添加播放列表…”，或粘贴电台的流地址。',
  'Added {n} station(s): {name}': '已添加 {n} 个电台：{name}',
  'Shuffle': '随机播放', 'Previous': '上一首', 'Play or pause': '播放或暂停', 'Next': '下一首', 'Repeat': '重复',
  'SUPPORT': '支持', 'Theme': '主题', 'Custom Theme {n}': '自定义主题 {n}', 'Music volume': '音乐音量', 'Music volume:': '音乐音量：',
  'the slider sets the level': '滑块可调节音量',
  'this station plays outside the page: the slider only mutes it, the device volume buttons set the level': '此电台在页面之外播放：滑块只能静音，音量请用设备的音量键调节',
  'this stream plays outside the page: the slider only mutes it, the device volume buttons set the level': '此直播流在页面之外播放：滑块只能静音，音量请用设备的音量键调节',
  'This stream plays outside the page, so the Music slider can only mute it. Use the device volume buttons.': '此直播流在页面之外播放，因此“音乐”滑块只能静音。请使用设备的音量键。',
  'Sound effects volume': '音效音量', 'FX': '音效',
  'Nothing playing': '未在播放', 'Radio Stations': '电台列表', 'Local Music': '本地音乐', 'Close': '关闭', 'Choose folder…': '选择文件夹…',
  'Tap a station to tune in and return to the party.': '点按电台即可收听并返回队伍。',
  'MONSTER COMPENDIUM': '怪物图鉴', 'Tuner': '调谐器', 'Monster Compendium': '怪物图鉴',
  'A pixel-art adventure that marches to your music. Your party grows as you listen to radio; local music makes camp.': '一款随音乐前进的像素冒险。收听电台时队伍会成长；播放本地音乐时队伍会扎营休息。',
  'All pixel art is original. Radio stations are independent third-party streams; no music is included or uploaded: the music folder is read in your browser only.': '所有像素美术均为原创。电台为独立的第三方流媒体；不包含也不上传任何音乐：音乐文件夹仅在你的浏览器中读取。',
  "Radio: stations that allow it also drive the scene's reactions; others just play. Final Fantasy Radio is http-only and plays in the Windows app.": '电台：允许的电台还会驱动场景的反应；其他电台仅播放。Final Fantasy Radio 仅支持 http，只能在 Windows 应用中播放。',
  'Sound effects:': '音效：', 'Play test sound': '播放测试音',
  'on (volume {n}%)': '已开启（音量 {n}%）', 'not supported by this browser': '此浏览器不支持', 'waiting for a click or key press ({s})': '等待点击或按键（{s}）',
  // Library and radio
  '{folder} ({n} tracks)': '{folder}（{n} 首曲目）', '{a} of {b} match': '匹配 {a} / {b}', '{folder} - {n} matching': '{folder} - 匹配 {n} 项',
  'Scanning...': '正在扫描…', 'Reopen "{name}"': '重新打开“{name}”', 'From playlist: {s}': '来自播放列表：{s}',
  'Plays and drives the scene': '播放并驱动场景', 'Plays (no audio reactions)': '播放（无音频反应）', 'Plays; reactions if the station allows': '播放；若电台允许则有音频反应',
  'http only: needs a relay, so it only plays in the Windows app': '仅支持 http：需要中继，因此只能在 Windows 应用中播放',
  'Change folder...': '更改文件夹…', 'Select music folder...': '选择音乐文件夹…',
  'Playing': '播放中', 'Connecting...': '正在连接…', 'Buffering...': '正在缓冲…', 'Error: {msg}': '错误：{msg}',
  'this station only streams over plain http': '此电台仅支持普通 http 流', 'could not play': '无法播放',
  ' - no audio reactions': ' - 无音频反应',
  // Compendium and progress
  'Not yet encountered.': '尚未遇到。', 'HP {n}': '生命 {n}', 'DEFEATED': '已击败', 'DISCOVERED {a}/{b}   DEFEATED {n}': '已发现 {a}/{b}   已击败 {n}',
  "Progress copied. Paste it into Import on another device, or into the Windows app's saved settings.": '进度已复制。可在其他设备的“导入”中粘贴，或粘贴到 Windows 应用的已保存设置中。',
  'Copy your progress:': '复制你的进度：', 'Paste a progress string:': '粘贴进度字符串：',
  'Progress paused while game was minimized.': '游戏最小化期间进度已暂停。',
  'RESTART': '重新开始',
  'This resets your adventure: your party goes back to just the Paca, levels, gold and the compendium are cleared, and the day and season start over.\n\nType {word} to confirm.': '这将重置你的冒险：队伍只剩下羊驼，等级、金币和图鉴都会清空，日期和季节重新开始。\n\n输入“{word}”以确认。',
  // The party
  'Paca': '羊驼', 'Thief': '盗贼', 'Warrior': '战士', 'Light Mage': '光明法师', 'Fire Mage': '火焰法师', 'Fae': '妖精',
  'Quick, quiet and always one step ahead.': '身手敏捷，悄无声息，总是快人一步。',
  'A stalwart front-liner who never backs down.': '坚定的前排战士，从不退缩。',
  'Keeps the whole party hale and humming.': '让全队保持健康、精神抖擞。',
  'A short fuse and a flair for the dramatic.': '火爆脾气，偏爱戏剧效果。',
  'A glimmering lucky charm who never tires.': '闪闪发光的幸运符，永不疲倦。',
  'Fast, loyal and always out front.': '迅捷、忠诚，永远冲在最前。',
  'Spring': '春', 'Summer': '夏', 'Fall': '秋', 'Winter': '冬', 'Year {y}  Day {d}': '第 {y} 年  第 {d} 天',
  // Traits
  'Item Storage: +{n} slot for the party': '物品栏：队伍 +{n} 格', 'Item Storage: +{n} slots for the party': '物品栏：队伍 +{n} 格',
  'Heal: {hp} HP to the weakest ally every {s} s': '治疗：每 {s} 秒为最弱的队友恢复 {hp} 点生命',
  'Fireball: casts one to the right every {s} s': '火球：每 {s} 秒向右发射一枚',
  'Lucky Coins: {p}% chance of {n} coins together': '幸运金币：{p}% 几率同时出现 {n} 枚金币',
  'Huzzah!: party damage x{m} for {d} s every {s} s': '万岁！：每 {s} 秒让全队伤害 x{m}，持续 {d} 秒',
  'Star Hat: party wears one for {d} min every {s} min': '星星帽：每 {s} 分钟全队戴上 {d} 分钟',
  'Huzzah!': '万岁！', 'Blood Moon!': '血月！',
  // HUD and shop
  'Tuner: music & radio stations': '调谐器：音乐与电台', 'Tap: use   Hold: switch': '轻点：使用   长按：切换', 'Restart': '重新开始',
  'Merchant': '商人', 'In bag: {n}': '背包中：{n}', 'Leave': '离开', 'Tap anywhere to close': '点击任意位置关闭', 'Click anywhere to close': '点击任意位置关闭',
  'Synergy Elixir': '协同灵药', 'Red Potion': '红色药水', 'Blue Potion': '蓝色药水', 'Healing Potion I': '治疗药水 I',
  'Heals one party member for 10 HP. After using it, tap the member to heal.': '为一名队员恢复10点HP。使用后，点按要治疗的队员。', 'Choose who to heal': '选择要治疗的队员', 'HP full': '生命已满', 'Fainted!': '昏倒了！',
  'A placeholder potion. It does nothing yet.': '占位药水，目前没有任何效果。',
  "Resets every party member's skills so they all fire together within a second, Huzzah! first so the damage skills get its full benefit.": '重置全队技能，使它们在一秒内同时发动；“万岁！”最先触发，让伤害技能获得其全部加成。',
  'Bought {name}': '购买了{name}', 'Safe travels!': '一路平安！', 'Synergy!': '协同！', '{name}: nothing happens yet': '{name}：目前没有效果',
  // Story
  'Resting at camp: play a radio stream to keep adventuring': '正在营地休息：播放电台以继续冒险',
  'A tavern! Your last companion is waiting.': '一间酒馆！你的最后一位同伴正在等你。', 'A tavern! Who joins the party?': '一间酒馆！谁将加入队伍？',
  'Give the crystal to someone in your party': '把水晶交给队伍中的某人', 'LEVEL UP': '升级', 'Lv. {n}': '等级 {n}', '{name} reached Lv. {n}!': '{name} 升到了 {n} 级！',
  'Old Man': '老人', "Quite the journey you've been on.": '你经历了一段不平凡的旅程。',
  'Are you prepared to level up your adventure?': '你准备好提升你的冒险了吗？',
  'It matters not, for that is your destiny.': '这无关紧要，因为这就是你的命运。', 'It so happens I have what you need.': '碰巧我有你需要的东西。',
  'The Old Man throws you a blue crystal.': '老人向你抛来一颗蓝色水晶。', 'Give this to someone in your party.': '把这个交给队伍中的某人。',
  'You found a Fantasy Crystal! Give it to someone in your party.': '你找到了一颗幻想水晶！把它交给队伍中的某人。',
  // Monsters
  'Sheller': '龟壳兽', 'Orc': '兽人', 'Nightmare': '梦魇', 'Gargogryph': '石像鹫',
  'Roams by day': '白天出没', 'Roams day and night': '昼夜出没', 'Roams after dark': '夜间出没', 'Only under a dark sky': '仅在夜空下出现',
  'A grumpy shell-back. Punches first, claws second.': '脾气暴躁的龟壳兽，先出拳，再挥爪。',
  'Fond of shiny earrings and swinging big sticks.': '喜欢闪亮的耳环和挥舞大木棒。',
  'A cloaked drifter that only calls after dark.': '披着斗篷的游荡者，只在天黑后现身。',
  'A stone lion-ox with eagle wings, hard to hurt. Wingbeats throw razor feathers, and it can call down a Blood Moon.': '长着鹰翼的石头狮牛，难以伤害。拍动翅膀会射出锋利的羽毛，还能召唤血月。',
};

const TABLES = { es: ES, zh: ZH };
let current = 'en';
const listeners = [];

/** Translates an English string (or fills its {parameters}) for the current language. */
export function t(text, vars) {
  const table = TABLES[current];
  let out = (table && Object.prototype.hasOwnProperty.call(table, text)) ? table[text] : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

export function getLanguage() { return current; }
export function isCjk() { return current === 'zh'; }

/** Picks a language from the browser's own preferences. */
export function detectLanguage() {
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
  for (const p of prefs) {
    const l = String(p).toLowerCase();
    if (l.startsWith('es')) return 'es';
    if (l.startsWith('zh')) return 'zh';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

export function setLanguage(code) {
  if (!LANGUAGES.some(l => l.code === code)) code = 'en';
  current = code;
  try { document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code; } catch (e) { /* */ }
  for (const f of listeners) f(code);
}

/** Called after every language change (and by the page once at start-up). */
export function onLanguageChange(f) { listeners.push(f); }

// The page's own static text and attributes: [selector, what, English text].
const DOM = [
  ['#tabs [data-tab=adventure]', 'text', 'Adventure'], ['#tabs [data-tab=music]', 'text', 'Local Music'], ['#tabs [data-tab=radio]', 'text', 'Radio'],
  ['#menuBtn', 'title', 'Menu'], ['#menuBtn', 'aria-label', 'Menu'],
  ['#menu [data-act=export]', 'text', 'Export progress'], ['#menu [data-act=import]', 'text', 'Import progress'],
  ['#menu [data-act=restart]', 'text', 'Restart adventure'], ['#menu [data-act=about]', 'text', 'About'], ['#menuLangHdr', 'text', 'Language'],
  ['#pickFolder', 'text', 'Choose music folder…'], ['#musicSearch', 'placeholder', 'Search songs…'],
  ['#musicEmpty', 'text', 'Select your music folder of choice to play local music.'],
  ['#addPlaylist', 'text', 'Add playlist…'], ['#radioHint', 'text', 'Stations from .m3u / .m3u8 / .pls files or links are kept in this browser.'],
  ['#addLink', 'text', 'Add link…'], ['#linkUrl', 'placeholder', 'Paste a station or .pls / .m3u link'], ['#linkAdd', 'text', 'Add'],
  ['#btnShuffle', 'title', 'Shuffle'], ['#btnShuffle', 'aria-label', 'Shuffle'], ['#btnPrev', 'aria-label', 'Previous'],
  ['#btnPlay', 'aria-label', 'Play or pause'], ['#btnNext', 'aria-label', 'Next'], ['#btnRepeat', 'title', 'Repeat'], ['#btnRepeat', 'aria-label', 'Repeat'],
  ['#volMainLabel', 'title', 'Music volume'], ['#volFxLabel', 'title', 'Sound effects volume'], ['#volMainText', 'text', 'Music'], ['#volFxText', 'text', 'FX'],
  ['#tuner [data-ttab=radio]', 'text', 'Radio Stations'], ['#tuner [data-ttab=local]', 'text', 'Local Music'],
  ['#tunerClose', 'aria-label', 'Close'], ['#tunerSearch', 'placeholder', 'Search songs…'],
  ['#tunerNoFolder', 'text', 'Select your music folder of choice to play local music.'],
  ['#tunerRadioHint', 'text', 'Tap a station to tune in and return to the party.'],
  ['#compTitle', 'text', 'MONSTER COMPENDIUM'], ['#compClose', 'aria-label', 'Close'], ['#tuner', 'aria-label', 'Tuner'], ['#compendium', 'aria-label', 'Monster Compendium'],
  ['#aboutIntro', 'text', 'A pixel-art adventure that marches to your music. Your party grows as you listen to radio; local music makes camp.'],
  ['#aboutArt', 'text', 'All pixel art is original. Radio stations are independent third-party streams; no music is included or uploaded: the music folder is read in your browser only.'],
  ['#aboutRadio', 'text', "Radio: stations that allow it also drive the scene's reactions; others just play. Final Fantasy Radio is http-only and plays in the Windows app."],
  ['#themeText', 'text', 'Theme'], ['#themeSel', 'aria-label', 'Theme'], ['#pathLabel', 'text', 'Music volume:'], ['#soundLabel', 'text', 'Sound effects:'], ['#soundTest', 'text', 'Play test sound'], ['#aboutClose', 'text', 'Close'],
];

/** Writes the current language into the page's static text. */
export function applyDom(root) {
  const r = root || document;
  for (const [sel, what, text] of DOM) {
    const el = r.querySelector(sel);
    if (!el) continue;
    const v = t(text);
    if (what === 'text') el.textContent = v; else el.setAttribute(what, v);
  }
}
