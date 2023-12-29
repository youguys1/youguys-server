import Player from "./Player";

class Game {
    private players: Array<Player>;
    private roomCode: string;
    private currentTurn: number;
    private document: string;
    private turnsPlayed: number;
    private NUM_TURNS = 100;
    private gameFinishedCallback: Function;
    private paused: boolean;


    constructor(players: Array<Player>, roomCode: string, gameFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.document = "";
        this.turnsPlayed = 0;
        this.gameFinishedCallback = gameFinishedCallback;
        this.paused = false;
        this.startGame();
    }

    addPlayer(player: Player) {
        this.players.push(player);
        if (this.paused && this.players.length >= 2) {
            this.broadcastToPlayers("game_unpause");
            this.paused = false;
        }
    }

    private broadcastToPlayers(messageType: string, data: any = null) {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit(messageType, data);
        }
    }

    private startGame() {
        console.log("Starting game for " + this.roomCode);
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("game_start", {
                currentTurn: this.players[this.currentTurn].email
            });
            this.players[i].socket.on("play_turn", (sentence) => {
                if (this.paused) {
                    this.players[i].socket.emit("game_pause")
                }
                else if (this.currentTurn != i) {
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
            this.players[i].socket.on("disconnect", () => { //
                this.players = this.players.filter((player: Player) => player.id != this.players[i].id);
                if (this.currentTurn == i) {
                    this.currentTurn += 1;
                }
                if (this.players.length == 1) {
                    this.paused = true;
                    this.broadcastToPlayers("game_pause");
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
        this.gameFinishedCallback(this.roomCode, this.document);
    }

}

export default Game;