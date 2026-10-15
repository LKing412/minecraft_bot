const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

// Minecraft bot létrehozása
const bot = mineflayer.createBot({
  host: 'Mate1019.aternos.me',
  port: 19275,
  username: 'cipopucolo112',
  auth: 'offline',
  version: '1.21.9'
});

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

// Socket.io
const io = new Server(server);

server.listen(PORT, () => {
  console.log(`HTTP szerver fut a ${PORT} porton`);
});

// Bot események
bot.once('spawn', () => console.log('Bot csatlakozott a szerverhez!'));
bot.on('error', (err) => console.log('Hiba:', err));
bot.on('kicked', (reason) => console.log('Kirúgva:', reason));
bot.on('end', () => console.log('Bot lecsatlakozott a szerverről.'));

// Chat üzenetek figyelése
bot.on('chat', (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`);
  if (username !== bot.username) {
    io.emit('bot-uzenet', `${username}: ${message}`);
  }
});

// Rendszerüzenetek figyelése
bot.on('message', (jsonMsg) => {
  const szoveg = jsonMsg.toString();
  console.log(`[MSG] ${szoveg}`);
});

// WebSocket kapcsolat
io.on('connection', (socket) => {
  console.log('Weboldal csatlakozott');

  // Chat üzenet küldése
  socket.on('chat', (uzenet) => {
    bot.chat(uzenet);
    console.log(`[WEB-CHAT] ${uzenet}`);
  });

  // Mozgatás
  socket.on('move', (irany) => {
    if (['forward', 'back', 'left', 'right', 'jump'].includes(irany)) {
      bot.setControlState(irany, true);
      console.log(`[WEB-MOVE] ${irany}`);
    }
  });

  // Mozgatás leállítása
  socket.on('stop', () => {
    ['forward', 'back', 'left', 'right', 'jump'].forEach((irany) => {
      bot.setControlState(irany, false);
    });
    console.log('[WEB-MOVE] stop');
  });

  // Pozíció és világ adatok lekérése
  socket.on('info', () => {
    if (!bot.entity) {
      socket.emit('bot-info', { hiba: 'A bot még nem csatlakozott' });
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
      time: bot.time.timeOfDay,
      rain: bot.isRaining,
      thunder: bot.thunderState > 0
    };

    console.log('[INFO]', adatok);
    socket.emit('bot-info', adatok);
  });
});
