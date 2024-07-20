// gameObjects.js
class Player {
    constructor(id,gameId, name) {
        this.id = id;
        this.gameId = gameId;
        this.name = name;
        //this.position = position; // { x: 0, y: 0 }
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.score = 0;
        this.hasReachedEnd = false;
        //this.finishedPlayers = [];
        //this.isSlowed = false;
    }
}

class Round {
    constructor(id, players) {
        this.id = id;
        this.players = players; // array of Player objects
        this.isOngoing = false;
        this.finishedPlayers = [];
        // this.startTime = null;
        // this.endTime = null;
    }

    start() {
        this.isOngoing = true;
        //this.startTime = new Date();
    }

    end() {
        this.isOngoing = false;
        //this.endTime = new Date();
    }
}

class Game {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.rounds = [];
        this.status = "waiting";
        this.currentRound = null;
    }

    addPlayer(player) {
        this.players.push(player);
    }

    startNewRound() {
        const newRound = new Round(this.rounds.length + 1, this.players);
        this.currentRound = newRound; // Correct assignment
        this.rounds.push(newRound);
        newRound.start();
    }

    endCurrentRound() {
        const currentRound = this.rounds[this.rounds.length - 1];
        if (currentRound.isOngoing) {
            currentRound.end();
        }
    }
}


module.exports = { Player, Round, Game };
