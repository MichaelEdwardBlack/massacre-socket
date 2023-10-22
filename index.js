import { Server } from "socket.io";
import { collissionsMap } from "./collisions.js";
import { Boundary } from "./Boundary.js";
const TICK_RATE = 15;
const BASE_MOVE_SPEED = 3;
const BASE_PROJECTILE_SPEED = 5;
const PROJECTILE_RADIUS = 5;
const PLAYER_RADIUS = 10;

const io = new Server({
  cors: {
    origin: "http://localhost:3000",
  },
  pingInterval: 2000,
  pingTimeout: 5000,
});

const boundaries = [];
collissionsMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol != 0) {
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width,
            y: i * Boundary.height,
          },
        })
      );
    }
  });
});

const backendPlayers = {};
const backendProjectiles = {};
const devicePixelRatios = {};
let projectileId = 0;

function rectangularCollision({ r1, r2 }) {
  return (
    r1.position.x + r1.width >= r2.position.x &&
    r1.position.x <= r2.position.x + r2.width &&
    r1.position.y <= r2.position.y + r2.height &&
    r1.position.y + r1.height >= r2.position.y
  );
}

// Game Clock
setInterval(() => {
  for (const id in backendProjectiles) {
    backendProjectiles[id].x += backendProjectiles[id].velocity.x;
    backendProjectiles[id].y += backendProjectiles[id].velocity.y;

    const backendPlayerOfProjectile = backendPlayers[backendProjectiles[id].playerId];
    if (
      backendProjectiles[id].x - PROJECTILE_RADIUS >=
        backendPlayerOfProjectile.x + backendPlayerOfProjectile?.canvas?.width / 2 ||
      backendProjectiles[id].x + PROJECTILE_RADIUS <=
        backendPlayerOfProjectile.x - backendPlayerOfProjectile?.canvas?.width / 2 ||
      backendProjectiles[id].y - PROJECTILE_RADIUS >=
        backendPlayerOfProjectile.y + backendPlayerOfProjectile?.canvas?.height / 2 ||
      backendProjectiles[id].y + PROJECTILE_RADIUS <=
        backendPlayerOfProjectile.y - backendPlayerOfProjectile?.canvas?.height / 2
    ) {
      delete backendProjectiles[id];
      continue;
    }

    for (const playerId in backendPlayers) {
      const backendPlayer = backendPlayers[playerId];
      const distance = Math.hypot(
        backendProjectiles[id].x - backendPlayer.x,
        backendProjectiles[id].y - backendPlayer.y
      );
      if (
        backendProjectiles[id].playerId !== playerId &&
        distance < backendProjectiles[id].radius + backendPlayer.radius
      ) {
        backendPlayers[backendProjectiles[id].playerId].score++;
        delete backendProjectiles[id];
        delete backendPlayers[playerId];
        break;
      }
    }
  }
  io.emit("updatePlayers", backendPlayers);
  io.emit("updateProjectiles", backendProjectiles);
}, TICK_RATE);

const movePlayer = ({ id, dx = 0, dy = 0 }) => {
  const player = backendPlayers[id];
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    const futurePosition = {
      position: { x: player.x + dx, y: player.y + dy },
      height: 64,
      width: 64,
    };
    if (
      rectangularCollision({
        r1: futurePosition,
        r2: boundary,
      })
    ) {
      return;
    }
  }
  backendPlayers[id].x += dx;
  backendPlayers[id].y += dy;
};

io.on("connection", (socket) => {
  console.log("connection", socket.id);
  backendPlayers[socket.id] = {
    id: socket.id,
    x: 500 + 500 * Math.random(),
    y: 300 + 500 * Math.random(),
    color: `hsl(${360 * Math.random()}, 100%, 50%)`,
    radius: PLAYER_RADIUS,
    sequenceNumber: 0,
    score: 0,
  };

  io.emit("updatePlayers", backendPlayers);

  socket.on("initCanvas", ({ width, height, devicePixelRatio, username }) => {
    backendPlayers[socket.id].canvas = { width, height };
    const pixelRatio = devicePixelRatio > 1 ? 2 : 1;
    backendPlayers[socket.id].radius = PLAYER_RADIUS * pixelRatio;
    devicePixelRatios[socket.id] = pixelRatio;
    backendPlayers[socket.id].name = username ?? socket.id;
  });

  socket.on("keydown", ({ key, sequenceNumber }) => {
    backendPlayers[socket.id].sequenceNumber = sequenceNumber;
    switch (key) {
      case "w":
        movePlayer({ id: socket.id, dy: -BASE_MOVE_SPEED });
        // backendPlayers[socket.id].y -= BASE_MOVE_SPEED;
        break;
      case "a":
        movePlayer({ id: socket.id, dx: -BASE_MOVE_SPEED });
        // backendPlayers[socket.id].x -= BASE_MOVE_SPEED;
        break;
      case "s":
        movePlayer({ id: socket.id, dy: BASE_MOVE_SPEED });
        // backendPlayers[socket.id].y += BASE_MOVE_SPEED;
        break;
      case "d":
        movePlayer({ id: socket.id, dx: BASE_MOVE_SPEED });
        // backendPlayers[socket.id].x += BASE_MOVE_SPEED;
        break;
      default:
        break;
    }
  });

  socket.on("shoot", ({ x, y, angle }) => {
    projectileId++;
    const velocity = {
      x: Math.cos(angle) * BASE_PROJECTILE_SPEED,
      y: Math.sin(angle) * BASE_PROJECTILE_SPEED,
    };
    backendProjectiles[projectileId] = {
      x,
      y,
      radius: PROJECTILE_RADIUS * devicePixelRatios[socket.id],
      velocity,
      playerId: socket.id,
    };
  });

  socket.on("disconnect", (reason) => {
    console.log(reason);
    delete backendPlayers[socket.id];
    io.emit("updatePlayers", backendPlayers);
  });
});

io.listen(3001);
