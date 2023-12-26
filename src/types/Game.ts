import { Pool } from "pg";
import Player from "./Player";

class Game {
    public players: Array<Player>;
    public team_size: number;
    public roomCode: string;
    private currentTurn: number;
    public document: string;
    public turns_played: number;
    public NUM_TURNS = 100;
    public currentGames: Map<string, Game>;
    private pool: Pool;


    constructor(players: Array<Player>, roomCode: string, team_size: number, currentGames: Map<string, Game>, pool: Pool) {
        this.players = players;
        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.document = "";
        this.turns_played = 0;
        this.team_size = team_size;
        this.currentGames = new Map();
        this.pool = pool;
    }

    addPlayer(player: Player) {
        this.players.push(player);
        player.socket.join(this.roomCode);
        player.socket.on("player_ready", () => {
            player.ready = true;
            player.socket.to(this.roomCode).emit("player_ready", player.email);
            this.newPlayerReady();
        });
        player.socket.on("player_not_ready", () => {
            player.ready = false;
            player.socket.to(this.roomCode).emit("player_not_ready", player.email);
        });
    }

    newPlayerReady() {
        if (this.players.length != this.team_size) {
            return;
        }
        for (let player of this.players) {
            if (player.ready == false) {
                return;
            }
        }
        this.startGame();
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
                    this.turns_played += 1;
                    this.players[i].socket.to(this.roomCode).emit("turn_played", {
                        currentTurn: this.players[this.currentTurn].email,
                        sentence: sentence
                    });
                    if (this.turns_played >= this.NUM_TURNS) {
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
        // write document to db
    }


}

export default Game;