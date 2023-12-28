import Player from "./Player";

class Game {
    private players: Array<Player>;
    private teamSize: number;
    private roomCode: string;
    private teamId: number;
    private currentTurn: number;
    private document: string;
    private turnsPlayed: number;
    private NUM_TURNS = 100;
    private numReadys: number;
    private gameFinishedCallback: Function;


    constructor(players: Array<Player>, roomCode: string, teamId: number, teamSize: number, gameFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.document = "";
        this.turnsPlayed = 0;
        this.teamSize = teamSize;
        this.teamId = teamId;
        this.numReadys = 0;
        this.gameFinishedCallback = gameFinishedCallback;
    }



    addPlayer(player: Player) {
        this.players.push(player);
        player.socket.join(this.roomCode);
        player.socket.on("player_ready", () => {
            console.log("Player " + player.email + " is ready.")
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
            console.log("Player " + player.email + " is not ready.")
            player.socket.to(this.roomCode).emit("player_not_ready", {
                player: player.email,
                numReadys: this.numReadys,
            });
        });
    }

    private newPlayerReady() {
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
    private startGame() {
        console.log("Starting game for " + this.roomCode);
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.removeAllListeners("player_ready");
            this.players[i].socket.removeAllListeners("player_not_ready");
            this.players[i].socket.emit("game_start", {
                currentTurn: this.players[this.currentTurn].email
            });
            this.players[i].socket.on("play_turn", (sentence) => {
                if (this.currentTurn != i) {
                    this.players[i].socket.emit("not_your_turn");
                }
                else {
                    this.document += sentence;
                    this.currentTurn = (this.currentTurn + 1) % this.players.length;
                    this.turnsPlayed += 1;
                    for (let j = 0; j < this.players.length; j++) {
                        this.players[j].socket.emit("turn_played", {
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

    private gameOver() {
        console.log("Ending game for " + this.roomCode);
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("game_over", this.document);
            this.players[i].socket.removeAllListeners();
            this.players[i].socket.disconnect();
        }
        this.gameFinishedCallback(this.roomCode, this.teamId, this.document);
    }




}

export default Game;