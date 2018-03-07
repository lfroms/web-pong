'use strict';

/*

	Author: Lukas Romsicki

	Desc: Client JavaScript File
	Func: This app provides in-game logic and server-client data transfer.

*/

(function () {
    let socket = io();
    let canvas = document.getElementById("game-view");

    // Set up canvas for use with HiDPI screens (4x scale down)
    canvas.width = 1400;
    canvas.height = 840;
    canvas.style.width = "700px";
    canvas.style.height = "420px";

    let context = canvas.getContext("2d");
    context.scale(4, 4);

    // Calculate width and height of canvas for rendering
    let canvasH = canvas.height / 4;
    let canvasW = canvas.width / 4;

    // GLOBAL DEFAULTS
    let paddleWidth = 6;
    let paddleHeight = 50;

    let mouseY = canvasH / 2;
    let pLeftY = canvasH / 2 - (paddleHeight / 2),
        pRightY = canvasH / 2 - (paddleHeight / 2),
        ballX = (canvasW / 2) + 20,
        ballY = canvasH / 2;

    let ballVel = 3;

    // SESSION DEFAULTS
    let isPlayerRight = false,
        isPlayerLeft = false;

    let playerName = "User";

    let leftScore = 0,
        rightScore = 0;

    // For delay between points and matching players
    let gameStart = false,
        gameRun = false;

    // Load SFX
    let hit = new Audio("../audio/hit.wav");
    let point = new Audio("../audio/point.wav");

    // Prompt the user for a name, if they want one
    $.confirm({
        title: 'Enter Name',
        draggable: false,
        boxWidth: '300px',
        useBootstrap: false,
        type: 'red',
        theme: 'dark',
        content: '' +
            '<form action="" class="nameForm">' +
            '<div class="form-group">' +
            '<input type="text" placeholder="User" class="name form-control" />' +
            '</div>' +
            '<span class="small">If no name is provided, "User" will be used.</span>' +
            '</form>',
        buttons: {
            formSubmit: {
                text: 'OK',
                action: function () {
                    var name = this.$content.find('.name').val();
                    // If no name, go with a default "User"
                    if (!name) {
                        playerName = "User";
                    } else {
                        playerName = name;
                    }
                }
            },
        },
        onContentReady: function () {
            var jc = this;
            this.$content.find('form').on('submit', function (e) {
                e.preventDefault();
                jc.$$formSubmit.trigger('click');
            });
        }
    });

    // Generate a new timestamp hash for the user's connection and emit it
    let playerHash = hash.newHash();
    socket.emit('newUser', playerHash);

    // Create the animator
    let animate = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60)
        };

    // Begin drawing recursion
    animate(draw);


    // Generate the gameplay objects
    let playerRight = new RightPlayer();
    let playerLeft = new LeftPlayer();

    let ball = new Ball((canvasW / 2) + 20, canvasH / 2);

    /* Mouse Move Functionality

    $(window).mousemove(function (e) {
        let rect = canvas.getBoundingClientRect();
        let scaleY = canvasH / rect.height;

        if (e.clientY > rect.top && e.clientY < rect.bottom) {
            mouseY = (e.clientY - rect.top) * scaleY;
        }

        if (isPlayerRight) socket.emit('player_right', playerRight);
        if (isPlayerLeft) socket.emit('player_left', playerLeft);
    });
    
    */

    // Global draw function (no logic)
    function draw() {
        context.fillStyle = "#000000";
        context.fillRect(0, 0, canvasW, canvasH);

        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.setLineDash([5.52, 3]);
        context.beginPath();
        context.moveTo(canvasW / 2, 0);
        context.lineTo(canvasW / 2, canvasH);
        context.stroke();

        playerRight.draw();
        playerLeft.draw();
        ball.draw();

        // Recurse drawing
        animate(draw);
    }

    // Determine if data should be sent or recieved, or both depending on which player
    if (isPlayerRight) {
        socket.on('player_left', function (data) {
            pLeftY = data;
        });
    }

    if (isPlayerLeft) {
        socket.on('player_right', function (data) {
            pRightY = data;
        });

        socket.on('ball', function (data) {
            let recievedData = JSON.parse(data);
            ballX = recievedData.x;
            ballY = recievedData.y;
        });
    }

    if (!isPlayerLeft && !isPlayerRight) {
        // I'm a spectator
        socket.on('player_left', function (data) {
            pLeftY = data;
        });

        socket.on('player_right', function (data) {
            pRightY = data;
        });

        socket.on('ball', function (data) {
            let recievedData = JSON.parse(data);
            ballX = recievedData.x;
            ballY = recievedData.y;
        });
    }

    // Generic paddle object definition.

    function Paddle(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    Paddle.prototype.draw = function () {
        context.fillStyle = "#ffffff";
        context.fillRect(this.x, this.y, this.width, this.height);
    }

    // Local and Remote player object definition.

    function RightPlayer() {
        this.paddle = new Paddle(canvasW - 12, (canvasH / 2) - (paddleHeight / 2), paddleWidth, paddleHeight);
    }

    RightPlayer.prototype.draw = function () {
        this.paddle.draw();

        if (isPlayerRight) pRightY = movePaddle(this.paddle.y);
        updateLocation();

        this.paddle.y = pRightY;
    }

    function LeftPlayer() {
        this.paddle = new Paddle(12 - paddleWidth, (canvasH / 2) - (paddleHeight / 2), paddleWidth, paddleHeight);
    }

    LeftPlayer.prototype.draw = function () {
        this.paddle.draw();

        if (isPlayerLeft) pLeftY = movePaddle(this.paddle.y);
        updateLocation();

        this.paddle.y = pLeftY;
    }

    // Ball object definition.

    function Ball(x, y) {
        this.x = x;
        this.y = y;
        this.xVel = ballVel;
        this.yVel = 3;
        this.radius = 6;
    }

    Ball.prototype.draw = function () {
        if (isPlayerRight && gameStart && gameRun) {
            this.x += this.xVel;
            this.y += this.yVel;
            ballCheckBoundary(this, playerLeft.paddle, playerRight.paddle);

            // Emit my location to all other players
            socket.emit('ball', JSON.stringify({
                x: this.x,
                y: this.y
            }));
        } else {
            this.x = ballX;
            this.y = ballY;
        }

        context.beginPath();
        context.arc(this.x, this.y, this.radius, 2 * Math.PI, false);
        context.fillStyle = "#ffffff";
        context.fill();
    };

    // Function for checking collisions and detecting points
    function ballCheckBoundary(ballObject, left_player, right_player) {
        if (ballObject.x - 6 < 0 || ballObject.x + 6 > canvasW) {
            pointScored(ballObject);

            ballObject.x = ballX;
            ballObject.y = canvasH / 2;
            ballObject.xVel = ballVel;
        }

        if (ballObject.x - 6 < left_player.x + paddleWidth &&
            ballObject.y + 4 > left_player.y && ballObject.y - 4 < left_player.y + paddleHeight) {
            ballObject.x = 12 + paddleWidth;
            ballObject.xVel = -ballObject.xVel;

            hit.play();
            socket.emit('paddleHit');

        } else if (ballObject.x + 6 > right_player.x &&
            ballObject.y + 4 > right_player.y && ballObject.y - 4 < right_player.y + paddleHeight) {
            ballObject.x = canvasW - 18;
            ballObject.xVel = -ballObject.xVel;

            hit.play();
            socket.emit('paddleHit');

        } else if (ballObject.y - 6 < 0) {
            ballObject.y = 6;
            ballObject.yVel = -ballObject.yVel;

        } else if (ballObject.y + 6 > canvasH) {
            ballObject.y = canvasH - 6;
            ballObject.yVel = -ballObject.yVel;
        }
    }

    // Other clients should also play sound effects
    socket.on('paddleHit', function () {
        hit.play();
    });

    // SCOREKEEPING

    function pointScored(ballObject) {
        if (ballObject.x - 6 < 0) {
            socket.emit('rightPoint');
            ballX = (canvasW / 2) + 20;
            ballVel = 3;
        }
        if (ballObject.x + 6 > canvasW) {
            socket.emit('leftPoint');
            ballX = (canvasW / 2) - 20;
            ballVel = -3;
        }

        // Pause then resume the game after 1.5s
        gameRun = false;

        setTimeout(() => {
            gameRun = true;
        }, 1500);
    }

    // Update scores if necessary
    socket.on('leftPoint', function (score) {
        leftScore = score;
        point.play();

        $("#leftScore").html(score.toString());
    });

    socket.on('rightPoint', function (score) {
        rightScore = score;
        point.play();

        $("#rightScore").html(score.toString());
    });

    // Reset everything if a player disconnects or leaves
    function reset() {
        leftScore = 0;
        rightScore = 0;

        $("#rightScore").html(rightScore.toString());
        $("#leftScore").html(leftScore.toString());

        socket.emit('reset');
    }

    // UI FUNCTIONS (button flip-flop)

    $("#playAsRight").click(function () {

        if (isPlayerRight) {
            $("#playAsRight").removeClass("active");
            isPlayerRight = false;

            socket.emit('disconnectPlayer');
        } else {

            if (!isPlayerLeft) {
                isPlayerRight = true;
                this.innerHTML = playerName;
                this.disabled = false;

                reset();

                $("#playAsLeft").prop('disabled', true);
                $("#playAsRight").addClass("active");

                socket.emit('playerRightData', {
                    name: playerName,
                    hash: playerHash,
                    score: 0
                });
            }
        }
    });

    $("#playAsLeft").click(function () {

        if (isPlayerLeft) {
            $("#playAsLeft").removeClass("active");
            isPlayerLeft = false;

            socket.emit('disconnectPlayer');
        } else {

            if (!isPlayerRight) {
                isPlayerLeft = true;
                this.innerHTML = playerName;
                this.disabled = false;

                reset();

                $("#playAsRight").prop('disabled', true);
                $("#playAsLeft").addClass("active");

                socket.emit('playerLeftData', {
                    name: playerName,
                    hash: playerHash,
                    score: 0
                });
            }
        }
    });

    // Update controls every time we recieve new data about players (disable/enable)
    socket.on('playerRightData', function (data) {
        if (data.hash !== null) {
            $("#playAsRight").html(data.name);
            if (!isPlayerRight) $("#playAsRight").prop('disabled', true);
        } else {
            $("#playAsRight").html("Play Right");
            $("#playAsRight").prop('disabled', false);
        }

        if (isPlayerLeft) $("#playAsRight").prop('disabled', true);
    });

    socket.on('playerLeftData', function (data) {
        if (data.hash !== null) {
            $("#playAsLeft").html(data.name);
            if (!isPlayerLeft) $("#playAsLeft").prop('disabled', true);
        } else {
            $("#playAsLeft").html("Play Left");
            $("#playAsLeft").prop('disabled', false);
        }

        if (isPlayerRight) $("#playAsLeft").prop('disabled', true);
    });

    // KEYBOARD CONTROL

    let keysPressed = {};
    const UP_ARROW = 38;
    const DOWN_ARROW = 40;

    $(window).keydown(function (e) {
        if (e.which == UP_ARROW || e.which == DOWN_ARROW) {
            keysPressed[e.which] = true;
        }
    });

    $(window).keyup(function (e) {
        if (e.which == UP_ARROW || e.which == DOWN_ARROW) {
            keysPressed[e.which] = false;
        }
    });

    function updateLocation() {
        if (keysPressed[UP_ARROW] || keysPressed[DOWN_ARROW]) {
            if (isPlayerRight) socket.emit('player_right', pRightY);
            if (isPlayerLeft) socket.emit('player_left', pLeftY);
        }
    }

    function movePaddle(yPos) {
        const dXY = 5;

        if (keysPressed[UP_ARROW] && yPos - dXY >= 0) {
            yPos -= dXY;
        }

        if (keysPressed[DOWN_ARROW] && yPos + paddleHeight + dXY <= canvasH) {
            yPos += dXY;
        }

        return yPos;
    }

    // GAME RUNTIME MODES

    socket.on('gameStart', function (data) {
        if (data === true) {
            gameStart = true;
            gameRun = true;
        } else {
            gameStart = false;
            pLeftY = canvasH / 2 - (paddleHeight / 2);
            pRightY = canvasH / 2 - (paddleHeight / 2);
            ballX = (canvasW / 2) + 20;
            ballY = canvasH / 2;
        }
    });
})();
