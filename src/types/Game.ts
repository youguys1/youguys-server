import Player from "./Player";


interface GameInfo {
    playerEmails: Array<string>;
    currentDocument: string;
    currentTurn: string;
    secondsRemaining: number;
    turnsRemaining: number;
}



class Game {
    private players: Array<Player>;
    private roomCode: string;
    private currentTurn: number;
    private currentSecondsRemaining: number;
    private prompt: string
    private document: string;
    private NUM_TURNS = 100;
    private gameFinishedCallback: Function;
    private paused: boolean;
    private gameInfoInterval: any;


    constructor(players: Array<Player>, roomCode: string, gameFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.currentSecondsRemaining = 20;
        this.document = "";
        this.gameFinishedCallback = gameFinishedCallback;
        this.paused = false;
        this.prompt = "A horse walks into a bar."

        this.gameInfoInterval = null;
        this.startGame();
    }

    addPlayer(player: Player) {
        this.players.push(player);
        this.registerListeners();
        player.socket.emit("game_start", this.prompt);
        if (this.paused && this.players.length >= 2) {
            this.broadcastToPlayers("game_unpause");
            this.paused = false;
        }
        this.broadcastGameInfo();
    }

    private broadcastToPlayers(messageType: string, data: any = null) {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit(messageType, data);
        }
    }

    private broadcastGameInfo() {
        let playerEmails = this.players.map((player: Player) => player.email);
        this.broadcastToPlayers("game_info", {
            playerEmails: playerEmails,
            currentDocument: this.document,
            currentTurn: this.players[this.currentTurn % this.players.length].email,
            secondsRemaining: this.currentSecondsRemaining,
            turnsRemaining: this.NUM_TURNS - this.currentTurn,

        })
    }

    private startGame() {
        console.log("Starting game for " + this.roomCode);
        this.broadcastToPlayers("game_start", this.prompt);
        this.broadcastGameInfo();
        this.registerListeners();
        this.gameInfoInterval = setInterval(() => {
            if (!this.paused) {
                this.currentSecondsRemaining -= 1;
                if (this.currentSecondsRemaining === 0) {
                    this.currentSecondsRemaining = 20;
                    this.currentTurn += 1;
                }
            }

            this.broadcastGameInfo();
        }, 1000)
    }

    private registerListeners() {
        for (let i = 0; i < this.players.length; i++) {




            this.players[i].socket.on("play_turn", (sentence) => {
                console.log("play turn event");
                console.log(this.players)
                if (this.paused) {
                    this.players[i].socket.emit("game_pause")
                }
                else if (this.currentTurn % this.players.length != i) {
                    console.log(i)
                    console.log(this.currentTurn)
                    this.players[i].socket.emit("not_your_turn");
                }
                else {
                    this.document += sentence;
                    this.currentTurn += 1;
                    this.currentSecondsRemaining = 20;

                    this.broadcastGameInfo();


                    if (this.currentTurn >= this.NUM_TURNS) {
                        this.gameOver();
                    }
                }
            })
            this.players[i].socket.on("disconnect", () => { //
                console.log("player disconnected in the game setate")
                this.players = this.players.filter((player: Player) => player.id != this.players[i].id);

                if (this.players.length == 0) {
                    clearInterval(this.gameInfoInterval)
                    this.gameFinishedCallback(this.roomCode, this.document);
                    return;
                }

                this.registerListeners();

                if (this.players.length == 1) {
                    console.log("pausing game")
                    this.paused = true;
                    this.broadcastToPlayers("game_pause");
                }
                this.broadcastGameInfo();

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
        clearInterval(this.gameInfoInterval)
        this.gameFinishedCallback(this.roomCode, this.document);
    }

}

export default Game;