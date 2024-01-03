import { Socket } from "socket.io";
import Game from "./Game";
import { Pool } from "pg";
import Player from "./Player";
import Lobby from "./Lobby";

class Orchestrator {

    private connections: Map<string, Player>;
    private ids: Set<number>;
    private teamIdToGame: Map<number, Game>;
    private teamIdToLobby: Map<number, Lobby>;
    private pool: Pool;

    constructor(pool: Pool) {

        this.connections = new Map();
        this.ids = new Set();
        this.teamIdToGame = new Map();
        this.teamIdToLobby = new Map();
        this.pool = pool;
        this.lobbyFinished = this.lobbyFinished.bind(this);
        this.gameOver = this.gameOver.bind(this);
        this.leaveTeam = this.leaveTeam.bind(this);
        this.newEntry = this.newEntry.bind(this);
    }

    private async getInfoFromToken(token: string) {
        const result = await this.pool.query('SELECT "userId", email from sessions INNER JOIN users ON users.id = "userId" WHERE "sessionToken"=$1 AND expires > NOW() LIMIT 1', [token]);
        if (result.rows.length == 0) {
            return { id: null };
        }
        return { id: result.rows[0].userId, email: result.rows[0].email };
    }

    private async getTeamInfo(id: number) {
        console.log(id)
        const result = await this.pool.query('SELECT teams.id AS team_id, team_players.user_id FROM public.teams JOIN team_players ON team_players.team_id = teams.id WHERE team_players.leave_time IS NULL AND team_players.team_id=(select team_id from team_players WHERE user_id=$1 and leave_time IS NULL)', [id]);
        let playerIds = [];
        console.log(result.rows)
        for (let row of result.rows) {
            playerIds.push(row.user_id);
        }
        return { playerIds: playerIds, teamId: result.rows[0].team_id };
    }

    private async gameOver(teamId: number, document: string) {
        const game = this.teamIdToGame.get(teamId);
        if (game) {
            for (let player of game.players) {
                this.ids.delete(player.id);
                this.connections.delete(player.socket.id);
            }

        }
        this.teamIdToGame.delete(teamId);
        this.pool.query("UPDATE submissions SET end_time=NOW(), document_legacy=$1 WHERE team_id=$2 AND end_time IS NULL", [document, teamId]);
    }

    private newEntry(entry: string, submissionId: string, userId: number) {
        this.pool.query("INSERT INTO entries(content, submission_id, user_id, creation_time) VALUES($1, $2, $3, NOW())", [entry, submissionId, userId])
    }

    private async leaveTeam(playerId: number) {
        await this.pool.query("UPDATE team_players SET leave_time=NOW() WHERE user_id=$1 and leave_time IS NULL", [playerId])
    }

    private async lobbyFinished(teamId: number, players: Array<Player>, startGame: boolean) {
        const lobby = this.teamIdToLobby.get(teamId);
        this.teamIdToLobby.delete(teamId);
        if (startGame) {
            const result = await this.pool.query("SELECT contests.id AS contest_id, prompts.prompt FROM contests JOIN prompts ON contests.prompt_id = prompts.id WHERE contests.start_time <= NOW() AND contests.end_time >= NOW() LIMIT 1"); // there should be exactly one row in here, if not, it's because we forgot to set up the contest
            const prompt = result.rows[0].prompt;
            const contestId = result.rows[0].contest_id;
            const subResult = await this.pool.query("INSERT INTO submissions(team_id, start_time, contest_id) VALUES($1, NOW(), $2) RETURNING id", [teamId, contestId]);
            this.teamIdToGame.set(teamId, new Game(players, teamId, subResult.rows[0].id, prompt, this.gameOver, this.newEntry));
        } else {
            if (lobby) {
                for (let player of lobby.players) {
                    this.ids.delete(player.id);
                    this.connections.delete(player.socket.id);
                }
            }
        }
    }

    public newConnection(socket: Socket) {
        console.log("someone connected");

        console.log(this.connections.size);
        socket.on('authenticate', async ({ token }) => {
            const { id, email } = await this.getInfoFromToken(token);
            console.log(email, "just connected");
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

            const { teamId, playerIds } = await this.getTeamInfo(id);

            const newPlayer = new Player(id, socket, email);
            if (this.teamIdToGame.has(teamId)) {
                console.log("adding himn to game that already started");
                this.teamIdToGame.get(teamId)?.addPlayer(newPlayer);

            }
            else if (this.teamIdToLobby.has(teamId)) {
                //@ts-ignore
                this.teamIdToLobby.get(teamId).addPlayer(newPlayer);
            }
            else {
                console.log("creating lobby with ");
                console.log(teamId)
                let lobby = new Lobby([], teamId, playerIds, this.leaveTeam, this.lobbyFinished);
                this.teamIdToLobby.set(teamId, lobby);
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