// Receives the dashboard's diagnostic log from the TV and appends it to tv-log.jsonl.
// Run on the home PC (192.168.1.26): node tools/log-server.js
// The TV keeps its events until this is reachable, so it can be started at any time.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8914;
const OUT = process.argv[2] || path.join(__dirname, 'tv-log.jsonl');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST' || req.url !== '/log') { res.writeHead(404); return res.end(); }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    try {
      const list = JSON.parse(body);
      const lines = list.map((e) => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(OUT, lines);
      list.forEach((e) => console.log(e.t, e.ev, JSON.stringify(e.d === undefined ? '' : e.d).slice(0, 300)));
      res.writeHead(200);
      res.end('ok');
    } catch (err) {
      res.writeHead(400);
      res.end(String(err));
    }
  });
}).listen(PORT, () => console.log('listening on ' + PORT + ', writing ' + OUT));
