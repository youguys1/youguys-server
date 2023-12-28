import { Socket } from "socket.io";

class Player {

    public socket: Socket;
    public email: string;
    public ready: boolean;
    public id: number;

    constructor(id: number, socket: Socket, email: string) {
        this.id = id;
        this.socket = socket;
        this.email = email;
        this.ready = false;
    }


}

export default Player;