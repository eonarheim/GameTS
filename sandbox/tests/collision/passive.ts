/// <reference path='../../lib/excalibur.d.ts' />
var game = new ex.Engine({
  width: 600,
  height: 400
});

ex.Physics.collisionResolutionStrategy = ex.CollisionResolutionStrategy.Box;

var activeBlock = new ex.Actor(200, 200, 50, 50, ex.Color.Red.clone());
activeBlock.body.collider.type = ex.CollisionType.Active;
activeBlock.vel = ex.vec(100, 0);
game.add(activeBlock);

activeBlock.on('precollision', () => {
  console.log('Active block collision event');
});

activeBlock.on('postcollision', () => {
  console.error('Active block should not fire post collision');
});

var passiveBlock = new ex.Actor(400, 200, 50, 50, ex.Color.DarkGray.clone());
passiveBlock.body.collider.type = ex.CollisionType.Passive;
passiveBlock.vel = ex.vec(-100, 0);
game.add(passiveBlock);

passiveBlock.on('precollision', () => {
  console.log('Passive block collision event');
});

passiveBlock.on('postcollision', () => {
  console.error('Passive block should not fire post collision');
});

game.start();
