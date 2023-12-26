import { Socket } from "socket.io";
import Game from "./Game";

class Player {

    public socket: Socket;
    public email: string;
    public ready: boolean;

    constructor(socket: Socket, email: string) {
        this.socket = socket;
        this.ready = false;
        this.email = email;

    }


}

export default Player;