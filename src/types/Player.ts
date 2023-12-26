import { Socket } from "socket.io";

class Player {

    public socket: Socket;
    public email: string;
    public ready: boolean;

    constructor(socket: Socket, email: string) {
        this.socket = socket;
        this.email = email;
        this.ready = false;
    }


}

export default Player;