document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    // Canvas setup
    const canvas = document.getElementById("mazeCanvas");
    if (!canvas) {
        console.error('Canvas element with id "mazeCanvas" not found.');
        return;
    }
    const ctx = canvas.getContext("2d");
    let cellSize;  // Adjust as needed
    let ballRadius;
    let endRadius ;
    let cols ;
    let rows  ;

    let generatedMaze;

    // Game state variables
    let player = null;
    let velocity = { x: 0, y: 0 };
    let acceleration = { x: 0, y: 0 };
    const friction = 0.8;
    let lastUpdate = Date.now();
    let end;
    let previous_positions = {};
    let sensitivity = 75;

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

    document.getElementById("playAgainButton").addEventListener("click", () => {
        socket.emit('startGame',player.gameId);
    })

    document.getElementById("next-round-button").addEventListener("click",() => {
        //console.log("next button clicked")
        socket.emit('next-round',player);
    })

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
        console.log(`New Players: `, JSON.stringify(data, null, 1));
        document.getElementById('joinSection').style.display = 'none';
        document.getElementById('waitingMessage').style.display = 'block';
    
        // Display the game ID at the top
        const gameIdDisplay = document.getElementById('gameIdDisplay');
        gameIdDisplay.innerText = `Game ID: `;
    
        // Clear the playersList section before updating
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
    
        // Display the list of players
        data.forEach(player => {
            // Create a new div for each player
            const playerDiv = document.createElement('div');
            //playerDiv.setAttribute('id', `player`); // Assign an ID to the player div
            playerDiv.textContent = player.name;
            playerDiv.style.backgroundColor = '#007bff';
            playerDiv.style.color = '#ffffff';
            playerDiv.style.margin = '10px 0';
            playerDiv.style.padding = '10px';
            playerDiv.style.border = '1px solid #ffffff';
            playerDiv.style.borderRadius = '3px';
    
            // Append the player div to the playersList
            playersList.appendChild(playerDiv);
        });
    
        document.getElementById('startSection').style.display = data.length >= 2 ? 'block' : 'none';
        document.getElementById('errorMessage').style.display = 'none';
    });
    
    
    

    socket.on("connect", () => {
        console.log('Connected to server');
    });

    socket.on("disconnect", () => {
        console.log('Disconnected from server');
    });

    socket.on('gameStart', (data) => {
        //console.log(`player data reveived from the server : `, JSON.stringify(data,null,2))
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

        document.getElementById('winner-container').style.display = 'none'
        document.getElementById('next-round-button').style.display = 'none'
        document.getElementById('winner').style.display = 'block';

        socket.on("game",game => {
            if(game.rounds){
                previousRoundData(game)
                if(game.rounds.length + 1 === 2){
                    sensitivity = 70;
                }
                else if(game.rounds.length + 1 === 3 ){
                    sensitivity = 60;
                }
            }
        })



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

    socket.on("sendMazeSize", (data) => {
        cellSize = data.cellSize; // Assign cellSize from the data received
        cols = Math.floor(canvas.width / data.cellSize);
        rows = Math.floor(canvas.height / data.cellSize);
        end = { x: canvas.width / 2, y: (rows * data.cellSize + data.cellSize) / 2 };
        ballRadius = data.cellSize / 6;
        endRadius = data.cellSize / 3;

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
        socket.on('playerFinished', (finishedPlayers) => {
            console.log('Event triggered'); // Debugging line to confirm event firing
        
            // Get the points table and winner container elements
            const pointsTable = document.querySelector('#winner');
            const nextRoundButton = document.getElementById('next-round-button');
            const winnerContainer = document.getElementById('winner-container');
        
            if (!pointsTable) {
                console.error('Points table element not found');
                return;
            }
            if (!nextRoundButton) {
                console.error('Next round button element not found');
                return;
            }
            if (!winnerContainer) {
                console.error('Winner container element not found');
                return;
            }
        
            // Clear the existing points table
            pointsTable.innerHTML = '';
        
            // Iterate through the finished players and create their cards
            finishedPlayers.forEach((player, index) => {
                let card = document.createElement("div");
                card.classList.add("points-card");
                card.classList.add(`card-${index + 1}`); // Use index + 1 to differentiate cards
        
                // Create the card's HTML content
                card.innerHTML = `
                    <h3>${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}</h3>
                    <p class="points">${player.score}<span> POINTS</span></p>
                    <ul>
                        <li>Name: ${player.name}</li>
                        <li>Game ID: ${player.gameId}</li>
                    </ul>
                `;
        
                // Append the card to the points table
                pointsTable.appendChild(card);
            });
        
            // Show the winner container and next round button
            winnerContainer.style.display = 'flex';
            nextRoundButton.style.display = 'block';
            pointsTable.style.display = 'flex';
        });

        socket.on('gameEnd', (player) => {
            // Show the game over message
            document.getElementById('gameOverMessage').style.display = 'block';
            document.getElementById('gameOverMessage').textContent = `Game Over!`;

            document.getElementById("playAgainButton").style.display = 'block';
            document.getElementById("next-round-button").style.display = 'none'
        });

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
    let bouncefactor = 1;

    if (newX < 0 || newX >= cols || newY < 0 || newY >= rows) {
        return { newX: player.x, newY: player.y };
    }

    // Horizontal wall collisions
    if (velocity.x > 0) {
        if (generatedMaze[cellX][cellY].walls.right && (newX + ballRadius / cellSize) > (cellX + 1)) {
            newX = cellX + 1 - ballRadius / cellSize;
            velocity.x = -velocity.x * bouncefactor; // Reverse horizontal velocity
        }
    }
    else if (velocity.x < 0) {
        if (generatedMaze[cellX][cellY].walls.left && (newX - ballRadius / cellSize) < cellX) {
            newX = cellX + ballRadius / cellSize;
            velocity.x = -velocity.x * bouncefactor; // Reverse horizontal velocity
        }
    }

    // Vertical wall collisions
    if (velocity.y > 0) {
        if (generatedMaze[cellX][cellY].walls.bottom && (newY + ballRadius / cellSize) > (cellY + 1)) {
            newY = cellY + 1 - ballRadius / cellSize;
            velocity.y = -velocity.y * bouncefactor; // Reverse vertical velocity
        }
    }
    else if (velocity.y < 0) {
        if (generatedMaze[cellX][cellY].walls.top && (newY - ballRadius / cellSize) < cellY) {
            newY = cellY + ballRadius / cellSize;
            velocity.y = -velocity.y *bouncefactor; // Reverse vertical velocity
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
            if (!player.hasReachedEnd) {
                //socket.emit('declareWinner', player);
                document.getElementById('mazeCanvas').style.display = 'none';
                document.getElementById('ball').style.display = 'none';
                //Emits a message to the sever when the player reached the end point
                socket.emit("hasFinished",player)

                //document.getElementById('winner').style.display = 'flex';
                player.hasReachedEnd = true;
            }
        }
    }
    let prev;
    //let previousEndPoint = { x: null, y: null };
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
        ctx.fillStyle = 'black';
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
    const previousRoundData = (game) => {
        const canvas = document.getElementById("ball");
        const ctx = canvas.getContext("2d");
        //clear previouse endpoint
        ctx.clearRect(
            previousEndPoint.x - endRadius - 1,
            previousEndPoint.y - endRadius - 1,
            endRadius * 2 + 2,
            endRadius * 2 + 2
        );


    }
    function isIOS() {
        // Check if the user agent contains 'iPhone', 'iPad', or 'iPod'
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    function requestPermission() {
        // Attempt to request device orientation permission
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ and later
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        console.log('Device orientation permission granted');
                        // Start using device orientation data here
                    } else {
                        console.error('Device orientation permission denied');
                    }
                })
                .catch(error => {
                    console.error('Error requesting device orientation permission:', error);
                });
        } else {
            // For non-iOS devices or older iOS versions
            console.log('Device orientation permission is not required');
            // Start using device orientation data here
        }
    }

    if (isIOS()) {
        // Show the permission button if on iOS
        document.getElementById('permissionButton').style.display = 'block';

        // Add click event listener to the button
        document.getElementById('permissionButton').addEventListener('click', () => {
            requestPermission();
        });
    }

    // Gyroscope data handling
    window.addEventListener('deviceorientation', (event) => {
        acceleration.x = event.gamma / sensitivity; // Adjust sensitivity as needed
        acceleration.y = event.beta / sensitivity;  // Adjust sensitivity as needed
    });
});
