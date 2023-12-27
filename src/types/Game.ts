import { Pool } from "pg";
import Player from "./Player";

class Game {
    public players: Array<Player>;
    public teamSize: number;
    public roomCode: string;
    public teamId: number;
    private currentTurn: number;
    public document: string;
    public turnsPlayed: number;
    public NUM_TURNS = 100;
    public currentGames: Map<string, Game>;
    private pool: Pool;
    private numReadys: number;


    constructor(players: Array<Player>, roomCode: string, teamId: number, teamSize: number, currentGames: Map<string, Game>, pool: Pool) {
        this.players = players;
        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.document = "";
        this.turnsPlayed = 0;
        this.teamSize = teamSize;
        this.teamId = teamId;
        this.currentGames = currentGames;
        this.pool = pool;
        this.numReadys = 0;
    }

    addPlayer(player: Player) {
        this.players.push(player);
        player.socket.join(this.roomCode);
        player.socket.on("player_ready", () => {
            player.ready = true;
            this.numReadys += 1;
            player.socket.to(this.roomCode).emit("player_ready", {
                player: player.email,
                numReadys: this.numReadys,
            });
            this.newPlayerReady();
        });
        player.socket.on("player_not_ready", () => {
            player.ready = false;
            this.numReadys -= 1
            player.socket.to(this.roomCode).emit("player_not_ready", {
                player: player.email,
                numReadys: this.numReadys,
            });
        });
    }

    newPlayerReady() {
        if (this.players.length != this.teamSize) {
            return;
        }
        for (let player of this.players) {
            if (player.ready == false) {
                return;
            }
        }
        if (this.numReadys == this.teamSize) {
            this.startGame();

        }
    }
    startGame() {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("game_start", {
                currentTurn: this.players[this.currentTurn].email
            });
            this.players[i].socket.on("play_turn", (sentence) => { // the million dollar question: will it lock in the value of i or no?
                if (this.currentTurn != i) {
                    this.players[i].socket.emit("not_your_turn");
                }
                else {
                    this.document += sentence;
                    this.currentTurn = (this.currentTurn + 1) % this.players.length;
                    this.turnsPlayed += 1;
                    for (let j = 0; j < this.players.length; j++) {
                        this.players[j].socket.to(this.roomCode).emit("turn_played", {
                            currentTurn: this.players[this.currentTurn].email,
                            sentence: sentence
                        });
                    }

                    if (this.turnsPlayed >= this.NUM_TURNS) {
                        this.gameOver();
                    }
                }
            })
        }
    }

    gameOver() {

        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("game_over", this.document);
            this.players[i].socket.removeAllListeners();
        }
        this.currentGames.delete(this.roomCode);
        this.pool.query("INSERT INTO submissions(team_id, document, creation_time) VALUES($1, $2, $3)", [this.teamId, this.document, new Date()])
    }


}

export default Game;