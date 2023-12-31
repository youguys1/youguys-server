import Player from "./Player";

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


    constructor(players: Array<Player>, roomCode: string, gameFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.currentSecondsRemaining = 20;
        this.document = "";
        this.gameFinishedCallback = gameFinishedCallback;
        this.paused = false;
        this.prompt = "This is the prompt. Let me know what a good idea for the first one to run tests with should be, Burg."
        this.startGame();
    }

    addPlayer(player: Player) {
        this.players.push(player);
        this.registerListeners();
        player.socket.emit("game_start", this.prompt)
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
        setInterval(() => {
            this.currentSecondsRemaining -= 1;
            if (this.currentSecondsRemaining === 0) {
                this.currentSecondsRemaining = 20;
                this.currentTurn += 1;
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

                // if (this.currentTurn % this.players.length == i) {
                //     console.log("it was his turn")
                //     this.currentTurn = (this.currentTurn + 1) % this.players.length;
                // }
                if (this.players.length == 0) {
                    this.gameFinishedCallback(this.roomCode, this.document);
                    return;
                }

                this.registerListeners();

                if (this.players.length == 1) {
                    console.log("pausing game")
                    this.paused = true;
                    this.broadcastToPlayers("game_pause");
                }

                // this.broadcastToPlayers("turn_played", {
                //     currentTurn: this.players[this.currentTurn].email,
                //     sentence: ""
                // });


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