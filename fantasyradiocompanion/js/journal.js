// The developer journal shown by Settings > Developer Updates, newest day first. ONE ENTRY PER DAY, written for players in plain, friendly
// words, one SHORT line per change (a few words to one short sentence: long lines cost translation effort and are tiring to read).
// When more changes land on a day that already has an entry, edit that entry to describe where things ended up (never list the steps we
// took on the way, or things that were replaced the same day). Every entry has its Spanish (es) and Simplified Chinese (zh) text beside
// the English: keep the three in step, with the same number of lines in the same order. After editing, run `node tools/gen-journal.js` to
// refresh the Windows app's copy (src/JournalData.cs) and bump the cache version in web/sw.js.
// This file is plain data (the generator reads it): { date: 'YYYY-MM-DD', title, notes: [...], es: { title, notes }, zh: { title, notes } }.
export const JOURNAL = [
  {
    date: '2026-10-28',
    title: "Fang's Magnetic Field",
    notes: [
      "Everyone now carries Fang's Magnetic Field: switch it on for 15 minutes of coins zapping straight into your purse.",
      'It can be used again 30 minutes after you switched it on.',
      'Scroll storage has one more slot, so Fang fits beside any Rereviver Scroll you find.',
      'The Compendium has an Items tab showing every item in the game. Ones you have not had yet are greyed out.',
      'The radio dial now sits under the item and scroll buttons, the same size, so a late grab for a coin does not open it.'
    ],
    es: {
      title: 'El Campo magnético de Fang',
      notes: [
        'Ahora todos llevan el Campo magnético de Fang: enciéndelo 15 minutos y las monedas volarán directas a tu bolsa.',
        'Puede volver a usarse 30 minutos después de encenderlo.',
        'El almacén de pergaminos tiene una ranura más, así que Fang cabe junto a cualquier Pergamino de Rerevivir que encuentres.',
        'El Compendio tiene una pestaña de Objetos con todo lo que hay en el juego. Lo que aún no has tenido aparece atenuado.',
        'El dial de radio ahora está bajo los botones de objetos y pergaminos, del mismo tamaño, para que un intento tardío de coger una moneda no lo abra.'
      ]
    },
    zh: {
      title: 'Fang 的磁场',
      notes: [
        '现在每个人都带有 Fang 的磁场：启动后 15 分钟内，金币会直接被电击吸进钱袋。',
        '启动 30 分钟后可再次使用。',
        '卷轴栏多了一格，所以 Fang 可以和你找到的复活卷轴一起带着。',
        '图鉴新增“物品”标签页，列出游戏中的所有物品。还没拥有过的会显示为灰色。',
        '电台旋钮现在位于物品和卷轴按钮下方，大小相同，这样最后一刻去抢金币时就不会误点到它。'
      ]
    }
  },
  {
    date: '2026-10-22',
    title: 'Skill trees begin',
    notes: [
      'Heroes now grow skill trees as they level up. The Warrior and the Light Mage come first.',
      'At level 5 the Warrior picks a path: Stalwart takes 25% less physical damage, Rager deals 25% more.',
      'At level 5 the Light Mage picks a spell: Paralyze may stop an enemy from attacking (even its special attacks), Diminish makes it take 10% more damage.',
      'The desert goes on: from Year 5 the party stays in it, and the Sand Crabs and Venom Flayers keep coming.',
      'New Adventure Log: a timeline of every hit, skill and status effect. Find it beside the Log in the app, or under the playback controls on the web. A filter shows only attacks, skills, status effects and more.',
      'Already past level 5? A glowing "New skills available" button on the right lets you choose.',
      'Local Music has playlists: import them from iTunes, Apple Music, Traktor, M3U or PLS files, or make your own. See which tracks are missing from your folder. The music list shows artists and can be sorted by name, artist, format or path.'
    ],
    es: {
      title: 'Empiezan los árboles de habilidades',
      notes: [
        'Los héroes ahora desarrollan árboles de habilidades al subir de nivel. Primero, el guerrero y el mago de luz.',
        'En el nivel 5 el guerrero elige un camino: Recio recibe un 25 % menos de daño físico, Furioso inflige un 25 % más.',
        'En el nivel 5 el mago de luz elige un hechizo: Paralizar puede impedir que el enemigo ataque (incluso con sus ataques especiales) y Debilitar hace que reciba un 10 % más de daño.',
        'El desierto continúa: desde el Año 5 el grupo se queda en él, y los cangrejos de arena y los desolladores venenosos siguen apareciendo.',
        'Nuevo Diario de aventura: una cronología de cada golpe, habilidad y efecto de estado. Está junto al Log en la aplicación, o bajo los controles de reproducción en la web. Un filtro muestra solo ataques, habilidades, estados y más.',
        '¿Ya pasaste el nivel 5? Un botón brillante de «Nuevas habilidades disponibles» a la derecha te deja elegir.',
        'La música local tiene listas de reproducción: impórtalas desde iTunes, Apple Music, Traktor, M3U o PLS, o crea las tuyas. Mira qué pistas faltan en tu carpeta. La lista de música muestra artistas y se puede ordenar por nombre, artista, formato o ruta.'
      ]
    },
    zh: {
      title: '技能树登场',
      notes: [
        '英雄升级时现在会成长出技能树，战士和光明法师打头阵。',
        '战士在 5 级时选择一条道路：坚毅受到的物理伤害减少 25%，狂战造成的伤害增加 25%。',
        '光明法师在 5 级时选择一个法术：麻痹有几率使敌人无法攻击（连特殊攻击也不例外），削弱会让敌人受到的伤害增加 10%。',
        '沙漠还在继续：从第 5 年起队伍会一直留在沙漠里，沙蟹和毒液剥皮者不断出现。',
        '全新的冒险日志：按时间记录每一次攻击、技能和状态效果。在应用里就在日志旁边，网页版则在播放控制按钮下方。还有筛选器，可只看攻击、技能、状态效果等。',
        '已经超过 5 级了？右侧会亮起“有新技能可用”按钮，让你随时选择。',
        '本地音乐现在有播放列表了：可从 iTunes、Apple Music、Traktor、M3U 或 PLS 文件导入，也可以自己创建。还能查看哪些曲目在文件夹里找不到。音乐列表会显示艺术家，并可按名称、艺术家、格式或路径排序。'
      ]
    }
  },
  {
    date: '2026-10-21',
    title: 'Welcome to the desert',
    notes: [
      'Fantasy Crystals appear half as often: one every four days.',
      'Year 5 is spent in a sun-baked desert. The seasons still change.',
      'Two new desert monsters, tougher than any before: the Sand Crab and the Venom Flayer.',
      'Sand Crab: pinches the first hero. At half health, its Sand Blast hurts everyone and blinds them: their next attack misses.',
      'Venom Flayer: its bite poisons. At 30% health it spits venom that poisons the first three heroes.',
      'Poison drains HP every second. A Rest at the inn cures poison and blindness.'
    ],
    es: {
      title: 'Bienvenidos al desierto',
      notes: [
        'Los Cristales de fantasía aparecen la mitad de veces: uno cada cuatro días.',
        'El Año 5 transcurre en un desierto abrasador. Las estaciones siguen cambiando.',
        'Dos nuevos monstruos del desierto, más duros que ninguno: el Cangrejo de arena y el Desollador venenoso.',
        'Cangrejo de arena: pellizca al primer héroe. Con la mitad de la vida, su Explosión de arena daña a todos y los ciega: su próximo ataque falla.',
        'Desollador venenoso: su mordisco envenena. Con el 30% de la vida escupe veneno que envenena a los tres primeros héroes.',
        'El veneno quita vida cada segundo. Descansar en la posada cura el veneno y la ceguera.'
      ]
    },
    zh: {
      title: '欢迎来到沙漠',
      notes: [
        '幻想水晶出现得少了一半：每四天一个。',
        '第 5 年在烈日炙烤的沙漠中度过，四季依然更替。',
        '两种比以往都更强的沙漠怪物：沙蟹和毒液剥皮蛇。',
        '沙蟹：夹击排头的英雄。生命降到一半时，沙暴会伤害所有人并使其失明：下一次攻击会落空。',
        '毒液剥皮蛇：撕咬会中毒。生命降到 30% 时，会喷出毒液，使前三名英雄中毒。',
        '中毒会每秒损失生命。在旅店休息可以解毒并治愈失明。'
      ]
    }
  },
  {
    date: '2026-10-18',
    title: 'Rarer scrolls, clearer level-ups, a cuter stamp',
    notes: [
      'Scrolls drop less often: about 1 in 5.',
      'The level-up screen shows what your hero will gain: HP, attacks and heals.',
      'The Tavern Stamp is now a cute round wax seal.'
    ],
    es: {
      title: 'Pergaminos más escasos, subidas de nivel más claras, un sello más mono',
      notes: [
        'Los pergaminos caen con menos frecuencia: más o menos 1 de cada 5.',
        'La pantalla de subida de nivel muestra lo que ganará tu héroe: PS, ataques y curaciones.',
        'El sello de taberna ahora es un sello de cera redondo y adorable.'
      ]
    },
    zh: {
      title: '更稀有的卷轴，更清晰的升级，更可爱的印章',
      notes: [
        '卷轴掉落变少了：大约五次一个。',
        '升级界面会显示英雄的成长：HP、攻击和治疗。',
        '酒馆印章变成了可爱的圆形蜡封印。'
      ]
    }
  },
  {
    date: '2026-10-17',
    title: 'New heroes, scrolls and oozy poison',
    notes: [
      'Tavern Stamps: earn one each year. The count sits by your gold.',
      'New Tavern Shop: 10 stamps unlock a hero for good.',
      'Paladin: Shield Wall takes hits for the front hero. Light attacks from behind.',
      'Shadow Knight: scythe up front, Life Drain heals your weakest hero.',
      'Scrolls: monsters can drop them. Paca carries one extra.',
      'Hold the Scroll button for a round menu, sized to your slots.',
      'The Rereviver scroll lets a hero revive once if they faint within a year of use.',
      'The Blue Potion is now the Revive Potion. You start with one.',
      'Healing Potions no longer wake fainted heroes.',
      'The Light Mage\'s heal grows with each level, up to 13 HP.',
      'Basic attacks hit 1 harder with every level.',
      'The Druid\'s poison is a big oozy glob that splats onto monsters.',
      'Windows: the FFXI addon is now loaded with /addon load fantasyradiocompanion.',
      'Windows: a clear title now sits above the Zone / Battle settings.',
      'New: read this journal in Settings, in your language!'
    ],
    es: {
      title: 'Nuevos héroes, pergaminos y veneno viscoso',
      notes: [
        'Sellos de taberna: ganas uno cada año. El total aparece junto a tu oro.',
        'Nueva Tienda de la taberna: 10 sellos desbloquean un héroe para siempre.',
        'Paladín: el Muro de escudos recibe los golpes del héroe de delante. Ataca con luz desde atrás.',
        'Caballero sombrío: guadaña al frente, Drenar vida cura a tu héroe más débil.',
        'Pergaminos: los monstruos pueden soltarlos. Alpaca lleva uno extra.',
        'Mantén el botón de pergaminos para un menú redondo, del tamaño de tus ranuras.',
        'El pergamino de Rerevivir permite a un héroe revivir una vez si se desmaya en el año siguiente a usarlo.',
        'La poción azul ahora es la Poción de reanimación. Empiezas con una.',
        'Las pociones de curación ya no despiertan a los héroes desmayados.',
        'La curación del mago de luz crece con cada nivel, hasta 13 PV.',
        'Los ataques básicos pegan 1 más fuerte con cada nivel.',
        'El veneno del druida es una gran bola viscosa que se estampa en los monstruos.',
        'Windows: el complemento de FFXI ahora se carga con /addon load fantasyradiocompanion.',
        'Windows: un título claro encabeza ahora los ajustes de Zona / Batalla.',
        'Novedad: ¡lee este diario en Ajustes, en tu idioma!'
      ]
    },
    zh: {
      title: '新英雄、卷轴和黏糊糊的毒液',
      notes: [
        '酒馆印章：每年可获得一枚，数量显示在金币旁。',
        '新增酒馆商店：10 枚印章即可永久解锁一名英雄。',
        '圣骑士：盾墙替最前面的英雄承受伤害，在后排用圣光攻击。',
        '暗影骑士：在前排挥舞镰刀，生命汲取治疗最虚弱的英雄。',
        '卷轴：怪物可能掉落。羊驼多携带一个。',
        '长按卷轴按钮，打开与卷轴栏位数相符的圆形菜单。',
        '再复活卷轴：英雄在使用后一年内倒下时，可复活一次。',
        '蓝色药水变成了复活药水，开局自带一瓶。',
        '治疗药水不能再唤醒昏倒的英雄。',
        '光明法师的治疗随等级提升，最高 13 点生命。',
        '普通攻击每升一级伤害 +1。',
        '德鲁伊的毒液变成黏稠的大团软泥，会啪地粘在怪物身上。',
        'Windows：FFXI 插件现在用 /addon load fantasyradiocompanion 加载。',
        'Windows：区域 / 战斗设置上方新增了醒目的标题。',
        '新增：在设置中用你的语言阅读本日志！'
      ]
    }
  },
  {
    date: '2026-10-16',
    title: 'Everyone learns to walk',
    notes: [
      'Every hero and monster now has a walk animation.',
      'The Druid has a new look.',
      'The Old Man shows how to use potions when a hero is hurt.',
      'New Quality setting: Low, Medium, High or Auto.',
      'On the web, a note tells you when the game paused while hidden.',
      'The inn now explains Rest and Reorganize.'
    ],
    es: {
      title: 'Todos aprenden a caminar',
      notes: [
        'Todos los héroes y monstruos tienen ya animación de caminar.',
        'El druida tiene un nuevo aspecto.',
        'El Anciano enseña a usar pociones cuando un héroe está herido.',
        'Nuevo ajuste de calidad: Baja, Media, Alta o Auto.',
        'En la web, un aviso indica cuándo el juego se pausó estando oculto.',
        'La posada ahora explica Descansar y Reorganizar.'
      ]
    },
    zh: {
      title: '大家都学会走路了',
      notes: [
        '所有英雄和怪物都有了走路动画。',
        '德鲁伊换了新造型。',
        '英雄受伤时，老人会教你使用药水。',
        '新增画质设置：低、中、高或自动。',
        '网页版会提示游戏在页面隐藏时已暂停。',
        '旅店现在会说明“休息”和“重新整队”。'
      ]
    }
  },
  {
    date: '2026-10-15',
    title: 'Tougher monsters, stronger heroes',
    notes: [
      'Heroes gain health when they level up.',
      'Monsters have more health.',
      'Year 4 brings three new top monsters.',
      'The Magma Shellra\'s fireball now bursts into flames.',
      'The Fire Mage\'s fireball burns out over long distances.',
      'Clearer level-up screen.',
      'The scene is zoomed out so everyone fits.',
      'Nicer DEFEAT and NEW RECORD lettering.'
    ],
    es: {
      title: 'Monstruos más duros, héroes más fuertes',
      notes: [
        'Los héroes ganan vida al subir de nivel.',
        'Los monstruos tienen más vida.',
        'El Año 4 trae tres monstruos nuevos de alto nivel.',
        'La bola de fuego del Shellra de magma ahora estalla en llamas.',
        'La bola de fuego del mago de fuego se apaga a larga distancia.',
        'Pantalla de subida de nivel más clara.',
        'La escena se aleja un poco para que quepan todos.',
        'Letras más bonitas en DERROTA y NUEVO RÉCORD.'
      ]
    },
    zh: {
      title: '更强的怪物，更强的英雄',
      notes: [
        '英雄升级时会获得生命值。',
        '怪物的生命值更高了。',
        '第 4 年带来三种新的顶级怪物。',
        '熔岩龟壳兽的火球现在会爆燃成火海。',
        '火焰法师的火球飞得太远会熄灭。',
        '升级界面更清晰。',
        '画面稍微拉远，让所有人都能入镜。',
        '“战败”和“新纪录”的字体更好看了。'
      ]
    }
  },
  {
    date: '2026-10-14',
    title: 'A new friend and a new foe',
    notes: [
      'The Druid joins, poisoning monsters with Natural Toxin.',
      'Star Hats come in red (heal) or blue (half damage).',
      'The Compendium has MONSTERS and PARTY tabs.',
      'The Toucan arrives in Year 3.'
    ],
    es: {
      title: 'Un nuevo amigo y un nuevo enemigo',
      notes: [
        'El druida se une y envenena a los monstruos con Toxina natural.',
        'Los sombreros estelares son rojos (curan) o azules (mitad de daño).',
        'El Compendio tiene pestañas de MONSTRUOS y GRUPO.',
        'El Tucán llega en el Año 3.'
      ]
    },
    zh: {
      title: '新朋友与新敌人',
      notes: [
        '德鲁伊加入，用天然毒素毒害怪物。',
        '星星帽分红色（回血）和蓝色（伤害减半）。',
        '图鉴新增“怪物”和“队伍”标签页。',
        '巨嘴鸟在第 3 年登场。'
      ]
    }
  },
  {
    date: '2026-10-13',
    title: 'Tavern days and sharper tools',
    notes: [
      'The Thief fires a crossbow from afar.',
      'Every tavern visit ends at the inn.',
      'The Merchant visits on day 2 of each season.',
      'Monsters hit harder, and so does the Blood Moon.',
      'New DEFEAT / NEW RECORD screen.',
      'Fainted heroes hide their health bar.',
      'Windows: Play with nothing loaded opens the station picker.'
    ],
    es: {
      title: 'Días de taberna y mejores herramientas',
      notes: [
        'El ladrón dispara una ballesta desde lejos.',
        'Cada visita a la taberna termina en la posada.',
        'El mercader visita el día 2 de cada estación.',
        'Los monstruos pegan más fuerte, y la Luna de sangre también.',
        'Nueva pantalla de DERROTA / NUEVO RÉCORD.',
        'Los héroes desmayados ocultan su barra de vida.',
        'Windows: Reproducir sin nada cargado abre el selector de emisoras.'
      ]
    },
    zh: {
      title: '酒馆日与更趁手的工具',
      notes: [
        '盗贼可以用弩远程射击。',
        '每次酒馆之行都以旅店收尾。',
        '商人在每个季节的第 2 天来访。',
        '怪物打得更狠，血月也是。',
        '全新的“战败 / 新纪录”界面。',
        '昏倒的英雄不再显示生命条。',
        'Windows：未加载任何内容时点播放，会打开电台选择器。'
      ]
    }
  },
  {
    date: '2026-10-12',
    title: 'A big day: items, health and radio',
    notes: [
      'Heroes have health, and fainted ones ride in a cart.',
      'Meet the Merchant and Healing Potion I.',
      'Adventures start at a campfire with two heroes to pick.',
      'Year 2 brings tougher monster variants.',
      'Paca is now a tan llama with a blanket.',
      'Switching stations now fades smoothly.',
      'Add your own station by link, and SUPPORT links for stations.',
      'Separate music and effects volume.',
      'Tabs: Adventure, Radio, Local Music.',
      'Windows: Zone / Battle stations switch automatically.'
    ],
    es: {
      title: 'Un gran día: objetos, vida y radio',
      notes: [
        'Los héroes tienen vida, y los desmayados viajan en una carreta.',
        'Conoce al mercader y la Poción de curación I.',
        'Las aventuras empiezan en una hoguera con dos héroes para elegir.',
        'El Año 2 trae variantes de monstruos más duras.',
        'Alpaca ahora es una llama canela con manta.',
        'Cambiar de emisora ahora se funde suavemente.',
        'Añade tu propia emisora con un enlace, y enlaces de APOYAR para las emisoras.',
        'Volumen separado para música y efectos.',
        'Pestañas: Aventura, Radio, Música local.',
        'Windows: las emisoras de Zona / Batalla cambian solas.'
      ]
    },
    zh: {
      title: '大日子：道具、生命值和电台',
      notes: [
        '英雄有了生命值，昏倒的英雄会坐上拉车。',
        '认识商人和治疗药水 I。',
        '冒险从营火开始，可从两名英雄中选择。',
        '第 2 年带来更强的怪物变种。',
        '羊驼变成了披着毯子的棕黄色羊驼。',
        '切换电台时会平滑淡入淡出。',
        '可通过链接添加自己的电台，电台还有“支持”链接。',
        '音乐和音效音量分开调节。',
        '标签页：冒险、电台、本地音乐。',
        'Windows：区域 / 战斗电台自动切换。'
      ]
    }
  },
  {
    date: '2026-10-11',
    title: 'Hello, Fantasy Radio Companion',
    notes: [
      'New name: Fantasy Radio Companion!',
      'The adventure game arrived: monsters, class traits, tuner, full screen.',
      'The Merchant opened his shop.',
      'A web version you can add to your phone.',
      'Spanish and Simplified Chinese added.',
      'A settings cog with Restart.'
    ],
    es: {
      title: 'Hola, Fantasy Radio Companion',
      notes: [
        '¡Nuevo nombre: Fantasy Radio Companion!',
        'Llegó el juego de aventuras: monstruos, rasgos de clase, sintonizador y pantalla completa.',
        'El mercader abrió su tienda.',
        'Una versión web que puedes añadir a tu teléfono.',
        'Añadidos el español y el chino simplificado.',
        'Un engranaje de ajustes con Reiniciar.'
      ]
    },
    zh: {
      title: '你好，Fantasy Radio Companion',
      notes: [
        '全新名字：Fantasy Radio Companion！',
        '冒险游戏登场：怪物、职业特性、调谐器和全屏模式。',
        '商人开张了。',
        '网页版上线，可添加到手机。',
        '新增西班牙语和简体中文。',
        '设置齿轮，内含“重新开始”。'
      ]
    }
  },
  {
    date: '2026-10-09',
    title: 'The very first beta',
    notes: [
      'First beta, with Folk Alley and DNBRadio.'
    ],
    es: {
      title: 'La primerísima beta',
      notes: [
        'Primera beta, con Folk Alley y DNBRadio.'
      ]
    },
    zh: {
      title: '第一个测试版',
      notes: [
        '首个测试版，内含 Folk Alley 和 DNBRadio。'
      ]
    }
  }
];
