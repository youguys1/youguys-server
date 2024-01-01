import Player from "./Player";


interface GameInfo {
    playerEmails: Array<string>;
    currentDocument: string;
    currentTurn: string;
    secondsRemaining: number;
    turnsRemaining: number;
}



class Game {
    public players: Array<Player>;
    private roomCode: string;
    private currentTurn: number;
    private currentSecondsRemaining: number;
    private prompt: string;
    private contestId: number;
    private document: string;
    private numTurns: number;
    private gameFinishedCallback: Function;
    private paused: boolean;
    private gameInfoInterval: any;


    constructor(players: Array<Player>, roomCode: string, prompt: string, contestId: number, gameFinishedCallback: Function) {

        this.roomCode = roomCode;
        this.currentTurn = 0;
        this.currentSecondsRemaining = 10;
        this.numTurns = 25;
        this.document = "";
        this.gameFinishedCallback = gameFinishedCallback;
        this.paused = false;
        this.prompt = prompt;
        this.contestId = contestId;
        this.gameInfoInterval = null;
        this.players = [];
        for (let i = 0; i < players.length; i++) {
            this.addPlayer(players[i]);
        }
        this.startGame();
    }

    addPlayer(player: Player) {

        this.players.push(player);
        player.socket.on("play_turn", (sentence) => {

            if (this.paused) {
                player.socket.emit("game_pause")
            }
            else if (this.players[this.currentTurn % this.players.length].id != player.id) {
                player.socket.emit("not_your_turn");
            }
            else {
                this.document += sentence;
                this.currentTurn += 1;
                this.currentSecondsRemaining = 10;

                this.broadcastGameInfo();


                if (this.currentTurn >= this.numTurns) {
                    this.gameOver();
                }
            }
        })
        player.socket.on("disconnect", () => { //

            if (player.id === this.players[this.currentTurn % this.players.length].id) {
                this.numTurns -= 1;
                this.currentSecondsRemaining = 10;
            }
            this.players = this.players.filter((otherPlayer: Player) => otherPlayer.id != player.id);


            if (this.players.length == 0) {
                clearInterval(this.gameInfoInterval);
                this.gameFinishedCallback(this.roomCode, this.document, this.contestId);
                return;
            }


            if (this.players.length == 1) {
                this.paused = true;
                this.broadcastToPlayers("game_pause");
            }
            this.broadcastGameInfo();

        })

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
            turnsRemaining: this.numTurns - this.currentTurn,

        })
    }

    private startGame() {
        console.log("Starting game for " + this.roomCode);
        this.broadcastToPlayers("game_start", this.prompt);
        this.broadcastGameInfo();
        this.gameInfoInterval = setInterval(() => {
            if (!this.paused) {
                this.currentSecondsRemaining -= 1;
                if (this.currentSecondsRemaining === 0) {
                    this.currentSecondsRemaining = 10;
                    this.currentTurn += 1;
                }
            }

            this.broadcastGameInfo();
        }, 1000)
    }

    private gameOver() {
        console.log("Ending game for " + this.roomCode);
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("game_over", this.document);
            this.players[i].socket.removeAllListeners();
            this.players[i].socket.disconnect();
        }
        clearInterval(this.gameInfoInterval)
        this.gameFinishedCallback(this.roomCode, this.document, this.contestId);
    }

}

export default Game;