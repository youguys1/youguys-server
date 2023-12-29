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
        this.lobbyFinished = this.lobbyFinished.bind(this);
        this.gameOver = this.gameOver.bind(this);
        this.leaveTeam = this.leaveTeam.bind(this);
    }

    private async getInfoFromToken(token: string) {
        const result = await this.pool.query('SELECT "userId", email from sessions INNER JOIN users ON users.id = "userId" WHERE "sessionToken"=$1 AND expires > CURRENT_DATE LIMIT 1', [token]);
        if (result.rows.length == 0) {
            return { id: null };
        }
        return { id: result.rows[0].userId, email: result.rows[0].email };
    }

    private async getTeamInfo(id: number) {
        console.log(id)
        const result = await this.pool.query('SELECT teams.team_code, team_players.user_id FROM public.teams JOIN team_players ON team_players.team_id = teams.id WHERE team_players.leave_time IS NULL AND team_players.team_id=(select team_id from team_players WHERE user_id=$1 and leave_time IS NULL)', [id]);
        let playerIds = [];
        for (let row of result.rows) {
            playerIds.push(row.user_id);
        }
        return { roomCode: result.rows[0].team_code, playerIds: playerIds };
    }

    private async gameOver(roomCode: string, document: string) {
        this.roomCodeToGame.delete(roomCode);
        await this.pool.query("INSERT INTO submissions(team_id, document, creation_time) VALUES((SELECT id from teams WHERE team_code=$1), $2, $3)", [roomCode, document, new Date()]);
    }

    private async leaveTeam(playerId: number) {
        await this.pool.query("UPDATE team_players SET leave_time=$1 WHERE user_id=$2 and leave_time IS NULL", [new Date(), playerId])
    }

    private lobbyFinished(roomCode: string, players: Array<Player>) {
        this.roomCodeToLobby.delete(roomCode);
        this.roomCodeToGame.set(roomCode, new Game(players, roomCode, this.gameOver));
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
                console.log("already playing")
                socket.emit("already_playing");
                socket.disconnect();
                return;
            }

            const { roomCode, playerIds } = await this.getTeamInfo(id);

            const newPlayer = new Player(id, socket, email);
            if (this.roomCodeToGame.has(roomCode)) {
                console.log("adding himn to game that already started");
                this.roomCodeToGame.get(roomCode)?.addPlayer(newPlayer);
                // socket.emit("game_already_started");
                // socket.disconnect();
            }
            else if (this.roomCodeToLobby.has(roomCode)) {
                //@ts-ignore
                this.roomCodeToLobby.get(roomCode).addPlayer(newPlayer);
            }
            else {
                let lobby = new Lobby([], roomCode, playerIds, this.leaveTeam, this.lobbyFinished);
                this.roomCodeToLobby.set(roomCode, lobby);
                lobby.addPlayer(newPlayer);

            }
            this.ids.add(id);

            socket.emit("authenticated");

            this.connections.set(socket.id, newPlayer);
            //@ts-ignore

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