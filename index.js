const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { SocksClient } = require('socks');
const dns = require('dns');

// ===== PROXY BEÁLLÍTÁSOK =====
const PROXY = {
  enabled: true,
  host: '199.102.45.168',
  port: 9002,
  type: 5,
  userId: '8s3xagr0',
  password: 'nMsCyokfDFBi'
};
// =============================

// Minecraft szerver adatai
const MC_HOST = 'Mate1019.aternos.me';
const MC_PORT = 19275;

// SRV rekord feloldása
function resolveSRV(host) {
  return new Promise((resolve) => {
    dns.resolveSrv(`_minecraft._tcp.${host}`, (err, records) => {
      if (err || !records || records.length === 0) {
        console.log('[DNS] Nincs SRV rekord, a megadott host/port használata.');
        resolve({ host, port: MC_PORT });
      } else {
        const record = records[0];
        console.log(`[DNS] SRV rekord megtalálva: ${record.name}:${record.port}`);
        resolve({ host: record.name, port: record.port });
      }
    });
  });
}

let bot = null;

async function createBotWithProxy() {
  // SRV rekord feloldása
  const target = await resolveSRV(MC_HOST);
  console.log(`[BOT] Cél: ${target.host}:${target.port}`);

  if (!PROXY.enabled) {
    console.log('[PROXY] Kikapcsolva, közvetlen kapcsolódás...');
    return mineflayer.createBot({
      host: target.host,
      port: target.port,
      username: 'cipopucolo112',
      auth: 'offline',
      version: '1.21.4',
      viewDistance: 2,
      fakeHost: MC_HOST
    });
  }

  console.log(`[PROXY] Használat: ${PROXY.host}:${PROXY.port} (SOCKS${PROXY.type})`);

  return mineflayer.createBot({
    username: 'cipopucolo112',
    auth: 'offline',
    version: '1.21.4',
    viewDistance: 2,
    fakeHost: MC_HOST,  // <-- fontos: a szerver a helyes hostnevet lássa
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
          host: target.host,  // <-- SRV által feloldott valódi host
          port: target.port    // <-- SRV által feloldott valódi port
        }
      })
        .then(({ socket }) => {
          console.log('[PROXY] SOCKS kapcsolat létrejött, socket átadása a botnak.');
          client.setSocket(socket);
          client.emit('connect');
        })
        .catch((err) => {
          console.error('[PROXY] Hiba a SOCKS kapcsolat létrehozásakor:', err.message);
        });
    }
  });
}

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

// ===== Bot indítás és események =====
async function startBot() {
  try {
    bot = await createBotWithProxy();
  } catch (err) {
    console.error('[BOT] Indítási hiba:', err.message);
    setTimeout(startBot, 10000);
    return;
  }

  bot.once('spawn', () => console.log('[BOT] Csatlakozott a szerverhez!'));

  bot.on('error', (err) => console.log('[BOT HIBA]', err.message || err));

  bot.on('kicked', (reason) => {
    let szoveg = reason;
    try {
      szoveg = typeof reason === 'string' ? reason : JSON.stringify(reason);
    } catch (e) { /* ignore */ }
    console.log('[BOT KICK]', szoveg);
  });

  bot.on('end', (reason) => {
    console.log('[BOT] Lecsatlakozott. Ok:', reason);
    setTimeout(() => {
      console.log('[BOT] Újracsatlakozás...');
      startBot();
    }, 10000);
  });

  bot.on('chat', (username, message) => {
    console.log(`[CHAT] ${username}: ${message}`);
    if (username !== bot.username) {
      io.emit('bot-uzenet', `${username}: ${message}`);
    }
  });

  bot.on('message', (jsonMsg) => {
    if (bot.entity) {
      console.log(`[MSG] ${jsonMsg.toString()}`);
    }
  });
}

startBot();

// ===== Socket.io események =====
io.on('connection', (socket) => {
  console.log('[WEB] Weboldal csatlakozott');

  socket.on('chat', (uzenet) => {
    if (typeof uzenet !== 'string' || !uzenet.trim()) return;
    if (bot) bot.chat(uzenet);
    console.log(`[WEB-CHAT] ${uzenet}`);
  });

  socket.on('move', (irany) => {
    if (!bot) return;
    if (['forward', 'back', 'left', 'right', 'jump'].includes(irany)) {
      bot.setControlState(irany, true);
      console.log(`[WEB-MOVE] ${irany}`);
    }
  });

  socket.on('stop', () => {
    if (!bot) return;
    ['forward', 'back', 'left', 'right', 'jump'].forEach((irany) => {
      bot.setControlState(irany, false);
    });
    console.log('[WEB-MOVE] stop');
  });

  socket.on('info', () => {
    if (!bot || !bot.entity || !bot.game) {
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
