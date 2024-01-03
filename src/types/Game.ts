import Player from "./Player";


export interface Entry {
    email: string,
    content: string
}

export interface GameInfo {
    playerEmails: Array<string>;
    currentTurn: string;
    entries: Array<Entry>;
    secondsRemaining: number;
    turnsRemaining: number;
}

const TURN_LENGTH_SECONDS = 15

class Game {
    public players: Array<Player>;
    private teamId: number;
    private submissionId: number;
    private currentTurn: number;
    private currentSecondsRemaining: number;
    private prompt: string;
    private entries: Array<Entry>;
    private numTurns: number;
    private gameFinishedCallback: Function;
    private onNewEntry: Function;
    private paused: boolean;
    private gameInfoInterval: any;
    private document: string;


    constructor(players: Array<Player>, teamId: number, submissionId: number, prompt: string, gameFinishedCallback: Function, onNewEntry: Function) {
        this.teamId = teamId;
        this.submissionId = submissionId
        this.currentTurn = 0;
        this.currentSecondsRemaining = TURN_LENGTH_SECONDS;
        this.numTurns = 25;
        this.entries = [];
        this.gameFinishedCallback = gameFinishedCallback;
        this.onNewEntry = onNewEntry;
        this.paused = false;
        this.prompt = prompt;
        this.gameInfoInterval = null;
        this.players = [];
        this.document = "";
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
                if (sentence !== "") {
                    this.entries.push({ content: sentence, email: player.email });
                    this.onNewEntry(sentence, this.submissionId, player.id);
                    this.document += ". " + sentence;
                }
                this.currentTurn += 1;
                this.currentSecondsRemaining = TURN_LENGTH_SECONDS;
                this.broadcastGameInfo();
                if (this.currentTurn >= this.numTurns) {
                    this.gameOver();
                }
            }
        })
        player.socket.on("disconnect", () => { //

            if (player.id === this.players[this.currentTurn % this.players.length].id) {
                this.numTurns -= 1;
                this.currentSecondsRemaining = TURN_LENGTH_SECONDS;
            }
            this.players = this.players.filter((otherPlayer: Player) => otherPlayer.id != player.id);


            if (this.players.length == 0) {
                clearInterval(this.gameInfoInterval);
                this.gameFinishedCallback(this.teamId, this.document);
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
            entries: this.entries,
            currentTurn: this.players[this.currentTurn % this.players.length].email,
            secondsRemaining: this.currentSecondsRemaining,
            turnsRemaining: this.numTurns - this.currentTurn,

        })
    }

    private startGame() {
        console.log("Starting game for " + this.teamId);
        this.broadcastToPlayers("game_start", this.prompt);
        this.broadcastGameInfo();
        this.gameInfoInterval = setInterval(() => {
            if (!this.paused) {
                this.currentSecondsRemaining -= 1;
                if (this.currentSecondsRemaining === 0) {
                    this.currentSecondsRemaining = TURN_LENGTH_SECONDS;
                    this.currentTurn += 1;
                }
                if (this.currentTurn >= this.numTurns) {
                    this.gameOver();
                }
            }

            this.broadcastGameInfo();
        }, 1000)
    }

    private gameOver() {
        console.log("Ending game for " + this.teamId);
        this.broadcastGameInfo();
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("game_over");
            this.players[i].socket.removeAllListeners();
            this.players[i].socket.disconnect();
        }
        clearInterval(this.gameInfoInterval);
        this.gameFinishedCallback(this.teamId, this.document);
    }

}

export default Game;