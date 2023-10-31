let canvas = document.getElementById('visual'),
  ctx = canvas.getContext('2d'),
  particles = [],
wind = {
  x: 0,
  y: 0,
  newX: 0,
  newY: 0
},
windRandom = .2,
windMax = 1000,
  oldTimeStamp,
  drag = .3,
  running = true;

//Calculations
window.requestAnimationFrame(update);

function update(timeStamp) {
  deltaTime = (timeStamp - oldTimeStamp) / 100;
  oldTimeStamp = timeStamp;

  if (Number.isNaN(deltaTime))
      deltaTime = 0;

  ctx.canvas.width = window.innerWidth;
  ctx.canvas.height = window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

wind.x += (wind.newX - wind.x) / 10 * deltaTime;
console.log(wind.x);

  particles.forEach(particle => {
  particle.velocity.y += .2;
  particle.velocity.y -= particle.velocity.y * drag;

  particle.position.x += wind.x / 11 / (particle.position.distance * 4);
  particle.position.y += particle.velocity.y / particle.position.distance;

      ctx.beginPath();
      ctx.arc(particle.position.x, particle.position.y, particle.size / particle.position.distance * canvas.height / 600, 0, 10 * Math.PI, false);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.closePath();
  });

  let particle = particles[0];

  if (running)
      window.requestAnimationFrame(update);
  else
      canvas.parentNode.removeChild(canvas);
}

//Create Particles
createParticle();

function createParticle() {
particles.push({
    size: 1.5,
      position: {
        x: Math.random() * window.innerWidth * 1.5 - window.innerWidth * .25,
          y: 0,
          distance: Math.random() * 5 + 1
      },
      velocity: {
        x: 0,
          y: 0
      }
  });

  setTimeout(() => { particles.shift() }, 40000);
}

setInterval(createParticle, 40);

for (let i = 0; i < 300; i++) {
particles.push({
          size: 1.5,
          position: {
              x: Math.random() * window.innerWidth * 1.5 - window.innerWidth * .25,
              y: Math.random() * window.innerHeight,
              distance: Math.random() * 5 + 1
          },
          velocity: {
              x: 0,
              y: 0
          }
      });

      setTimeout(() => { particles.shift() }, 40000);
}

function generateWind() {
wind.newX = Math.random() * 40 - 20;

setTimeout(() => { generateWind() }, Math.random() * 2000 + 5000);
}

generateWind();