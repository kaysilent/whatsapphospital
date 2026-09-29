// Universal Hostinger / cPanel / Passenger Node.js Entry Point
// Pre-configured for Hostinger Node.js Application Manager, Standalone Engine & LiteSpeed

const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');

// 1. Monkey-patch net.Server & http.Server close methods to prevent ERR_SERVER_NOT_RUNNING
// during Hostinger/Passenger process recycles, health probes, and signal handling
function patchServerClose(ServerClass) {
  const originalClose = ServerClass.prototype.close;
  ServerClass.prototype.close = function (cb) {
    if (!this._handle && !this.listening) {
      if (typeof cb === 'function') {
        process.nextTick(() => cb(null));
      }
      return this;
    }
    try {
      return originalClose.call(this, (err) => {
        if (err && (err.code === 'ERR_SERVER_NOT_RUNNING' || (err.message && err.message.includes('not running')))) {
          if (typeof cb === 'function') cb(null);
          return;
        }
        if (typeof cb === 'function') cb(err);
      });
    } catch (err) {
      if (err && (err.code === 'ERR_SERVER_NOT_RUNNING' || (err.message && err.message.includes('not running')) || (err.message && err.message.includes('Server is not running')))) {
        if (typeof cb === 'function') {
          process.nextTick(() => cb(null));
        }
        return this;
      }
      throw err;
    }
  };
}

patchServerClose(net.Server);
patchServerClose(http.Server);

// 2. Catch uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ERR_SERVER_NOT_RUNNING' || (err.message && err.message.includes('not running')) || (err.message && err.message.includes('Server is not running')))) {
    // Expected during process recycling or graceful shutdown in Hostinger Passenger
    return;
  }
  console.error('[Hostinger Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Hostinger Server] Unhandled Rejection:', reason);
});

// 3. Port & Hostname determination
// In Hostinger Passenger, PORT can be a numeric string, 'passenger', or a Unix socket path (/tmp/passenger...)
let rawPort = process.env.PORT;
let listenTarget;

if (!rawPort) {
  listenTarget = 3000;
  process.env.PORT = '3000';
} else if (/^\d+$/.test(rawPort.trim())) {
  listenTarget = parseInt(rawPort.trim(), 10);
  process.env.PORT = listenTarget.toString();
} else {
  // Named pipe, 'passenger', or unix domain socket
  listenTarget = rawPort.trim();
  process.env.PORT = listenTarget;
}

const hostname = process.env.HOSTNAME || '0.0.0.0';
process.env.HOSTNAME = hostname;
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log(`[Hostinger Server] Initializing WhatsApp Hospital CRM on target: ${listenTarget}...`);

const { parse } = require('url');
const next = require('next');

const app = next({ 
  dev: false, 
  hostname: typeof listenTarget === 'number' ? hostname : undefined, 
  port: typeof listenTarget === 'number' ? listenTarget : 3000, 
  dir: __dirname 
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  if (typeof listenTarget === 'number') {
    server.listen(listenTarget, hostname, () => {
      console.log(`[Hostinger Server] ✅ Ready on http://${hostname}:${listenTarget}`);
    });
  } else {
    server.listen(listenTarget, () => {
      console.log(`[Hostinger Server] ✅ Ready on socket/target: ${listenTarget}`);
    });
  }
}).catch((err) => {
  console.error('[Hostinger Server] Error during Next.js app preparation:', err);
});
