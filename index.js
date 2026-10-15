const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { SocksClient } = require('socks');

// ===== PROXY BEÁLLÍTÁSOK =====
const PROXY = {
  enabled: true,
  host: '66.11.124.160',
  port: 9002,
  type: 5,
  userId: 'mvmxtlu1',
  password: 'XJ2QCtP7jwwJ'
};
// =============================

const MC_HOST = 'Mate1019.aternos.me';
const MC_PORT = 19275;

function createBotWithProxy() {
  if (!PROXY.enabled) {
    console.log('[PROXY] Kikapcsolva, közvetlen kapcsolódás...');
    return mineflayer.createBot({
      host: MC_HOST,
      port: MC_PORT,
      username: 'cipopucolo112',
      auth: 'offline',
      version: '1.21.4',
      viewDistance: 2
    });
  }

  console.log(`[PROXY] Használat: ${PROXY.host}:${PROXY.port} (SOCKS${PROXY.type})`);

  return mineflayer.createBot({
    username: 'cipopucolo112',
    auth: 'offline',
    version: '1.21.4',
    viewDistance: 2,
    connect: (client) => {
      SocksClient.createConnection({
        proxy: {
          host: PROXY.host,
          port: PROXY.port,
          type: PROXY.type,
          userId: PROXY.userId,
          password: PROXY.password
        },
        command: 'connect',
        destination: { host: MC_HOST, port: MC_PORT }
      })
        .then(({ socket }) => {
          console.log('[PROXY] SOCKS kapcsolat létrejött.');
          client.setSocket(socket);
          client.emit('connect');
        })
        .catch((err) => {
          console.error('[PROXY] Hiba:', err.message);
        });
    }
  });
}

const bot = createBotWithProxy();

// ===== HTTP szerver =====
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Hiba a weboldal betöltésekor');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot fut');
  }
});

const io = new Server(server);

server.listen(PORT, () => {
  console.log(`HTTP szerver fut a ${PORT} porton`);
});

// ===== Segédfüggvények =====

// 8 irány yaw értékei (Minecraft: -PI..PI, 0 = dél)
function iranyYaw(irany) {
  const PI = Math.PI;
  const terkep = {
    'south': 0,
    'south-west': PI / 4,
    'west': PI / 2,
    'north-west': 3 * PI / 4,
    'north': PI,
    'north-east': -3 * PI / 4,
    'east': -PI / 2,
    'south-east': -PI / 4
  };
  return terkep[irany];
}

async function simaForgas(celYaw) {
  // Fokozatos forgatás, hogy ne ugorjon
  const lepesek = 10;
  const kezdo = bot.entity.yaw;
  let kulonbseg = celYaw - kezdo;
  // Normalizálás -PI..PI
  while (kulonbseg > Math.PI) kulonbseg -= 2 * Math.PI;
  while (kulonbseg < -Math.PI) kulonbseg += 2 * Math.PI;

  for (let i = 1; i <= lepesek; i++) {
    await bot.look(kezdo + (kulonbseg * i) / lepesek, bot.entity.pitch, false);
    await new Promise(r => setTimeout(r, 20));
  }
}

// ===== Bot események =====
bot.once('spawn', () => {
  console.log('[BOT] Csatlakozott a szerverhez!');
  io.emit('bot-spawn', { uzenet: 'Bot megjelent a szerveren!' });
  // Kezdeti állapot küldése
  setTimeout(kuldStatusz, 1000);
});

bot.on('error', (err) => {
  console.log('[BOT HIBA]', err.message || err);
  io.emit('bot-hiba', { uzenet: err.message || String(err) });
});

bot.on('kicked', (reason) => {
  let szoveg = reason;
  try { szoveg = typeof reason === 'string' ? reason : JSON.stringify(reason); } catch (e) {}
  console.log('[BOT KICK]', szoveg);
  io.emit('bot-kick', { uzenet: szoveg });
});

bot.on('end', (reason) => {
  console.log('[BOT] Lecsatlakozott. Ok:', reason);
  io.emit('bot-kick', { uzenet: 'Lecsatlakozott: ' + reason });
});

// Chat
bot.on('chat', (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`);
  if (username !== bot.username) {
    io.emit('bot-chat', { username, message });
  }
});

// Egyéb üzenetek (rendszer)
bot.on('message', (jsonMsg) => {
  if (bot.entity) {
    const sz = jsonMsg.toString();
    console.log(`[MSG] ${sz}`);
    io.emit('bot-uzenet', sz);
  }
});

// ===== HALÁL DETEKTÁLÁS =====
bot.on('death', () => {
  const uzenet = `A bot meghalt! Pozíció: ${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.y.toFixed(1)}, ${bot.entity.position.z.toFixed(1)}`;
  console.log('[HALÁL]', uzenet);
  io.emit('bot-halal', { uzenet });
});

// Élet / éhség változás
bot.on('health', () => {
  io.emit('bot-health', { health: bot.health, food: bot.food });
});

// ===== Rendszeres státusz küldés =====
function kuldStatusz() {
  if (!bot.entity || !bot.game) return;
  const p = bot.entity.position;
  io.emit('bot-statusz', {
    x: p.x, y: p.y, z: p.z,
    gameMode: bot.game.gameMode
  });
}
setInterval(kuldStatusz, 2000);

// ===== Socket.io =====
io.on('connection', (socket) => {
  console.log('[WEB] Weboldal csatlakozott');
  kuldStatusz();

  socket.on('chat', (uzenet) => {
    if (typeof uzenet !== 'string' || !uzenet.trim()) return;
    bot.chat(uzenet);
    console.log(`[WEB-CHAT] ${uzenet}`);
  });

  socket.on('move', (irany) => {
    if (['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].includes(irany)) {
      bot.setControlState(irany, true);
      console.log(`[WEB-MOVE] ${irany}`);
    }
  });

  socket.on('stop', () => {
    ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].forEach((irany) => {
      bot.setControlState(irany, false);
    });
    console.log('[WEB-MOVE] stop');
  });

  // ===== FORGÁS =====
  socket.on('rotate', async (irany) => {
    if (!bot.entity) return;
    try {
      if (irany === 'reset') {
        await simaForgas(0);
      } else if (irany === 'up') {
        await bot.look(bot.entity.yaw, Math.max(-Math.PI / 2, bot.entity.pitch - Math.PI / 4), false);
      } else if (irany === 'down') {
        await bot.look(bot.entity.yaw, Math.min(Math.PI / 2, bot.entity.pitch + Math.PI / 4), false);
      } else if (irany === 'pitch-reset') {
        await bot.look(bot.entity.yaw, 0, false);
      } else {
        const cel = iranyYaw(irany);
        if (cel !== undefined) await simaForgas(cel);
      }
      console.log(`[WEB-ROTATE] ${irany}`);
    } catch (e) {
      console.error('[ROTATE HIBA]', e.message);
    }
  });

  // ===== AKCIÓK =====
  socket.on('action', async (tipus) => {
    if (!bot.entity) return;
    try {
      switch (tipus) {
        case 'attack': {
          const entitas = bot.nearestEntity();
          if (entitas) {
            await bot.attack(entitas);
            io.emit('bot-uzenet', `Ütés: ${entitas.name || entitas.type}`);
          } else {
            io.emit('bot-uzenet', 'Nincs célpont az ütéshez');
          }
          break;
        }
        case 'use':
          bot.activateItem();
          io.emit('bot-uzenet', 'Használat (jobb klikk)');
          break;
        case 'jump-attack': {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 300);
          const e2 = bot.nearestEntity();
          if (e2) await bot.attack(e2);
          io.emit('bot-uzenet', 'Ugrás + ütés');
          break;
        }
        case 'drop':
          await bot.tossStack(bot.inventory.slots[bot.quickBarSlot + 36]);
          io.emit('bot-uzenet', 'Tárgy eldobva');
          break;
        case 'swap':
          // Kézcsere - a bal kézbe veszi / elcseréli
          bot.activateItem(true);
          io.emit('bot-uzenet', 'Kézcsere / offhand használat');
          break;
      }
      console.log(`[WEB-ACTION] ${tipus}`);
    } catch (e) {
      console.error('[ACTION HIBA]', e.message);
      io.emit('bot-hiba', { uzenet: 'Akció hiba: ' + e.message });
    }
  });

  // ===== SLOT VÁLTÁS =====
  socket.on('slot', (n) => {
    if (typeof n !== 'number' || n < 0 || n > 8) return;
    bot.setQuickBarSlot(n);
    console.log(`[WEB-SLOT] ${n + 1}`);
  });

  // ===== INFO Lekérdezések =====
  socket.on('info', (tipus) => {
    if (!bot.entity || !bot.game) {
      socket.emit('bot-info', { hiba: 'A bot még nem csatlakozott teljesen' });
      return;
    }

    if (tipus === 'inventory') {
      const slotok = [];
      bot.inventory.slots.forEach((item, i) => {
        if (item && i >= 36 && i <= 44) {
          slotok.push({ slot: i - 35, nev: item.name, db: item.count });
        }
      });
      socket.emit('bot-info', {
        tipus: 'inventory',
        slotok,
        aktivSlot: bot.quickBarSlot
      });
      return;
    }

    if (tipus === 'players') {
      const jatekosok = Object.keys(bot.players);
      socket.emit('bot-info', { tipus: 'players', jatekosok });
      return;
    }

    if (tipus === 'entities') {
      const sajat = bot.entity.position;
      const entitasok = Object.values(bot.entities)
        .filter(e => e !== bot.entity && e.position)
        .map(e => {
          const t = e.position.distanceTo(sajat);
          return {
            nev: e.name || e.username || e.type || 'ismeretlen',
            tavolsag: t.toFixed(1),
            x: e.position.x.toFixed(0),
            y: e.position.y.toFixed(0),
            z: e.position.z.toFixed(0)
          };
        })
        .filter(e => e.tavolsag < 30)
        .sort((a, b) => a.tavolsag - b.tavolsag)
        .slice(0, 20);
      socket.emit('bot-info', { tipus: 'entities', entitasok });
      return;
    }

    // world
    const pos = bot.entity.position;
    const adatok = {
      x: pos.x, y: pos.y, z: pos.z,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch,
      health: bot.health,
      food: bot.food,
      gameMode: bot.game.gameMode,
      dimension: bot.game.dimension,
      time: bot.time ? bot.time.timeOfDay : null,
      rain: bot.isRaining,
      thunder: bot.thunderState > 0,
      xpLevel: bot.experience ? bot.experience.level : 0,
      aktivSlot: bot.quickBarSlot
    };
    console.log('[INFO]', adatok);
    socket.emit('bot-info', adatok);
  });

  socket.on('disconnect', () => {
    console.log('[WEB] Weboldal lecsatlakozott');
  });
});
