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

// Egyetlen HTTP szerver, ami a weboldalt és a socket.io-t is kiszolgálja
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
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

// Socket.io csatlakoztatása UGYANAHHOZ a szerverhez
const io = new Server(server);

// A szerver indítása
server.listen(PORT, () => {
  console.log(`HTTP szerver fut a ${PORT} porton`);
});

// Bot események
bot.once('spawn', () => console.log('Bot csatlakozott a szerverhez!'));
bot.on('chat', (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`);
});
bot.on('message', (jsonMsg) => {
  console.log(`[MSG] ${jsonMsg.toString()}`);
});
bot.on('error', (err) => console.log('Hiba:', err));
bot.on('kicked', (reason) => console.log('Kirúgva:', reason));
bot.on('end', () => console.log('Bot lecsatlakozott a szerverről.'));

// WebSocket kapcsolat kezelése
io.on('connection', (socket) => {
  console.log('Weboldal csatlakozott');
  
  socket.on('chat', (uzenet) => {
    bot.chat(uzenet);
    console.log(`[WEB] ${uzenet}`);
  });
});
