import './preStart'; // Must be the first import
import app from '@server';
// import logger from '@shared/Logger';
// SocketIO Server
import Http from 'http';
import { Pool } from 'pg';
import Player from "./types/Player";

import { Server as SocketIOServer, Socket } from 'socket.io';
import Game from './types/Game';
// import ProtocolManager from "./io/ProtocolManager";
// import configureListeners from "./io/configureListeners";

// Express Server
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
});// app.listen(port, () => {
//     logger.info('Express server started on port: ' + port);
// });
async function getInfoFromToken(token: string) {
    const result = await pool.query('SELECT "userId", email from sessions INNER JOIN users ON users.id = "userId" WHERE "sessionToken"=$1 AND expires > CURRENT_DATE LIMIT 1', [token]);
    return { id: result.rows[0].userId, email: result.rows[0].email };
}
async function getTeamInfo(id: number) {
    const result = await pool.query('SELECT * FROM teams WHERE $1 in (user1_id, user2_id, user3_id, user4_id, user5_id)', [id]);
    const row = result.rows[0];
    let numPlayers = 0;
    for (let userId of [row.user1_id, row.user2_id, row.user3_id, row.user4_id, row.user5_id]) {
        if (userId) {
            numPlayers += 1
        }
    }
    return { roomCode: row.team_code, numPlayers: numPlayers };
}

const http = Http.createServer(app);
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const ioServer = new SocketIOServer(http);
const connections = new Map();
const roomCodeToGame = new Map();

// TODO handle disconnections
ioServer.on('connection', function (socket: Socket) {
    console.log("someone connected");
    connections.set(socket.id, socket);
    console.log(connections.size);
    socket.on('authenticate', async ({ token }) => {

        console.log("someone sent a authenticate")
        console.log(token);
        const { id, email } = await getInfoFromToken(token);
        if (!id) {
            socket.emit("not_authenticated");
            socket.disconnect();
            return;
        }
        const newPlayer = new Player(socket, email);
        const { roomCode, numPlayers } = await getTeamInfo(id);
        if (numPlayers < 2 || numPlayers > 5){
            socket.emit("invalid_num_of_players");
            socket.disconnect();
        }
        let game;
        if (roomCodeToGame.has(roomCode)) {
            game = roomCodeToGame.get(roomCode);
        }
        else {
            game = new Game([], roomCode, numPlayers, roomCodeToGame);
            roomCodeToGame.set(roomCode, game);
        }
        game.addPlayer(newPlayer);
    })
    socket.on('disconnect', function () {
        connections.delete(socket.id);

        console.log("someone disconnected.");
        console.log(connections.size);

    });
});
// what does the server need to do?
// it needs to group people into teams, and allow everyone to ready up.
// how do we figure out whos on what team? well, we can get your token
// use it  to authenticate you, but how do we figure out who you are?
// we cant let you tell us who you are, can we? like no. We cou
// const manager = new ProtocolManager();

// configureListeners(ioServer, manager);

ioServer.listen(http, { cors: { origin: 'http://localhost' } })

http.listen(port, () => {
    console.log('Express server started on port: ' + port);
});