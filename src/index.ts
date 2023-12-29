import './preStart'; // Must be the first import
import app from '@server';
import Http from 'http';
import { Pool } from 'pg';
import { Server as SocketIOServer, Socket } from 'socket.io';
import Orchestrator from './types/Orchestrator';

const port = Number(process.env.PORT || 3001);
const pool = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: {
        rejectUnauthorized: false
    }
});

const http = Http.createServer(app);
const ioServer = new SocketIOServer(http);
const orchestrator = new Orchestrator(pool);

// TODO handle disconnections
ioServer.on('connection', function (socket: Socket) {
    console.log("THERE WAS A CONNECTION");
    orchestrator.newConnection(socket);
});

ioServer.listen(http, { cors: { origin: 'http://localhost:3000' } })

http.listen(port, () => {
    console.log('Express server started on port: ' + port);
});