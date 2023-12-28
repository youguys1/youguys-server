import { Socket } from "socket.io";
import Game from "./Game";
import { Pool } from "pg";
import Player from "./Player";
import Lobby from "./Lobby";

class Orchestrator {

    private connections: Map<string, Player>;
    private ids: Set<number>;
    private roomCodeToGame: Map<string, Game>;
    private roomCodeToLobby: Map<string, Lobby>;
    private pool: Pool;

    constructor(pool: Pool) {

        this.connections = new Map();
        this.ids = new Set();
        this.roomCodeToGame = new Map();
        this.roomCodeToLobby = new Map();
        this.pool = pool;
    }

    private async getInfoFromToken(token: string) {
        const result = await this.pool.query('SELECT "userId", email from sessions INNER JOIN users ON users.id = "userId" WHERE "sessionToken"=$1 AND expires > CURRENT_DATE LIMIT 1', [token]);
        if (result.rows.length == 0) {
            return { id: null };
        }
        return { id: result.rows[0].userId, email: result.rows[0].email };
    }

    private async getTeamInfo(id: number) {
        const result = await this.pool.query('SELECT * FROM teams WHERE $1 in (user1_id, user2_id, user3_id, user4_id, user5_id) AND is_active=TRUE LIMIT 1', [id]);
        const row = result.rows[0];
        let playerIds = [];
        for (let userId of [row.user1_id, row.user2_id, row.user3_id, row.user4_id, row.user5_id]) {
            if (userId) {
                playerIds.push(userId);
            }
        }
        return { roomCode: row.team_code, playerIds: playerIds, creationTime: row.creation_time };
    }

    private async gameOver(roomCode: string, document: string) {
        this.roomCodeToGame.delete(roomCode);
        await this.pool.query("INSERT INTO submissions((SELECT id from teams WHERE team_code=$1 AND is_active=TRUE), document, creation_time) VALUES($1, $2, $3)", [roomCode, document, new Date()])
    }

    // returns db id of new team row. TODO turn this into a transaction
    private async leaveTeam(playerId: number, teamCode: string, playerIds: Array<number>, creationTime: Date) {
        await this.pool.query("UPDATE teams SET is_active=FALSE WHERE team_code=$1 AND is_active=TRUE", [teamCode]); //set the old team to be inactive
        let queryParams: any = [];
        for (let i = 0; i < playerIds.length; i++) {
            if (playerIds[i] != playerId) {
                queryParams.push(playerIds[i]);
            }
        }
        for (let i = 0; i < 5 - queryParams.length; i++) {
            queryParams.push(null);
        }
        queryParams = queryParams.concat([teamCode, true, creationTime])
        const result = await this.pool.query("INSERT INTO teams(user1_id, user2_id, user3_id, user4_id, user5_id, team_code, is_active, creation_time) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id", queryParams);
        return result.rows[0].id;
    }

    private lobbyFinished(roomCode: string, players: Array<Player>) {
        this.roomCodeToLobby.delete(roomCode);
        this.roomCodeToGame.set(roomCode, new Game(players, roomCode, this.gameOver));
        // await this.pool.query("INSERT INTO submissions(team_id, document, creation_time) VALUES($1, $2, $3)", [teamId, document, new Date()])
    }

    public newConnection(socket: Socket) {
        console.log("someone connected");

        console.log(this.connections.size);
        socket.on('authenticate', async ({ token }) => {

            console.log(token);
            const { id, email } = await this.getInfoFromToken(token);
            if (!id) {
                socket.emit("not_authenticated");
                socket.disconnect();
                return;
            }
            if (this.ids.has(id)) {
                socket.emit("already_playing");
                socket.disconnect();
                return;
            }


            const { roomCode, playerIds, creationTime } = await this.getTeamInfo(id);
            // if (numPlayers < 2 || numPlayers > 5) {
            //     socket.emit("invalid_num_of_players");
            //     socket.disconnect();
            // }
            let lobby;
            if (this.roomCodeToGame.has(roomCode)) {
                socket.emit("game_already_started");
                socket.disconnect();
                // game = this.roomCodeToGame.get(roomCode);
            }
            else if (this.roomCodeToLobby.has(roomCode)) {
                lobby = this.roomCodeToLobby.get(roomCode);

                // console.log("Creating new game for team code:" + roomCode);
                // game = new Game([], roomCode, teamId, numPlayers, this.gameOver);
            }
            else {
                lobby = new Lobby([], roomCode, playerIds, creationTime, this.leaveTeam, this.lobbyFinished);
                this.roomCodeToLobby.set(roomCode, lobby);

            }
            this.ids.add(id);

            socket.emit("authenticated");
            const newPlayer = new Player(id, socket, email);
            this.connections.set(socket.id, newPlayer);
            //@ts-ignore
            lobby.addPlayer(newPlayer);
        })
        socket.on('disconnect', () => {

            if (this.connections.has(socket.id)) {
                //@ts-ignore
                this.ids.delete(this.connections.get(socket.id).id);
                this.connections.delete(socket.id);
            }


            console.log("someone disconnected.");
            console.log(this.connections.size);

        });
    }
}

export default Orchestrator;