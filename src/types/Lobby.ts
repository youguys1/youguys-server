import Player from "./Player";


interface LobbyPlayerInfo {
    email: string,
    ready: boolean;
}

interface LobbyInfo {
    players: Array<LobbyPlayerInfo>
}

class Lobby {
    private players: Array<Player>; // the players active in the lobby
    private playerIds: Array<number>; //the ids of everyone on your team
    private roomCode: string;
    private playerLeftTeam: Function;
    private lobbyFinishedCallback: Function;


    constructor(players: Array<Player>, roomCode: string, playerIds: Array<number>, playerLeftTeam: Function, lobbyFinishedCallback: Function) {
        this.players = players;
        this.roomCode = roomCode;
        this.playerIds = playerIds;
        this.playerLeftTeam = playerLeftTeam;
        this.lobbyFinishedCallback = lobbyFinishedCallback;
    }

    private broadcastToPlayers(messageType: string, data: any = null) {
        console.log("SENDING MESSAGE TYPE: " + messageType);
        console.log("WITH DATA: ", data);
        for (let i = 0; i < this.players.length; i++) {
            if (data) {
                this.players[i].socket.emit(messageType, data);

            }
            else {
                this.players[i].socket.emit(messageType);
            }
        }
    }

    private broadcastLobbyInfo() {
        let lobbyInfo: LobbyInfo = { players: [] };
        for (let i = 0; i < this.players.length; i++) {
            lobbyInfo.players.push({ email: this.players[i].email, ready: this.players[i].ready })
        }
        this.broadcastToPlayers("lobby_info", lobbyInfo);
    }

    private disconnectCallback() {
        // if you disconnect in the lobby, we can just remove you from the players
        if (this.players.length == 1) {
            console.log("killing lobby");
            // kill lobby if everyone left the team
            this.lobbyFinishedCallback(this.roomCode, this.players, false);

            return;
        }
        this.players = this.players.filter((lobbyPlayer) => lobbyPlayer.id != player.id);


        this.broadcastLobbyInfo();

    }



    addPlayer(player: Player) {
        if (!this.playerIds.includes(player.id)) {
            this.playerIds.push(player.id);
            this.broadcastToPlayers("team_update");
        }
        this.players.push(player);

        this.broadcastLobbyInfo();
        player.socket.on("player_ready", () => {
            console.log("Player " + player.email + " is ready.")
            player.ready = true;
            this.broadcastLobbyInfo();
            this.newPlayerReady();
        });
        player.socket.on("player_not_ready", () => {
            player.ready = false;
            console.log("Player " + player.email + " is not ready.")
            this.broadcastLobbyInfo();
        });

        player.socket.on("disconnect", this.disconnectCallback);

        player.socket.on("leave_team", async () => {
            console.log("someone is leaving the team");
            console.log(this.players);
            await this.playerLeftTeam(player.id);
            if (this.players.length == 1) {
                // kill lobby if everyone left the team
                this.lobbyFinishedCallback(this.roomCode, this.players, false);

                return;
            }
            this.broadcastToPlayers("team_update");
            this.players = this.players.filter((x) => x.id != player.id);
            this.playerIds = this.playerIds.filter((x) => x != player.id);

            this.broadcastLobbyInfo();


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
            this.players[i].socket.removeAllListeners("player_ready");
            this.players[i].socket.removeAllListeners("player_not_ready");
            this.players[i].socket.removeAllListeners("leave_team");
            this.players[i].socket.removeListener("disconnect", this.disconnectCallback);
        }

        this.lobbyFinishedCallback(this.roomCode, this.players, true);
    }



}

export default Lobby;