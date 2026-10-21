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
  'COMPENDIUM': 'COMPENDIO', 'Max HP +{n}': 'PV máx. +{n}', 'BACK': 'VOLVER', 'Level up {name} to Lv. {n}?': '¿Subir a {name} al nivel {n}?', 'Tuner': 'Sintonizador', 'Compendium': 'Compendio',
  'MONSTERS': 'MONSTRUOS', 'PARTY': 'GRUPO', 'NOTES': 'NOTAS', 'ATTACK': 'ATAQUE', 'SKILL': 'HABILIDAD', 'Show everything': 'Mostrar todo',
  'HIT {n}': 'GOLPE {n}', 'EVERY {n} s': 'CADA {n} s', 'BLOOD MOON {n}': 'LUNA DE SANGRE {n}', 'HEROES USED {a}/{b}': 'HÉROES USADOS {a}/{b}',
  'Not yet recruited.': 'Aún no reclutado.',
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
  'Progress was paused while tab was minimized or hidden. Please play Fantasy Radio Companion in the foreground.': 'El progreso se pausó mientras la pestaña estaba minimizada u oculta. Juega a Fantasy Radio Companion en primer plano.',
  'RESTART': 'REINICIAR',
  'This resets your adventure: your party goes back to just the Paca, levels, gold and the compendium are cleared, and the day and season start over.\n\nType {word} to confirm.': 'Esto reinicia tu aventura: tu grupo vuelve a ser solo la Alpaca, se borran niveles, oro y compendio, y el día y la estación empiezan de nuevo.\n\nEscribe {word} para confirmar.',
  // The party
  'Druid': 'Druida', 'Natural Toxin': 'Toxina natural', 'Paca': 'Alpaca', 'Thief': 'Ladrón', 'Warrior': 'Guerrero', 'Light Mage': 'Mago de luz', 'Fire Mage': 'Mago de fuego', 'Fae': 'Hada',
  'Quick, quiet and always one step ahead.': 'Rápido, sigiloso y siempre un paso por delante.',
  'A stalwart front-liner who never backs down.': 'Un firme combatiente de primera línea que nunca retrocede.',
  'Keeps the whole party hale and humming.': 'Mantiene a todo el grupo sano y animado.',
  'A short fuse and a flair for the dramatic.': 'Mecha corta y gusto por lo dramático.',
  'A glimmering lucky charm who never tires.': 'Un amuleto brillante de la suerte que nunca se cansa.',
  'Tends the wild, and the wild answers.': 'Cuida de lo salvaje, y lo salvaje responde.',
  'A Sheller whose shell has split open to molten rock. It spits a fireball that scorches the first two in line.': 'Un Caparazón cuya concha se abrió en roca fundida. Escupe una bola de fuego que abrasa a los dos primeros de la fila.',
  'Hammers a drum slung at its belly and bellows between beats. Hits fast and hard.': 'Golpea un tambor colgado de la cintura y ruge entre redobles. Golpea rápido y fuerte.',
  'A cloaked scarecrow that watches from the field. Its long pitchfork spears the first three in line.': 'Un espantapájaros encapuchado que vigila desde el campo. Su larga horca ensarta a los tres primeros de la fila.',
  'Natural Toxin: {d} damage a second for {n} s, every {s} s': 'Toxina natural: {d} de daño por segundo durante {n} s, cada {s} s',
  'Paladin': 'Paladín', 'Shadow Knight': 'Caballero sombrío', 'Developer Updates': 'Novedades del desarrollo', 'Miss!': '¡Fallo!', 'Sand Crab': 'Cangrejo de arena', 'Venom Flayer': 'Desollador venenoso', 'Roams the Year 5 desert, day and night': 'Merodea por el desierto del Año 5, de día y de noche', 'A big tan crab with a cactus-ridged shell. Its claw pinches the first in line, and at half health it kicks up a Sand Blast: it hurts the whole party and Blinds every hero, so their next attack misses.': 'Un gran cangrejo color arena con el caparazón surcado de cactus. Su pinza aprieta al primero de la fila y, con la mitad de la vida, levanta una Explosión de arena: daña a todo el grupo y Ciega a cada héroe, así que su próximo ataque falla.', 'An imposing cobra with glinting fangs. Its bite poisons the first in line, and at 30% health it spits Venom over the first three, poisoning each of them.': 'Una cobra imponente de colmillos relucientes. Su mordisco envenena al primero de la fila y, con el 30% de la vida, escupe Veneno sobre los tres primeros y envenena a cada uno.', 'HP': 'PS', 'Melee': 'Cuerpo a cuerpo', 'Peck': 'Picotazo', 'Thrown axe': 'Hacha lanzada', 'Crossbow': 'Ballesta', 'Scythe': 'Guadaña', 'Heal': 'Curación', 'Shield Wall': 'Muro de escudos', 'Shield Wall!': '¡Muro de escudos!', 'Life Drain': 'Drenar vida',
  'Sworn to shield the weak with a steady, holy light.': 'Jura proteger a los débiles con una luz santa y firme.', 'Fights from the dark, and what he takes he gives back.': 'Lucha desde la oscuridad, y lo que toma lo devuelve.',
  'Shield Wall: every {s} s the first hero\'s damage goes to the Paladin for {d} s (halved if he leads)': 'Muro de escudos: cada {s} s el daño del primer héroe pasa al Paladín durante {d} s (a la mitad si él va primero)', 'Life Drain: takes {d} HP from the enemy and gives {h} to the weakest ally every {s} s': 'Drenar vida: quita {d} PS al enemigo y da {h} al aliado más débil cada {s} s',
  'Tavern Shop': 'Tienda de la taberna', 'Unlocked': 'Desbloqueado', 'Back': 'Volver', 'You received a Tavern Stamp!': '¡Recibiste un sello de taberna!',
  'Fast, loyal and always out front.': 'Veloz, leal y siempre al frente.',
  'Spring': 'Primavera', 'Summer': 'Verano', 'Fall': 'Otoño', 'Winter': 'Invierno', 'Year {y}  Day {d}': 'Año {y}  Día {d}',
  // Traits
  'Scroll Storage: +{n} slot for the party': 'Almacén de pergaminos: +{n} ranura para el grupo', 'Scroll Storage: +{n} slots for the party': 'Almacén de pergaminos: +{n} ranuras para el grupo',
  'Rereviver Scroll': 'Pergamino de Rerevivir', 'Grants Rerevive to one party member for 1 year: if they faint, they instantly revive on the spot with 50% HP. It is used up when it does.': 'Otorga Rerevivir a un miembro del grupo durante 1 año: si se desmaya, revive al instante en su sitio con el 50% de su vida. Se gasta al hacerlo.',
  'Scroll: tap to use, hold to choose': 'Pergamino: toca para usar, mantén para elegir', 'Scrolls: none carried': 'Pergaminos: ninguno', 'Discard': 'Tirar',
  'Scroll storage is full': 'El almacén de pergaminos está lleno', 'Choose one to throw away': 'Elige uno para tirar', 'New': 'Nuevo',
  'Found {n}!': '¡Encontraste {n}!', 'Nobody can take it': 'Nadie puede recibirlo', 'Already fainted': 'Ya está desmayado', 'Already has Rerevive': 'Ya tiene Rerevivir',
  'Rerevive!': '¡Rerevivir!', 'Rerevived!': '¡Rerevivió!', 'Choose who gets Rerevive': 'Elige quién recibe Rerevivir',

  'Heal: {hp} HP to the weakest ally every {s} s': 'Curar: {hp} PV al aliado más débil cada {s} s',
  'Fireball: casts one to the right every {s} s': 'Bola de fuego: lanza una a la derecha cada {s} s',
  'Lucky Coins: {p}% chance of {n} coins together': 'Monedas de la suerte: {p}% de probabilidad de {n} monedas juntas',
  'Huzzah!: party damage x{m} for {d} s every {s} s': '¡Hurra!: daño del grupo x{m} durante {d} s cada {s} s',
  'Star Hat: red (+1 HP / 2 s) or blue (half damage) hats for {d} min every {s} min': 'Sombrero estelar: rojo (+1 PV / 2 s) o azul (mitad de daño), {d} min cada {s} min',
  'Huzzah!': '¡Hurra!', 'Blood Moon!': '¡Luna de Sangre!',
  // HUD and shop
  'Tuner: music & radio stations': 'Sintonizador: música y emisoras', 'Tap: use   Hold: switch': 'Toca: usar   Mantén: cambiar', 'Restart': 'Reiniciar',
  'Merchant': 'Mercader', 'In bag: {n}': 'En la bolsa: {n}', 'Leave': 'Salir', 'Tap anywhere to close': 'Toca en cualquier lugar para cerrar', 'Click anywhere to close': 'Haz clic en cualquier lugar para cerrar',
  'Synergy Elixir': 'Elixir de sinergia', 'Red Potion': 'Poción roja', 'Monster Berserker': 'Berserker de monstruos', 'Monster damage multiplier': 'Multiplicador de daño de los monstruos',
  'A dev tool: multiplies the damage monsters deal, from 1X to 5X, for 2 minutes. Pick the multiplier after using it; a new use replaces the old one. Never runs out.': 'Una herramienta de desarrollo: multiplica el daño que hacen los monstruos, de 1X a 5X, durante 2 minutos. Elige el multiplicador al usarla; un nuevo uso reemplaza al anterior. Nunca se agota.',
  'START THE RADIO,\nSTART YOUR ADVENTURE!': '¡PON LA RADIO,\nEMPIEZA TU AVENTURA!', 'Who will you adventure as?': '¿Con quién vas a vivir la aventura?',
  'The party has fallen': 'El grupo ha caído', 'Start Over': 'Empezar de nuevo',
  'Need to rest and reorganize?': '¿Necesitáis descansar y reorganizaros?', 'Rest': 'Descansar', 'Reorganize': 'Reorganizar', 'Not now': 'Ahora no',
  'Quality': 'Calidad', 'Auto': 'Auto', 'Low': 'Baja', 'Medium': 'Media', 'High': 'Alta', 'Fully heals the party.': 'Cura por completo al grupo.', 'Swap the positions of 2 heroes.': 'Intercambia la posición de 2 héroes.', 'Not enough gold': 'Oro insuficiente', 'Everyone is fine': 'Todos están bien',
  'Choose two heroes to swap': 'Elige dos héroes para intercambiar', 'Now choose who to swap with': 'Ahora elige con quién intercambiar', 'Rested!': '¡Descansados!', 'Swapped!': '¡Intercambiados!',
  'DEFEAT': 'DERROTA', 'NEW RECORD': '¡NUEVO RÉCORD!', 'Furthest: {s}': 'Más lejos: {s}',
  'Survived: {s}': 'Sobrevivió: {s}', '{n} year': '{n} año', '{n} years': '{n} años', '{n} day': '{n} día', '{n} days': '{n} días',
  'Monsters x{n}': 'Monstruos x{n}', 'Monsters x{n} for 2 minutes': 'Monstruos x{n} durante 2 minutos', 'Revive Potion': 'Poción de reanimación', 'Healing Potion I': 'Poción de curación I',
  "Heals one party member for 10 HP. After using it, tap the member to heal. It can't wake a fainted member: that takes a Revive Potion or a Rest at the inn.": 'Cura 10 PS a un miembro del grupo. Tras usarla, toca al miembro que quieras curar. No despierta a un miembro desmayado: para eso hace falta una poción de reanimación o un descanso en la posada.', 'Choose who to heal': 'Elige a quién curar', 'HP full': 'Vida al máximo', 'Fainted!': '¡Se desmayó!',
  'Revives a fainted party member with 50% HP, at the back of the line. After using it, tap the fainted member.': 'Reanima a un miembro desmayado con el 50% de su vida y lo pone al final de la fila. Tras usarla, toca al miembro desmayado.',
  'Choose who to revive': 'Elige a quién reanimar', 'Not fainted': 'No está desmayado', 'Needs a Revive Potion': 'Necesita una poción de reanimación', 'No one has fainted': 'Nadie se ha desmayado', 'Revived!': '¡Reanimado!',
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
  'Your party is in danger! Heal them with a potion.': '¡Tu grupo está en peligro! Cúralos con una poción.',
  'Collect Gold Coins to buy more Healing Potions from the Merchant!': '¡Recoge monedas de oro para comprar más pociones de curación al Mercader!',
  'You found a Fantasy Crystal! Give it to someone in your party.': '¡Encontraste un Cristal de Fantasía! Dáselo a alguien de tu grupo.',
  // Monsters
  'Sheller': 'Caparazón', 'Orc': 'Orco', 'Nightmare': 'Pesadilla', 'Gargogryph': 'Gargogrifo',
  'Toucan': 'Tucán', 'Magma Shellra': 'Shellra de magma', 'Percussive Orc': 'Orco percusivo', 'Shadecrow': 'Cuervo sombrío', 'Spiked Sheller': 'Caparazón espinoso', 'Bass Orc': 'Orco bajista', 'Slasher': 'Destripador', 'Wickedgryph': 'Malvagrifo',
  'Roams by day, from Year 2': 'Merodea de día, desde el Año 2', 'Roams by day, from Year 4': 'Merodea de día, desde el Año 4', 'Roams day and night, from Year 4': 'Merodea de día y de noche, desde el Año 4', 'Roams after dark, from Year 4': 'Merodea al anochecer, desde el Año 4', 'Roams day and night, from Year 2': 'Merodea de día y de noche, desde el Año 2', 'Roams day and night, from Year 3': 'Merodea de día y de noche, desde el Año 3', 'Roams after dark, from Year 2': 'Merodea al anochecer, desde el Año 2', 'Only under a dark sky, from Year 2': 'Solo bajo un cielo oscuro, desde el Año 2',
  'A purple toucan made of two tin cans, with metal talons. It slings a can tab that slices through the whole party.': 'Un tucán morado hecho con dos latas, con garras de metal. Lanza una anilla de lata que atraviesa a todo el grupo.',
  'A Sheller that grew spikes over the winter. Hits twice as hard.': 'Un Caparazón al que le crecieron púas durante el invierno. Golpea el doble de fuerte.',
  'Plays its orcish bass guitar at the party, and swings it, too. Hits twice as hard.': 'Toca su bajo orco para el grupo, y también lo blande. Golpea el doble de fuerte.',
  'A Nightmare that traded its scythe for a horror knife. Hits twice as hard, and still cuts through the first two in line.': 'Una Pesadilla que cambió su guadaña por un cuchillo de terror. Golpea el doble de fuerte y sigue atravesando a los dos primeros de la fila.',
  'A Gargogryph with big fangs and a worse temper. Hits twice as hard, and so does its Blood Moon.': 'Un Gargogrifo con grandes colmillos y peor carácter. Golpea el doble de fuerte, y su Luna de Sangre también.',
  'Roams by day': 'Merodea de día', 'Roams day and night': 'Merodea de día y de noche', 'Roams after dark': 'Merodea al anochecer', 'Only under a dark sky': 'Solo bajo un cielo oscuro',
  'A grumpy shell-back. Punches first, claws second.': 'Un gruñón con caparazón. Primero puñetazos, luego zarpazos.',
  'Fond of shiny earrings and swinging big sticks.': 'Aficionado a los pendientes brillantes y a blandir grandes garrotes.',
  'A cloaked drifter that only calls after dark. Its scythe cuts through the first two in line.': 'Un errante encapuchado que solo aparece al anochecer. Su guadaña atraviesa a los dos primeros de la fila.',
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
  'COMPENDIUM': '图鉴', 'Max HP +{n}': '最大生命 +{n}', 'BACK': '返回', 'Level up {name} to Lv. {n}?': '要让 {name} 升到 {n} 级吗？', 'Tuner': '调谐器', 'Compendium': '图鉴',
  'MONSTERS': '怪物', 'PARTY': '队伍', 'NOTES': '备注', 'ATTACK': '攻击', 'SKILL': '技能', 'Show everything': '显示全部',
  'HIT {n}': '伤害 {n}', 'EVERY {n} s': '每 {n} 秒', 'BLOOD MOON {n}': '血月 {n}', 'HEROES USED {a}/{b}': '已使用英雄 {a}/{b}',
  'Not yet recruited.': '尚未招募。',
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
  'Progress was paused while tab was minimized or hidden. Please play Fantasy Radio Companion in the foreground.': '标签页最小化或隐藏期间进度已暂停。请在前台运行 Fantasy Radio Companion。',
  'RESTART': '重新开始',
  'This resets your adventure: your party goes back to just the Paca, levels, gold and the compendium are cleared, and the day and season start over.\n\nType {word} to confirm.': '这将重置你的冒险：队伍只剩下羊驼，等级、金币和图鉴都会清空，日期和季节重新开始。\n\n输入“{word}”以确认。',
  // The party
  'Druid': '德鲁伊', 'Natural Toxin': '天然毒素', 'Paca': '羊驼', 'Thief': '盗贼', 'Warrior': '战士', 'Light Mage': '光明法师', 'Fire Mage': '火焰法师', 'Fae': '妖精',
  'Quick, quiet and always one step ahead.': '身手敏捷，悄无声息，总是快人一步。',
  'A stalwart front-liner who never backs down.': '坚定的前排战士，从不退缩。',
  'Keeps the whole party hale and humming.': '让全队保持健康、精神抖擞。',
  'A short fuse and a flair for the dramatic.': '火爆脾气，偏爱戏剧效果。',
  'A glimmering lucky charm who never tires.': '闪闪发光的幸运符，永不疲倦。',
  'Tends the wild, and the wild answers.': '照料荒野，荒野也会回应。',
  'A Sheller whose shell has split open to molten rock. It spits a fireball that scorches the first two in line.': '壳裂开露出熔岩的龟壳兽。它会喷出火球，灼烧队伍中的前两名。',
  'Hammers a drum slung at its belly and bellows between beats. Hits fast and hard.': '敲打挂在腰间的鼓，并在鼓点间怒吼。出手又快又重。',
  'A cloaked scarecrow that watches from the field. Its long pitchfork spears the first three in line.': '披着斗篷、在田野中窥视的稻草人。它的长干草叉会刺穿队伍中的前三名。',
  'Natural Toxin: {d} damage a second for {n} s, every {s} s': '天然毒素：每秒 {d} 点伤害，持续 {n} 秒，每 {s} 秒施放一次',
  'Paladin': '圣骑士', 'Shadow Knight': '暗影骑士', 'Developer Updates': '开发者动态', 'Miss!': '落空！', 'Sand Crab': '沙蟹', 'Venom Flayer': '毒液剥皮蛇', 'Roams the Year 5 desert, day and night': '第 5 年在沙漠中游荡，昼夜皆出没', 'A big tan crab with a cactus-ridged shell. Its claw pinches the first in line, and at half health it kicks up a Sand Blast: it hurts the whole party and Blinds every hero, so their next attack misses.': '一只壳上长着仙人掌脊的黄褐色大螃蟹。大钳夹击排头的队员；生命降到一半时会掀起沙暴：伤害全队并使每位英雄失明，下一次攻击会落空。', 'An imposing cobra with glinting fangs. Its bite poisons the first in line, and at 30% health it spits Venom over the first three, poisoning each of them.': '一条獠牙闪亮、气势逼人的眼镜蛇。撕咬会让排头的队员中毒；生命降到 30% 时会向前三人喷吐毒液，使他们都中毒。', 'HP': 'HP', 'Melee': '近战', 'Peck': '啄击', 'Thrown axe': '飞斧', 'Crossbow': '弩', 'Scythe': '镰刀', 'Heal': '治疗', 'Shield Wall': '盾墙', 'Shield Wall!': '盾墙！', 'Life Drain': '生命汲取',
  'Sworn to shield the weak with a steady, holy light.': '誓以坚定的圣光守护弱者。', 'Fights from the dark, and what he takes he gives back.': '于黑暗中战斗，夺走的生命会还给同伴。',
  'Shield Wall: every {s} s the first hero\'s damage goes to the Paladin for {d} s (halved if he leads)': '盾墙：每 {s} 秒，前排英雄受到的伤害转由圣骑士承受，持续 {d} 秒（若圣骑士在最前则减半）', 'Life Drain: takes {d} HP from the enemy and gives {h} to the weakest ally every {s} s': '生命汲取：每 {s} 秒从敌人身上夺取 {d} 点HP，并为最虚弱的队友恢复 {h} 点',
  'Tavern Shop': '酒馆商店', 'Unlocked': '已解锁', 'Back': '返回', 'You received a Tavern Stamp!': '你获得了一枚酒馆印章！',
  'Fast, loyal and always out front.': '迅捷、忠诚，永远冲在最前。',
  'Spring': '春', 'Summer': '夏', 'Fall': '秋', 'Winter': '冬', 'Year {y}  Day {d}': '第 {y} 年  第 {d} 天',
  // Traits
  'Scroll Storage: +{n} slot for the party': '卷轴栏：队伍 +{n} 格', 'Scroll Storage: +{n} slots for the party': '卷轴栏：队伍 +{n} 格',
  'Rereviver Scroll': '再复活卷轴', 'Grants Rerevive to one party member for 1 year: if they faint, they instantly revive on the spot with 50% HP. It is used up when it does.': '为一名队员赋予「再复活」，持续1年：若其昏倒，会在原地立即以50%生命复活，触发后即消耗。',
  'Scroll: tap to use, hold to choose': '卷轴：点按使用，长按选择', 'Scrolls: none carried': '卷轴：未携带', 'Discard': '丢弃',
  'Scroll storage is full': '卷轴栏已满', 'Choose one to throw away': '选择一件丢弃', 'New': '新',
  'Found {n}!': '找到了{n}！', 'Nobody can take it': '没有人能接受', 'Already fainted': '已经昏倒', 'Already has Rerevive': '已有再复活',
  'Rerevive!': '再复活！', 'Rerevived!': '再复活了！', 'Choose who gets Rerevive': '选择获得再复活的队员',

  'Heal: {hp} HP to the weakest ally every {s} s': '治疗：每 {s} 秒为最弱的队友恢复 {hp} 点生命',
  'Fireball: casts one to the right every {s} s': '火球：每 {s} 秒向右发射一枚',
  'Lucky Coins: {p}% chance of {n} coins together': '幸运金币：{p}% 几率同时出现 {n} 枚金币',
  'Huzzah!: party damage x{m} for {d} s every {s} s': '万岁！：每 {s} 秒让全队伤害 x{m}，持续 {d} 秒',
  'Star Hat: red (+1 HP / 2 s) or blue (half damage) hats for {d} min every {s} min': '星星帽：红色（每 2 秒 +1 生命）或蓝色（伤害减半），持续 {d} 分钟，每 {s} 分钟一次',
  'Huzzah!': '万岁！', 'Blood Moon!': '血月！',
  // HUD and shop
  'Tuner: music & radio stations': '调谐器：音乐与电台', 'Tap: use   Hold: switch': '轻点：使用   长按：切换', 'Restart': '重新开始',
  'Merchant': '商人', 'In bag: {n}': '背包中：{n}', 'Leave': '离开', 'Tap anywhere to close': '点击任意位置关闭', 'Click anywhere to close': '点击任意位置关闭',
  'Synergy Elixir': '协同灵药', 'Red Potion': '红色药水', 'Monster Berserker': '怪物狂暴', 'Monster damage multiplier': '怪物伤害倍率',
  'A dev tool: multiplies the damage monsters deal, from 1X to 5X, for 2 minutes. Pick the multiplier after using it; a new use replaces the old one. Never runs out.': '开发工具：将怪物造成的伤害提高1X至5X，持续2分钟。使用后选择倍率；再次使用会替换之前的效果。永不耗尽。',
  'START THE RADIO,\nSTART YOUR ADVENTURE!': '开启电台，\n开启你的冒险！', 'Who will you adventure as?': '你想扮演谁去冒险？',
  'The party has fallen': '队伍已倒下', 'Start Over': '重新开始',
  'Need to rest and reorganize?': '需要休息并重新整队吗？', 'Rest': '休息', 'Reorganize': '重新整队', 'Not now': '暂不',
  'Quality': '画质', 'Auto': '自动', 'Low': '低', 'Medium': '中', 'High': '高', 'Fully heals the party.': '完全治疗全队。', 'Swap the positions of 2 heroes.': '交换2名英雄的位置。', 'Not enough gold': '金币不足', 'Everyone is fine': '大家都没事',
  'Choose two heroes to swap': '选择两名要交换的英雄', 'Now choose who to swap with': '再选择要交换的对象', 'Rested!': '已恢复！', 'Swapped!': '已交换！',
  'DEFEAT': '战败', 'NEW RECORD': '新纪录！', 'Furthest: {s}': '最远：{s}',
  'Survived: {s}': '存活：{s}', '{n} year': '{n} 年', '{n} years': '{n} 年', '{n} day': '{n} 天', '{n} days': '{n} 天',
  'Monsters x{n}': '怪物 x{n}', 'Monsters x{n} for 2 minutes': '怪物 x{n}，持续2分钟', 'Revive Potion': '复活药水', 'Healing Potion I': '治疗药水 I',
  "Heals one party member for 10 HP. After using it, tap the member to heal. It can't wake a fainted member: that takes a Revive Potion or a Rest at the inn.": '为一名队员恢复10点HP。使用后，点按要治疗的队员。无法唤醒昏倒的队员：需要复活药水或在旅店休息。', 'Choose who to heal': '选择要治疗的队员', 'HP full': '生命已满', 'Fainted!': '昏倒了！',
  'Revives a fainted party member with 50% HP, at the back of the line. After using it, tap the fainted member.': '让一名昏倒的队员以50%生命复活，并排到队伍末尾。使用后，点按昏倒的队员。',
  'Choose who to revive': '选择要复活的队员', 'Not fainted': '没有昏倒', 'Needs a Revive Potion': '需要复活药水', 'No one has fainted': '没有人昏倒', 'Revived!': '复活了！',
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
  'Your party is in danger! Heal them with a potion.': '你的队伍有危险了！用药水治疗他们吧。',
  'Collect Gold Coins to buy more Healing Potions from the Merchant!': '收集金币，向商人购买更多治疗药水！',
  'You found a Fantasy Crystal! Give it to someone in your party.': '你找到了一颗幻想水晶！把它交给队伍中的某人。',
  // Monsters
  'Sheller': '龟壳兽', 'Orc': '兽人', 'Nightmare': '梦魇', 'Gargogryph': '石像鹫',
  'Toucan': '巨嘴鸟', 'Magma Shellra': '熔岩龟壳兽', 'Percussive Orc': '打击兽人', 'Shadecrow': '影鸦', 'Spiked Sheller': '尖刺龟壳兽', 'Bass Orc': '贝斯兽人', 'Slasher': '杀戮者', 'Wickedgryph': '凶牙石像鹫',
  'Roams by day, from Year 2': '第2年起白天出没', 'Roams by day, from Year 4': '第4年起白天出没', 'Roams day and night, from Year 4': '第4年起昼夜出没', 'Roams after dark, from Year 4': '第4年起夜间出没', 'Roams day and night, from Year 2': '第2年起昼夜出没', 'Roams day and night, from Year 3': '第3年起昼夜出没', 'Roams after dark, from Year 2': '第2年起夜间出没', 'Only under a dark sky, from Year 2': '第2年起仅在夜空下出现',
  'A purple toucan made of two tin cans, with metal talons. It slings a can tab that slices through the whole party.': '一只用两个罐头做成的紫色巨嘴鸟，长着金属利爪。它会甩出一枚拉环，贯穿整个队伍。',
  'A Sheller that grew spikes over the winter. Hits twice as hard.': '一只在冬天长出尖刺的龟壳兽，攻击力翻倍。',
  'Plays its orcish bass guitar at the party, and swings it, too. Hits twice as hard.': '对着队伍弹奏兽人贝斯，还会抡起来砸人，攻击力翻倍。',
  'A Nightmare that traded its scythe for a horror knife. Hits twice as hard, and still cuts through the first two in line.': '把镰刀换成恐怖尖刀的梦魇，攻击力翻倍，仍会同时砍中队伍里的前两人。',
  'A Gargogryph with big fangs and a worse temper. Hits twice as hard, and so does its Blood Moon.': '长着巨大獠牙、脾气更坏的石像鹫。攻击力翻倍，它的血月也一样。',
  'Roams by day': '白天出没', 'Roams day and night': '昼夜出没', 'Roams after dark': '夜间出没', 'Only under a dark sky': '仅在夜空下出现',
  'A grumpy shell-back. Punches first, claws second.': '脾气暴躁的龟壳兽，先出拳，再挥爪。',
  'Fond of shiny earrings and swinging big sticks.': '喜欢闪亮的耳环和挥舞大木棒。',
  'A cloaked drifter that only calls after dark. Its scythe cuts through the first two in line.': '披着斗篷的游荡者，只在天黑后现身。它的镰刀会同时砍中队伍里的前两人。',
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
  ['#compTitle', 'text', 'COMPENDIUM'], ['#compClose', 'aria-label', 'Close'], ['#tuner', 'aria-label', 'Tuner'], ['#compendium', 'aria-label', 'Compendium'],
  ['#compEye', 'aria-label', 'Show everything'], ['#compEye', 'title', 'Show everything'],
  ['#compTabs [data-ctab="0"]', 'text', 'MONSTERS'], ['#compTabs [data-ctab="1"]', 'text', 'PARTY'],
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
