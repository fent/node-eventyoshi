const fork  = require('child_process').fork;
const yoshi = new(require('..'));


// Spawn 5 workers
const NUMBER = 5;
for (let i = 0; i < NUMBER; i++) {
  yoshi.add(fork(__dirname + '/worker.js'));
}


// Wait to receive messages from workers
yoshi.on('message', (m) => {
  console.log(m);
  yoshi.child.kill();
});
