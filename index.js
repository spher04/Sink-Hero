const mazeGen = require("./maze_generation");
const { Player, Round, Game } = require('./gameobjects');

const express = require("express");
const { Server } = require("http");
const path = require("path");
const socketIo = require("socket.io");

const app = express();
const server = new Server(app);
const io = socketIo(server);
const port = 3000;

//Variables for game Logic and powerups
const games = {}; // Use an object to store games by their ID
const hosts = {};

//Variables for game powerups



// Serve static files from 'client' directory
app.use('/client', express.static(path.join(__dirname, 'client')));

// Serve static files from the 'client/public' directory
app.use(express.static(path.join(__dirname, "/client/public"), {
    setHeaders: (res, path) => {
        if (path.endsWith(".js")) {
            res.set("Content-Type", "application/javascript");
        }
    }
}));

// Serve the host page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/client/public", "index.html"));
});

// Serve the game page
app.get("/game", (req, res) => {
    res.sendFile(path.join(__dirname, "/client/public", "game.html"));
});

// Serve the host page and notify clients
app.get("/host", (req, res) => {
    res.sendFile(path.join(__dirname, "/client/public", "host.html"));
    io.emit("hostAccessed");
});

io.on('connection', (socket) => {
    console.log('New user connected', socket.id);

    // Listening for the joinGame event
    socket.on("joinGame", (data) => {
        const gameId = data.gameId;
        //const { username, gameId } = data;
        const player =  new Player(socket.id,data.gameId,data.username);
        //console.log(`New player with name ${player.name} created `)
        //console.log("new join");

        // Create a new game if it doesn't exist
        if (!games[gameId]) {
            games[gameId] = new Game(gameId); 
        }

        // Check if the game has already started
        if (games[gameId].status !== "waiting") {
            socket.emit("error", { message: "Game already started. You cannot join." });
            console.log(`games${games}`);
            return;
        }

        // Check if the username is already taken in this game
        if (games[gameId].players.find((player) => player.name === data.username)) {
            socket.emit("error", { message: "Username already taken in this game." });
            return;
        }

        // Add the player to the game
        
        // games[gameId].players.push({ id: socket.id, name: username });
        // socket.join(gameId);

        games[gameId].addPlayer(player);
        socket.join(gameId);
        

        // Emit the waiting event with the current players count
        //io.to(gameId).emit("waiting", { playersCount: games[gameId].players.length });
        io.to(gameId).emit("waiting",games[gameId].players)

        // Emit the gameStateUpdate event
        //io.to(gameId).emit("gameStateUpdate", games[gameId]);
    });

    // Listening for the becomeHost event
    socket.on("becomeHost", (data) => {
        const { gameId } = data;
        if (hosts[gameId]) {
            socket.emit("error", { message: "Host already exists for this game." });
            return;
        }
        hosts[gameId] = { id: socket.id, name: "Host" };
        socket.join(gameId);
        console.log(`Host for game ${gameId} set with ID ${socket.id}`);
    });

    // Listening for the startGame event
    socket.on("startGame", (gameId) => {
        if (games[gameId] && games[gameId].status === "waiting" && games[gameId].players.length >= 2) {
            games[gameId].status = "started";
            startGame(gameId);
            //io.to(gameId).emit("gameStart", games[gameId]);
            console.log(`Game with game ID: ${gameId} started`);
        } else {
            socket.emit("error", { message: "Not enough players to start the game." });
        }
    });

    // Handle the disconnect event
    socket.on('disconnect', () => {
        console.log('User disconnected', socket.id);
        for (const gameId in games) {
            const game = games[gameId];
            const playerIndex = game.players.findIndex((player) => player.id === socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                io.to(gameId).emit("gameStateUpdate", game);
            }
        }
    });

    // Handle player position changes
    socket.on("playerPositionChanged", (data) => {
        const game = games[data.gameId];
        //console.log(`The player is:` ,JSON.stringify(data,null,2) )
        if(games[data.gameId]){
            const game = games[data.gameId];
        }
        else{
            //console.log(`game with ${data.gameId} not found`);
            //console.log(games)
            
        }
        if (!game || !game.players) {
            //console.log(game)
            //console.log(`Game or players not found for gameId ${data.gameId}`);
            return;
        }

        game.players.forEach((player) => {
            if (player.id !== socket.id) {
                io.to(player.id).emit("playerPositionChanged", data)
            }
        });
    });
    socket.on("hasFinished", (player) => {
        console.log(`hasFinished triggered for player ${player.name}`);
        const game = games[player.gameId];
        console.log(`current game is `,JSON.stringify(game,null,2))
    
        if (!game) {
            console.error(`Game with ID ${player.gameId} not found`);
            return;
        }
    
        if (!game.currentRound) {
            console.error(`No current round found for game ${player.gameId}`);
            return;
        }
    
        console.log("New player has finished round:");
        console.log("Current Round ID: " + game.currentRound.id);
        console.log("Players in Current Round: " + game.currentRound.players.length);
    
        // Adjust the player's score based on the number of rounds
        if (game.rounds.length < 2) {
            player.score += 10;
        } else {
            player.score += 20;
        }
    
        // Ensure finishedPlayers is an array
        if (!Array.isArray(game.currentRound.finishedPlayers)) {
            game.currentRound.finishedPlayers = [];
        }
    
        // Add the player to the list of finished players for the current round
        game.currentRound.finishedPlayers.push(player);
    
        // Emit the updated list of finished players to all players who have finished
        game.currentRound.finishedPlayers.forEach(finishedPlayer => {
            console.log(`sending info to player ${finishedPlayer.id}`);
            io.to(finishedPlayer.id).emit("playerFinished", game.currentRound.finishedPlayers);
        });
    });
    
});

const startGame = (gameId) => {
    let generatedMaze = mazeGen.GenerateMaze(780, 600);
    const game = games[gameId];

    if (game) {
        game.startNewRound(); // Correctly call startNewRound on the Game instance
        // if (game.currentRound) {
        //     console.log("New round started successfully:");
        //     console.log("Current Round ID: " + game.currentRound.id);
        //     console.log("Players in Current Round: " + game.currentRound.players.length);
        // } else {
        //     console.error("Failed to start a new round. currentRound is undefined.");
        // }
    } else {
        console.error(`Game with ID ${gameId} not found`);
        return;
    }

    // Emit the generated maze to all players and the host
    game.players.forEach((player) => {
        if (player && player.id) {
            
            io.to(player.id).emit("sendMaze", generatedMaze);
        } else {
            console.error(`Player in game ${gameId} is undefined or has no ID.`);
        }
    });

    if (game.players.length >= 2) {
        game.status = "in-progress";
        game.currentRound = 0;

        let colours = ["#ff0000", "#ffff00", "#ff00ff", "#0000ff"];
        let startPositions = [
            { x: 30, y: 30 },
            { x: 750, y: 30 },
            { x: 30, y: 570 },
            { x: 750, y: 570 },
        ];

        game.players.forEach((player, index) => {
            if (player && player.id) {
                const dataToEmit = {
                    gameId,
                    playerId: index,
                    name: player.name,
                    x: startPositions[index].x / 60,
                    y: startPositions[index].y / 60,
                    colour: colours[index],
                };
        
                 //console.log(`Emitting gameStart event to player ${player.name} with data:`,dataToEmit);
        
                io.to(player.id).emit("gameStart", dataToEmit);
            } else {
                console.error(`Player in game ${gameId} is undefined or has no ID.`);
            }
        });
        

        console.log(
            `Game ${gameId} started with players:`,
            games[gameId].players.map((p) => p.id + " (" + p.name + ")")
        );
    } else {
        endGame(gameId);
    }
    const endGame =gameId => {
        console.log(`Game ${gameId} ended.`);
        games[gameId].Round.endCurrentRound();
    }
    const NextRound =gameId =>{
        games[gameId].Round.endCurrentRound();

        if(games[gameId].rounds.length > 3){
            endGame(gameId);
            return;
        }
        else{
            console.log(`Starting round ${games[gameId].rounds + 1} of game ${gameId}`);
            games[gameId].Round.startNewRound();
        }
    }
};

const endGame = (gameId) => {
    // Your logic to end the game
};

server.listen(port, () => console.log(`Listening on port ${port}`));
