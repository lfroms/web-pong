/*

	Author: Lukas Romsicki

	Desc: Server JavaScript File
	Func: This app provides data relay and storage of in-game statistics.

*/

let app = require('http').createServer(handler);
let io = require('socket.io')(app);
let fs = require('fs');
let url = require('url');

let ROOT_DIR = "public_html";

app.listen(3000);

let MIME_TYPES = {
    css: "text/css",
    gif: "image/gif",
    htm: "text/html",
    html: "text/html",
    ico: "image/x-icon",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    txt: "text/plain",
    svg: "image/svg+xml"
};

function getMime(filename) {
    let ext, type;

    for (ext in MIME_TYPES) {
        type = MIME_TYPES[ext];
        if (filename.indexOf(ext, filename.length - ext.length) !== -1) {
            return type;
        }
    }

    return MIME_TYPES["txt"];
};

function handler(req, res) {
    let urlObj = url.parse(req.url, true, false);

    if (req.method == "GET") {
        let filePath = ROOT_DIR + urlObj.pathname;

        if (urlObj.pathname === "/") filePath = ROOT_DIR + "/index.html";

        fs.readFile(filePath, function (err, data) {
            if (err) {
                res.writeHead(404);
                return res.end('Error loading data.');
            }

            res.writeHead(200, {
                "Content-Type": getMime(filePath)
            });
            res.end(data);
        });
    }
}

let playerLeftData = {
        name: null,
        hash: null,
        score: 0
    },
    playerRightData = {
        name: null,
        hash: null,
        score: 0
    };

io.on('connection', function (socket) {

    io.emit('playerRightData', playerRightData);
    io.emit('playerLeftData', playerLeftData);

    socket.on('ball', function (data) {
        socket.broadcast.emit('ball', data);
    });

    socket.on('player_left', function (data) {
        socket.broadcast.emit('player_left', data);
    });

    socket.on('player_right', function (data) {
        socket.broadcast.emit('player_right', data);
    });

    socket.on('playerRightData', function (data) {
        playerRightData.name = data.name;
        playerRightData.hash = data.hash;
        socket.broadcast.emit('playerRightData', playerRightData);

        if (playerLeftData.hash !== null &&
            playerLeftData.name !== null &&
            playerRightData.hash !== null &&
            playerRightData.name !== null) {
            io.emit('gameStart', true);
        }
    });

    socket.on('playerLeftData', function (data) {
        playerLeftData.name = data.name;
        playerLeftData.hash = data.hash;
        socket.broadcast.emit('playerLeftData', playerLeftData);

        if (playerLeftData.hash !== null &&
            playerLeftData.name !== null &&
            playerRightData.hash !== null &&
            playerRightData.name !== null) {
            io.emit('gameStart', true);
        }
    });

    socket.on('newUser', function (hash) {
        socket.hash = hash;
    });

    socket.on('disconnectPlayer', function (data) {
        if (playerLeftData.hash === socket.hash) {
            playerLeftData.hash = null;
            playerLeftData.name = null;

            io.emit('playerLeftData', playerLeftData);
            io.emit('playerRightData', playerRightData);
            io.emit('gameStart', false);
        }

        if (playerRightData.hash === socket.hash) {
            playerRightData.hash = null;
            playerRightData.name = null;

            io.emit('playerLeftData', playerLeftData);
            io.emit('playerRightData', playerRightData);
            io.emit('gameStart', false);
        }
    });

    socket.on('leftPoint', function (data) {
        playerLeftData.score += 1;
        io.emit('leftPoint', playerLeftData.score);
    });

    socket.on('rightPoint', function (data) {
        playerRightData.score += 1;
        io.emit('rightPoint', playerRightData.score);
    });

    socket.on('reset', function (data) {
        playerLeftData.score = 0;
        playerRightData.score = 0;

        socket.broadcast.emit('gameStart', false);

        io.emit('leftPoint', playerLeftData.score);
        io.emit('rightPoint', playerRightData.score);
    });

    socket.on('paddleHit', function () {
        socket.broadcast.emit('paddleHit');
    })

    socket.on('disconnect', function () {
        if (playerLeftData.hash === socket.hash) {
            playerLeftData.hash = null;
            playerLeftData.name = null;

            socket.broadcast.emit('playerLeftData', playerLeftData);
            socket.broadcast.emit('gameStart', false);
        }

        if (playerRightData.hash === socket.hash) {
            playerRightData.hash = null;
            playerRightData.name = null;

            socket.broadcast.emit('playerRightData', playerRightData);
            socket.broadcast.emit('gameStart', false);
        }
    });
});



console.log("Server running at http://127.0.0.1:3000.  Press CTRL+C to terminate.");
