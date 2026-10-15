const mineflayer = require('mineflayer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Hiba');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    res.writeHead(200);
    res.end('Bot fut');
  }
});

const bot = mineflayer.createBot({
  host: 'Mate1019.aternos.me',
  port: 19275,
  username: 'cipopucolo112',
  auth: 'offline',
  version: '1.21.9'
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot fut');
}).listen(PORT, () => {
  console.log(`HTTP szerver fut a ${PORT} porton`);
});

// Csatlakozás
bot.once('spawn', () => console.log('Bot csatlakozott a szerverhez!'));

// Minden bejövő chat üzenet naplózása
bot.on('chat', (username, message) => {
  console.log(`[CHAT] ${username}: ${message}`);
});

// WebSocket kapcsolat kezelése
io.on('connection', (socket) => {
  console.log('Weboldal csatlakozott');
  
  socket.on('chat', (uzenet) => {
    bot.chat(uzenet);
    console.log(`[WEB] ${uzenet}`);
  });
});

// Minden rendszerüzenet (pl. csatlakozás, kilépés)
bot.on('message', (jsonMsg) => {
  console.log(`[MSG] ${jsonMsg.toString()}`);
});

// Hibák
bot.on('error', (err) => console.log('Hiba:', err));
bot.on('kicked', (reason) => console.log('Kirúgva:', reason));
bot.on('end', () => console.log('Bot lecsatlakozott a szerverről.'));
