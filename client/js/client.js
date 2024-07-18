document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    // Canvas setup
    const canvas = document.getElementById("mazeCanvas");
    if (!canvas) {
        console.error('Canvas element with id "mazeCanvas" not found.');
        return;
    }
    const ctx = canvas.getContext("2d");
    const cellSize = 60;  // Adjust as needed
    const ballRadius = cellSize / 6;
    const endRadius = cellSize / 3;
    const cols = Math.floor(canvas.width / cellSize);
    const rows = Math.floor(canvas.height / cellSize);

    let generatedMaze;

    // Game state variables
    let player = null;
    let velocity = { x: 0, y: 0 };
    let acceleration = { x: 0, y: 0 };
    const friction = 0.9;
    let lastUpdate = Date.now();
    let end = { x: canvas.width / 2, y: (rows * cellSize + cellSize) / 2 };
    let previous_positions = {};

    // Event listeners for buttons
    document.getElementById("joinGame").addEventListener("click", () => {
        const name = document.getElementById("username").value.trim();
        const gameId = document.getElementById("gameId").value.trim();
        if (name && gameId) {
            socket.emit("joinGame", { username: name, gameId: gameId });
        } else {
            document.getElementById("errorMessage").textContent = "Please enter both Game ID and Username";
        }
        
        
    });
    socket.on("error", (message) => {	
        document.getElementById("errorMessage").textContent = JSON.stringify(message.message,null,2);	;
    })

    document.getElementById("becomeHost").addEventListener("click", () => {
        const gameId = document.getElementById("gameId").value.trim();
        socket.emit("becomeHost", { gameId: gameId });
    });

    document.getElementById("startGame").addEventListener("click", () => {
        const gameId = document.getElementById("gameId").value.trim();
        socket.emit("startGame", gameId);
    });

    // Socket events
    socket.on("gameStateUpdate", (gameState) => {
        console.log('Received game state update:', gameState);
        document.getElementById("gameState").textContent = JSON.stringify(gameState, null, 1);
    });

    socket.on("gameFull", () => {
        console.log('Game is full');
        alert('Game is full');
    });

    socket.on('waiting', (data) => {
        document.getElementById('joinSection').style.display = 'none';
        document.getElementById('waitingMessage').style.display = '';
        document.getElementById('waitingMessage').innerText = `Waiting for more players... (${data.playersCount}/4)`;
        document.getElementById('startSection').style.display = data.playersCount >= 2 ? 'block' : 'none';
        document.getElementById('errorMessage').style.display = 'none';
    });

    socket.on("connect", () => {
        console.log('Connected to server');
    });

    socket.on("disconnect", () => {
        console.log('Disconnected from server');
    });

    socket.on('gameStart', (data) => {
        console.log(`player data reveived from the server : `, JSON.stringify(data,null,2))
        // Hide UI elements and display game canvas
        document.getElementById('popup').style.display = 'none';
        document.getElementById('gameInfo').setAttribute('data-game-id', data.gameId);
        document.getElementById('gameInfo').setAttribute('data-player-id', data.playerId);
        document.getElementById('joinSection').style.display = 'none';
        document.getElementById('startSection').style.display = 'none';
        document.getElementById('waitingMessage').style.display = 'none';
        document.getElementById('errorMessage').style.display = 'none';
        document.getElementById('mazeCanvas').style.display = 'block';
        document.getElementById('ball').style.display = 'block';

        player = data; // Set player data
        requestAnimationFrame(animate); // Start animation loop
    });
    socket.on("playerPositionChanged", (data) => {
        console.log(`position of player with player id ${data.name} received`);
        let canvas = document.getElementById("ball");
        let ctx = canvas.getContext("2d");

        // Clear previous position
        
        let previous_position = previous_positions[data.playerId];
        if (previous_position) {
            ctx.clearRect(previous_position.x - 11, previous_position.y - 11, 22, 22);
        }

        // Draw current position
        ctx.beginPath();
        ctx.arc(data.x * 60, data.y * 60, 10, 0, 2 * Math.PI);
        ctx.fillStyle = data.colour;
        ctx.fill();

        // Store current position for next update
        //console.log(`The player is:` ,JSON.stringify(player,null,2) )
        previous_positions[data.playerId] = { x: data.x * 60, y: data.y * 60 };
    });



    socket.on('sendMaze', (maze) => {
        console.log('Maze received from server');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw maze walls
        const drawCellWalls = (cell) => {
            const x = cell.x * cell.cellSize;
            const y = cell.y * cell.cellSize;

            ctx.beginPath();
            if (cell.walls.top) {
                ctx.moveTo(x, y);
                ctx.lineTo(x + cell.cellSize, y);
            }
            if (cell.walls.right) {
                ctx.moveTo(x + cell.cellSize, y);
                ctx.lineTo(x + cell.cellSize, y + cell.cellSize);
            }
            if (cell.walls.bottom) {
                ctx.moveTo(x + cell.cellSize, y + cell.cellSize);
                ctx.lineTo(x, y + cell.cellSize);
            }
            if (cell.walls.left) {
                ctx.moveTo(x, y + cell.cellSize);
                ctx.lineTo(x, y);
            }
            
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.stroke();
        };

        // Draw each cell's walls
        for (let i = 0; i < maze.length; i++) {
            for (let j = 0; j < maze[i].length; j++) {
                drawCellWalls(maze[i][j]);
            }
        }
        generatedMaze = maze;
    });

    // Function to check collisions with maze walls
    function checkCollisions(newX, newY) {
    const cellX = Math.floor(newX);
    const cellY = Math.floor(newY);

    if (newX < 0 || newX >= cols || newY < 0 || newY >= rows) {
        return { newX: player.x, newY: player.y };
    }

    // Horizontal wall collisions
    if (velocity.x > 0) {
        if (generatedMaze[cellX][cellY].walls.right && (newX + ballRadius / cellSize) > (cellX + 1)) {
            newX = cellX + 1 - ballRadius / cellSize;
            velocity.x = -velocity.x; // Reverse horizontal velocity
        }
    }
    else if (velocity.x < 0) {
        if (generatedMaze[cellX][cellY].walls.left && (newX - ballRadius / cellSize) < cellX) {
            newX = cellX + ballRadius / cellSize;
            velocity.x = -velocity.x; // Reverse horizontal velocity
        }
    }

    // Vertical wall collisions
    if (velocity.y > 0) {
        if (generatedMaze[cellX][cellY].walls.bottom && (newY + ballRadius / cellSize) > (cellY + 1)) {
            newY = cellY + 1 - ballRadius / cellSize;
            velocity.y = -velocity.y; // Reverse vertical velocity
        }
    }
    else if (velocity.y < 0) {
        if (generatedMaze[cellX][cellY].walls.top && (newY - ballRadius / cellSize) < cellY) {
            newY = cellY + ballRadius / cellSize;
            velocity.y = -velocity.y; // Reverse vertical velocity
        }
    }

    return { newX, newY };
}


    // Function to update ball's position based on physics
    function updateBallPosition() {
        const now = Date.now();
        const deltaTime = (now - lastUpdate) / 1000; // Time in seconds
        lastUpdate = now;

        velocity.x += acceleration.x * deltaTime;
        velocity.y += acceleration.y * deltaTime;

        velocity.x *= friction;
        velocity.y *= friction;

        let newX = player.x + velocity.x;
        let newY = player.y + velocity.y;

        const correctedPosition = checkCollisions(newX, newY);
        newX = correctedPosition.newX;
        newY = correctedPosition.newY;

        player.x = newX;
        player.y = newY;

        // Check if player reached the end point
        if (Math.abs((player.x * cellSize) - end.x) <= endRadius && Math.abs((player.y * cellSize) - end.y) <= endRadius) {
            if (!hasWon) {
                socket.emit('declareWinner', player);
                document.getElementById('maze').style.display = 'none';
                document.getElementById('ball').style.display = 'none';

                document.getElementById('winner').style.display = 'flex';
                hasWon = true;
            }
        }
    }
    let prev;

    // Function to draw ball on canvas
    function drawBall() {
        let canvas = document.getElementById("ball");
        const ctx = canvas.getContext("2d");

        if (prev)
            ctx.clearRect(prev.x - 11, prev.y - 11, 22, 22);

        const ballPosX = player.x * cellSize;
        const ballPosY = player.y * cellSize;

        // Draw end point
        ctx.beginPath();
        ctx.arc(end.x, end.y, endRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'gold';
        ctx.fill();
        ctx.closePath();

        // Draw player's ball
        ctx.beginPath();
        ctx.arc(ballPosX, ballPosY, ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = player.colour;
        ctx.fill();
        ctx.closePath();

        prev = { x: ballPosX, y: ballPosY };
    }
    // Animation loop
    function animate() {
        updateBallPosition();
        drawBall();
        //renderEndpoint()

        socket.emit("playerPositionChanged", player); // Send player position to server
        //console.log(player);
        requestAnimationFrame(animate); // Request next frame
    }

    // Gyroscope data handling
    window.addEventListener('deviceorientation', (event) => {
        acceleration.x = event.gamma / 40; // Adjust sensitivity as needed
        acceleration.y = event.beta / 85;  // Adjust sensitivity as needed
    });
});
