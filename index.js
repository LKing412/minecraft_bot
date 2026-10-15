const mineflayer = require('mineflayer');
const http = require('http');

const bot = mineflayer.createBot({
  host: 'Mate1019.aternos.me:19275', //
  port: 25565,
  username: 'BotNev',
  auth: 'offline',
  version: '1.21.9'
});

// Egy egyszerű web szerver, hogy a Railway lássa, hogy fut a program
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot fut');
}).listen(PORT, () => {
  console.log(`HTTP szerver fut a ${PORT} porton`);
});

bot.once('spawn', () => console.log('Bot csatlakozott a szerverhez!'));
bot.on('error', (err) => console.log('Hiba:', err));
bot.on('kicked', (reason) => console.log('Kirúgva:', reason));
