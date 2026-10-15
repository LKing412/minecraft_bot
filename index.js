const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { SocksClient } = require('socks');

// ===== PROXY BEÁLLÍTÁSOK =====
const PROXY = {
  enabled: false,              // false → proxy kikapcsolása
  host: '49.13.22.249',          // SOCKS proxy címe
  port: 10802,                 // SOCKS proxy portja (pl. 1080, 9050 Tor)
  type: 5,                    // 4 vagy 5 (SOCKS4 / SOCKS5)
  userId: undefined,          // SOCKS5 esetén ha kell
  password: undefined         // SOCKS5 esetén ha kell
};
// =============================

// Minecraft szerver adatai
const MC_HOST = 'Mate1019.aternos.me';
const MC_PORT = 19275;

// Proxy kapcsolat létrehozása és a bot indítása
function createBotWithProxy() {
  if (!PROXY.enabled) {
    // Proxy nélkül
    return mineflayer.createBot({
      host: MC_HOST,
      port: MC_PORT,
      username: 'cipopucolo112',
      auth: 'offline',
      version: '1.21.9',
      viewDistance: 2
    });
  }

  // Proxy-val: először létrehozzuk a SOCKS kapcsolatot a Minecraft szerver felé
  const socketPromise = SocksClient.createConnection({
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
  });

  return mineflayer.createBot({
    username: 'cipopucolo112',
    auth: 'offline',
    version: '1.21.9',
    // A mineflayer átveszi ezt a socketet a proxy-n keresztül
    connect: () => socketPromise.then(({ socket }) => socket)
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
    res.writeHead(200);
    res.end('Bot fut');
  }
});

const io = new Server(server);

server.listen(PORT, () => {
  console.log(`HTTP szerver fut a ${PORT} porton`);
  console.log(`Proxy: ${PROXY.enabled ? PROXY.host + ':' + PROXY.port + ' (SOCKS' + PROXY.type + ')' : 'kikapcsolva'}`);
});

// Bot események
bot.once('spawn', () => console.log('Bot csatlakozott a szerverhez!'));
bot.on('error', (err) => console.log('Hiba:', err));
bot.on('kicked', (reason) => console.log('Kirúgva:', reason));
bot.on('end', () => console.log('Bot lecsatlakozott a szerverről.'));

bot.on('chat', (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`);
  if (username !== bot.username) {
    io.emit('bot-uzenet', `${username}: ${message}`);
  }
});

bot.on('message', (jsonMsg) => {
  console.log(`[MSG] ${jsonMsg.toString()}`);
});

io.on('connection', (socket) => {
  console.log('Weboldal csatlakozott');

  socket.on('chat', (uzenet) => {
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
    if (!bot.entity) {
      socket.emit('bot-info', { hiba: 'A bot még nem csatlakozott' });
      return;
    }

    const pos = bot.entity.position;
    const adatok = {
      x: pos.x, y: pos.y, z: pos.z,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch,
      health: bot.health,
      food: bot.food,
      gameMode: bot.game.gameMode,
      dimension: bot.game.dimension,
      time: bot.time.timeOfDay,
      rain: bot.isRaining,
      thunder: bot.thunderState > 0
    };

    console.log('[INFO]', adatok);
    socket.emit('bot-info', adatok);
  });
});
