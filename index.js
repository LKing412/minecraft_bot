const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { SocksClient } = require('socks');

// ===== PROXY BEÁLLÍTÁSOK =====
// Töltsd ki az IPRoyal vezérlőpultján kapott adatokkal!
const PROXY = {
  enabled: true,                 // true → proxy használata
  host: '199.102.45.168',       // IPRoyal ISP proxy host (ellenőrizd a dashboardon!)
  port: 9002,                   // IPRoyal ISP proxy SOCKS5 port (ellenőrizd!)
  type: 5,                       // 5 = SOCKS5 (az ISP proxy általában SOCKS5-öt is támogat)
  userId: '8s3xagr0',// IPRoyal felhasználónév
  password: 'nMsCyokfDFBi'       // IPRoyal jelszó
};
// =============================

// Minecraft szerver adatai
const MC_HOST = 'Mate1019.aternos.me';
const MC_PORT = 19275;

// Proxy kapcsolat létrehozása és a bot indítása
function createBotWithProxy() {
  if (!PROXY.enabled) {
    console.log('[PROXY] Kikapcsolva, közvetlen kapcsolódás...');
    return mineflayer.createBot({
      host: MC_HOST,
      port: MC_PORT,
      username: 'cipopucolo112',
      auth: 'offline',
      version: '1.21.9',
      viewDistance: 2
    });
  }

  console.log(`[PROXY] Használat: ${PROXY.host}:${PROXY.port} (SOCKS${PROXY.type})`);

  return mineflayer.createBot({
    username: 'cipopucolo112',
    auth: 'offline',
    version: '1.21.9',
    viewDistance: 2,
    // A mineflayer a connect visszahíváson keresztül várja a socketet
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
        destination: {
          host: MC_HOST,
          port: MC_PORT
        }
      })
        .then(({ socket }) => {
          console.log('[PROXY] SOCKS kapcsolat létrejött, socket átadása a botnak.');
          client.setSocket(socket);
          client.emit('connect');
        })
        .catch((err) => {
          console.error('[PROXY] Hiba a SOCKS kapcsolat létrehozásakor:', err.message);
          // A bot így nem tud csatlakozni, de legalább nem néma a hiba
        });
    }
  });
}

const bot = createBotWithProxy();

// HTTP szerver
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
  console.log(
    `Proxy: ${
      PROXY.enabled
        ? PROXY.host + ':' + PROXY.port + ' (SOCKS' + PROXY.type + ')'
        : 'kikapcsolva'
    }`
  );
});

// ===== Bot események =====
bot.once('spawn', () => console.log('[BOT] Csatlakozott a szerverhez!'));
bot.on('error', (err) => console.log('[BOT HIBA]', err.message || err));
bot.on('kicked', (reason) => {
  let szoveg = reason;
  try {
    szoveg = typeof reason === 'string' ? reason : JSON.stringify(reason);
  } catch (e) {
    /* ignore */
  }
  console.log('[BOT KICK]', szoveg);
});
bot.on('end', (reason) => console.log('[BOT] Lecsatlakozott. Ok:', reason));

bot.on('end', (reason) => {
  console.log('[BOT] Lecsatlakozott. Ok:', reason);
  // Újracsatlakozás 10 másodperc múlva
  setTimeout(() => {
    console.log('[BOT] Újracsatlakozás...');
    createBotWithProxy();
  }, 10000);
});

bot.on('chat', (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`);
  if (username !== bot.username) {
    io.emit('bot-uzenet', `${username}: ${message}`);
  }
});

bot.on('message', (jsonMsg) => {
  // Csak akkor naplózzuk, ha a bot már spawnolt (különben sok "Connecting..." üzenet jön)
  if (bot.entity) {
    console.log(`[MSG] ${jsonMsg.toString()}`);
  }
});

// ===== Socket.io események =====
io.on('connection', (socket) => {
  console.log('[WEB] Weboldal csatlakozott');

  socket.on('chat', (uzenet) => {
    if (typeof uzenet !== 'string' || !uzenet.trim()) return;
    bot.chat(uzenet);
    console.log(`[WEB-CHAT] ${uzenet}`);
  });

  socket.on('move', (irany) => {
    if (['forward', 'back', 'left', 'right', 'jump'].includes(irany)) {
      bot.setControlState(irany, true);
      console.log(`[WEB-MOVE] ${irany}`);
    }
  });

  socket.on('stop', () => {
    ['forward', 'back', 'left', 'right', 'jump'].forEach((irany) => {
      bot.setControlState(irany, false);
    });
    console.log('[WEB-MOVE] stop');
  });

  socket.on('info', () => {
    if (!bot.entity || !bot.game) {
      socket.emit('bot-info', { hiba: 'A bot még nem csatlakozott teljesen' });
      return;
    }

    const pos = bot.entity.position;
    const adatok = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch,
      health: bot.health,
      food: bot.food,
      gameMode: bot.game.gameMode,
      dimension: bot.game.dimension,
      time: bot.time ? bot.time.timeOfDay : null,
      rain: bot.isRaining,
      thunder: bot.thunderState > 0
    };

    console.log('[INFO]', adatok);
    socket.emit('bot-info', adatok);
  });

  socket.on('disconnect', () => {
    console.log('[WEB] Weboldal lecsatlakozott');
  });
});
