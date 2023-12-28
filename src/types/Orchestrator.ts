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
        let numPlayers = 0;
        for (let userId of [row.user1_id, row.user2_id, row.user3_id, row.user4_id, row.user5_id]) {
            if (userId) {
                numPlayers += 1
            }
        }
        return { roomCode: row.team_code, numPlayers: numPlayers, teamId: row.id };
    }

    private async gameOver(roomCode: string, teamId: number, document: string) {
        this.roomCodeToGame.delete(roomCode);
        await this.pool.query("INSERT INTO submissions(team_id, document, creation_time) VALUES($1, $2, $3)", [teamId, document, new Date()])
    }

    private lobbyFinished(roomCode: string, teamId: number, players: Array<Player>) {
        this.roomCodeToLobby.delete(roomCode);
        this.roomCodeToGame.set(roomCode, new Game(players, roomCode, teamId, this.gameOver));
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


            const { roomCode, numPlayers, teamId } = await this.getTeamInfo(id);
            if (numPlayers < 2 || numPlayers > 5) {
                socket.emit("invalid_num_of_players");
                socket.disconnect();
            }
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
                lobby = new Lobby([], roomCode, teamId, numPlayers, this.lobbyFinished);
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