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
    private playerIds: Array<number>;
    private roomCode: string;
    private teamId: number;
    private teamCreationTime: Date;
    // private currentTurn: number;
    // private document: string;
    // private turnsPlayed: number;
    // private NUM_TURNS = 100;
    private numReadys: number;
    private playerLeftTeam: Function;
    private lobbyFinishedCallback: Function;


    constructor(players: Array<Player>, roomCode: string, teamId: number, playerIds: Array<number>, teamCreationTime: Date, playerLeftTeam: Function, lobbyFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        // this.currentTurn = 0;
        // this.document = "";
        // this.turnsPlayed = 0;
        this.playerIds = playerIds;
        this.teamId = teamId;
        this.numReadys = 0;
        this.teamCreationTime = teamCreationTime;
        this.playerLeftTeam = playerLeftTeam;
        this.lobbyFinishedCallback = lobbyFinishedCallback;
    }

    private broadcastToPlayers(messageType: string, data: any = null) {
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].socket.emit(messageType, data);
        }
    }

    private broadcastLobbyInfo() {
        let lobbyInfo: LobbyInfo = { players: [] };
        for (let i = 0; i < this.players.length; i++) {
            lobbyInfo.players.push({ email: this.players[i].email, ready: this.players[i].ready })
        }
        this.broadcastToPlayers("lobby_info", lobbyInfo);
    }



    addPlayer(player: Player) {
        this.players.push(player);

        this.broadcastLobbyInfo();
        // player.socket.join(this.roomCode);
        player.socket.on("player_ready", () => {
            console.log("Player " + player.email + " is ready.")
            player.ready = true;
            this.numReadys += 1;
            // player.socket.to(this.roomCode).emit("player_ready", {
            //     player: player.email,
            //     numReadys: this.numReadys,
            // });
            this.broadcastLobbyInfo();
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
            this.broadcastLobbyInfo();
        });

        player.socket.on("leave_team", async () => {
            //remove from players array
            let deleteInd = -1;
            for (let i = 0; i < this.players.length; i++) {
                if (player.id = this.players[i].id) {
                    deleteInd = i;
                }
            }
            this.players = this.players.splice(deleteInd, deleteInd);
            // this.teamSize -= 1;
            // update the team in the orchestrator
            this.teamId = await this.playerLeftTeam();
            // broadcast out new lobby info
            this.broadcastLobbyInfo();
            // tell everyone that the team has changed
            this.broadcastToPlayers("team_update");
        })
    }

    private newPlayerReady() {
        if (this.players.length != this.playerIds.length) {
            return;
        }
        for (let player of this.players) {
            if (player.ready == false) {
                return;
            }
        }
        if (this.players.length < 2 || this.players.length > 5) {
            return;
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