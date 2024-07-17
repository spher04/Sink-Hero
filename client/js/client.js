document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    let player = {}; // Player object to store current player data
    let generatedMaze; // Variable to store generated maze data
    const canvas = document.getElementById("mazeCanvas");
    const ballCanvas = document.getElementById("ballCanvas");
    const ctx = canvas.getContext("2d");
    const ballCtx = ballCanvas.getContext("2d");
    const cellSize = 30;
    const ballRadius = 10;
    const endRadius = 20;
    const cols = Math.floor(canvas.width / cellSize);
    const rows = Math.floor(canvas.height / cellSize);
    let hasWon = false;
    let acceleration = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };
    let lastUpdate = Date.now();
    let previous_positions = {};

    // Function to draw maze walls
    const drawMaze = () => {
        if (!generatedMaze) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        generatedMaze.forEach(row => {
            row.forEach(cell => {
                drawCellWalls(cell);
            });
        });
    };

    // Function to draw walls of each cell
    const drawCellWalls = (cell) => {
        const x = cell.x * cellSize;
        const y = cell.y * cellSize;

        ctx.beginPath();
        if (cell.walls.top) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cellSize, y);
        }
        if (cell.walls.right) {
            ctx.moveTo(x + cellSize, y);
            ctx.lineTo(x + cellSize, y + cellSize);
        }
        if (cell.walls.bottom) {
            ctx.moveTo(x + cellSize, y + cellSize);
            ctx.lineTo(x, y + cellSize);
        }
        if (cell.walls.left) {
            ctx.moveTo(x, y + cellSize);
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.stroke();
    };

    // Event listener for joining a game
    document.getElementById("joinGame").addEventListener("click", () => {
        const name = document.getElementById("username").value.trim();
        const gameId = document.getElementById("gameId").value.trim();
        if (name && gameId) {
            socket.emit("joinGame", { username: name, gameId: gameId });
        } else {
            document.getElementById("errorMessage").textContent = "Please enter both Game ID and Username";
        }
    });

    // Event listener for becoming a host
    document.getElementById("becomeHost").addEventListener("click", () => {
        const gameId = document.getElementById("gameId").value.trim();
        socket.emit("becomeHost", { gameId: gameId });
    });

    // Event listener for starting the game
    document.getElementById("startGame").addEventListener("click", () => {
        const gameId = document.getElementById("gameId").value.trim();
        socket.emit("startGame", gameId);
    });

    // Event listener for game state updates
    socket.on("gameStateUpdate", (gameState) => {
        console.log('Received game state update:', gameState);
        document.getElementById("gameState").textContent = JSON.stringify(gameState, null, 2);
    });

    // Event listener for when the game starts
    socket.on('gameStart', (data) => {
        document.getElementById('popup').style.display = 'none';
        document.getElementById('joinSection').style.display = 'none';
        document.getElementById('startSection').style.display = 'none';
        document.getElementById('waitingMessage').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('mazeCanvas').style.display = 'block';
        player = data;
    });

    // Event listener for receiving the maze layout from the server
    socket.on('sendMaze', (maze) => {
        console.log('Maze received from server');
        generatedMaze = maze;
        drawMaze();
    });

    // Event listener for player position changes
    socket.on("playerPositionChangedHost", (data) => {
        ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

        // Draw the player's ball at the new position
        ballCtx.beginPath();
        ballCtx.arc(data.x * cellSize, data.y * cellSize, ballRadius, 0, 2 * Math.PI);
        ballCtx.fillStyle = data.colour;
        ballCtx.fill();

        previous_positions[data.playerId] = { x: data.x * cellSize, y: data.y * cellSize };
    });

    // Event listener for connection to the server
    socket.on("connect", () => {
        console.log('Connected to server');
    });

    // Event listener for disconnection from the server
    socket.on("disconnect", () => {
        console.log('Disconnected from server');
    });

    // Function to check for collisions
    function checkCollisions(newX, newY) {
        const cellX = Math.floor(newX / cellSize);
        const cellY = Math.floor(newY / cellSize);

        // Check for collisions with maze boundaries
        if (newX < 0 || newX >= canvas.width || newY < 0 || newY >= canvas.height) {
            return { newX: player.x, newY: player.y };
        }

        // Check for collisions with cell walls
        if (velocity.x > 0) {
            if (generatedMaze[cellY][cellX].walls.right && (newX + ballRadius) > (cellX + 1) * cellSize) {
                newX = (cellX + 1) * cellSize - ballRadius;
                velocity.x = 0;
            }
        }

        if (velocity.x < 0) {
            if (generatedMaze[cellY][cellX].walls.left && (newX - ballRadius) < cellX * cellSize) {
                newX = cellX * cellSize + ballRadius;
                velocity.x = 0;
            }
        }

        if (velocity.y > 0) {
            if (generatedMaze[cellY][cellX].walls.bottom && (newY + ballRadius) > (cellY + 1) * cellSize) {
                newY = (cellY + 1) * cellSize - ballRadius;
                velocity.y = 0;
            }
        }

        if (velocity.y < 0) {
            if (generatedMaze[cellY][cellX].walls.top && (newY - ballRadius) < cellY * cellSize) {
                newY = cellY * cellSize + ballRadius;
                velocity.y = 0;
            }
        }

        return { newX, newY };
    }

    // Function to update ball position
    function updateBallPosition() {
        const now = Date.now();
        const deltaTime = (now - lastUpdate) / 1000; // Time in seconds
        lastUpdate = now;

        // Update velocity based on acceleration
        velocity.x += acceleration.x * deltaTime;
        velocity.y += acceleration.y * deltaTime;

        // Apply friction
        velocity.x *= 0.98;
        velocity.y *= 0.98;

        // Calculate new ball position
        let newX = player.x + velocity.x;
        let newY = player.y + velocity.y;

        // Check for collisions and correct position if necessary
        const correctedPosition = checkCollisions(newX, newY);
        newX = correctedPosition.newX;
        newY = correctedPosition.newY;

        // Update player position
        player.x = newX;
        player.y = newY;

        // Check if player reached the end goal
        if (Math.abs((player.x * cellSize) - (canvas.width / 2)) <= endRadius && Math.abs((player.y * cellSize) - (canvas.height / 2)) <= endRadius) {
            if (!hasWon) {
                hasWon = true;
                // Emit event to server for win condition
                socket.emit("playerWon", { playerId: player.playerId });
            }
        }

        // Clear the canvas and redraw the ball
        ballCtx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);
        drawMaze();

        // Draw the ball
        ballCtx.beginPath();
        ballCtx.arc(player.x * cellSize, player.y * cellSize, ballRadius, 0, 2 * Math.PI);
        ballCtx.fillStyle = player.color;
        ballCtx.fill();
    }

    // Event listener for device orientation changes
    window.addEventListener("deviceorientation", (event) => {
        const tiltX = event.beta; // Front-to-back tilt in degrees
        const tiltY = event.gamma; // Left-to-right tilt in degrees

        // Convert tilt to acceleration
        acceleration.x = tiltY * 0.001;
        acceleration.y = tiltX * 0.001;
    });

    // Start the update loop
    setInterval(updateBallPosition, 1000 / 60);
});
