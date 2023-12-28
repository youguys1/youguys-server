import Player from "./Player";


interface LobbyPlayerInfo {
    email: string,
    ready: boolean;
}

interface LobbyInfo {
    players: Array<LobbyPlayerInfo>
}

class Lobby {
    private players: Array<Player>;
    private teamSize: number;
    private roomCode: string;
    private teamId: number;
    private lobbyInfo: LobbyInfo;
    // private currentTurn: number;
    // private document: string;
    // private turnsPlayed: number;
    // private NUM_TURNS = 100;
    private numReadys: number;
    private lobbyFinishedCallback: Function;


    constructor(players: Array<Player>, roomCode: string, teamId: number, teamSize: number, lobbyFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        this.lobbyInfo = {
            players: []
        };
        // this.currentTurn = 0;
        // this.document = "";
        // this.turnsPlayed = 0;
        this.teamSize = teamSize;
        this.teamId = teamId;
        this.numReadys = 0;
        this.lobbyFinishedCallback = lobbyFinishedCallback;
    }

    private updateAndBroadcastLobbyInfo(playerEmail: string, readyStatus: boolean) {
        for (let i = 0; i < this.lobbyInfo.players.length; i++) {
            if (this.lobbyInfo.players[i].email == playerEmail) {
                this.lobbyInfo.players[i].ready = readyStatus;
                return;
            }
        }

        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit("lobby_info", this.lobbyInfo);
        }
    }



    addPlayer(player: Player) {
        this.players.push(player);
        this.lobbyInfo.players.push({
            email: player.email,
            ready: player.ready
        });
        this.updateAndBroadcastLobbyInfo(player.email, false);
        // player.socket.join(this.roomCode);
        player.socket.on("player_ready", () => {
            console.log("Player " + player.email + " is ready.")
            player.ready = true;
            this.numReadys += 1;
            // player.socket.to(this.roomCode).emit("player_ready", {
            //     player: player.email,
            //     numReadys: this.numReadys,
            // });
            this.updateAndBroadcastLobbyInfo(player.email, true);
            this.newPlayerReady();
        });
        player.socket.on("player_not_ready", () => {
            player.ready = false;
            this.numReadys -= 1
            console.log("Player " + player.email + " is not ready.")
            // player.socket.to(this.roomCode).emit("player_not_ready", {
            //     player: player.email,
            //     numReadys: this.numReadys,
            // });
            this.updateAndBroadcastLobbyInfo(player.email, false);
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
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.removeAllListeners();
        }
        this.lobbyFinishedCallback(this.roomCode, this.teamId, this.players);
    }
    // private startGame() {
    //     console.log("Starting game for " + this.roomCode);
    //     for (let i = 0; i < this.players.length; i++) {
    //         this.players[i].socket.removeAllListeners("player_ready");
    //         this.players[i].socket.removeAllListeners("player_not_ready");
    //         this.players[i].socket.emit("game_start", {
    //             currentTurn: this.players[this.currentTurn].email
    //         });
    //         this.players[i].socket.on("play_turn", (sentence) => {
    //             if (this.currentTurn != i) {
    //                 this.players[i].socket.emit("not_your_turn");
    //             }
    //             else {
    //                 this.document += sentence;
    //                 this.currentTurn = (this.currentTurn + 1) % this.players.length;
    //                 this.turnsPlayed += 1;
    //                 for (let j = 0; j < this.players.length; j++) {
    //                     this.players[j].socket.emit("turn_played", {
    //                         currentTurn: this.players[this.currentTurn].email,
    //                         sentence: sentence
    //                     });
    //                 }

    //                 if (this.turnsPlayed >= this.NUM_TURNS) {
    //                     this.gameOver();
    //                 }
    //             }
    //         })
    //     }
    // }

    // private gameOver() {
    //     console.log("Ending game for " + this.roomCode);
    //     for (let i = 0; i < this.players.length; i++) {
    //         this.players[i].socket.emit("game_over", this.document);
    //         this.players[i].socket.removeAllListeners();
    //         this.players[i].socket.disconnect();
    //     }
    //     this.lobbyFinishedCallback(this.roomCode, this.teamId, this.document);
    // }




}

export default Lobby;