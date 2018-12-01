var game = new Phaser.Game(
   512, 288,
   Phaser.AUTO,
   'lighter-than-air',
   this,
   false, // transparent
   false  // anti-alias
);

function preload ()
{
   game.load.image('bg', 'gfx/background.png');
   game.load.image('zeppelin', 'gfx/zeppelin.png');
   game.load.image('zeppelin-floor', 'gfx/zeppelin-floor.png');
   game.load.spritesheet('propeller', 'gfx/propeller.png', 16, 64, 4);
   game.load.spritesheet('people', 'gfx/people.png', 32, 32);
   game.load.spritesheet('ocean', 'gfx/ocean.png', 16, 32);
   game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function create ()
{
   game.physics.startSystem(Phaser.Physics.P2JS)
   game.physics.p2.gravity.y = 100;
   game.physics.p2.applyDamping = true;
   zeppelinCollisionGroup = game.physics.p2.createCollisionGroup();
   peopleCollisionGroup = game.physics.p2.createCollisionGroup();


   //864
   game.world.setBounds(0, 0, 512, 288);

   game.add.sprite(0, 0, 'bg');
   propeller = game.add.sprite(-128, 20, 'propeller');
   propeller.animations.add('propel').play(15, true);
   zeppelin = game.add.sprite(18+128, 92, 'zeppelin');
   zeppelin.anchor.set(0.5, 0.5);
   zeppelin.addChild(propeller);
   zeppelinFloor = game.add.sprite(zeppelin.x, zeppelin.y + zeppelin.height / 2 + 8, 'zeppelin-floor');
   game.physics.enable(zeppelinFloor, Phaser.Physics.P2JS);
   zeppelinFloor.body.static = true;
   zeppelinFloor.body.gravity = 0;
   zeppelinFloor.body.setCollisionGroup(zeppelinCollisionGroup);
   zeppelinFloor.body.collides(peopleCollisionGroup);
 
   // camera
   game.camera.follow(zeppelin);
   game.camera.deadzone = new Phaser.Rectangle(16, 16, game.width - 16, game.height - zeppelin.height - 64);
   game.camera.lerpY = 0.1;

   

   //zeppelin.weight = 500;

   personClicked = null;
   personClickOffset = null;

   peopleGroup = game.add.group();
   //peopleGroup.enableBody = true;
   //peopleGroup.phyicsBodyType = Phaser.Physics.P2JS;
   for (var i = 0; i < 4; i++) {
      var person = peopleGroup.create(i * 32, 0, 'people');
      person.frame = i;
      person.y = 0;//zeppelin.y + zeppelin.height/2 - person.height;
      person.x = 64 + person.x % 200;
      game.physics.p2.enable(person, false);
      person.body.setCollisionGroup(peopleCollisionGroup);
      person.body.collides(zeppelinCollisionGroup);
      person.body.collides(peopleCollisionGroup);
      person.body.damping = 0;
   }

   // ocean waves
   oceanGroup = game.add.group();
   var f = 0;
   for (var x = 0; x < game.world.width; x += 16)
   {
      var wave = oceanGroup.create(x, game.world.height - 32, 'ocean');
      var waveAnim = wave.animations.add('wave');
      waveAnim.play(10, true);
   }

   var deltaT = game.time.elapsed;
   var T = game.time.now;
}

function update ()
{
   // time since last frame, in seconds
   deltaT = game.time.elapsed/1000;
   
   // time since some start point, in seconds
   T = game.time.now/1000;
   
   // mouse/touch logic
   if (game.input.activePointer.isDown) {
      var clickPos = new Phaser.Point(game.physics.p2.pxmi(game.input.activePointer.position.x), game.physics.p2.pxmi(game.input.activePointer.position.y));
      if (personClicked == null) {
		 //getObjectsUnderPointer is not in p2
         peopleClicked = game.physics.p2.hitTest(game.input.activePointer.position, peopleGroup.children);
		 if (peopleClicked.length > 0) {
            personClicked = peopleClicked[0];
            personClickOffset = Phaser.Point.subtract(clickPos, new Phaser.Point(personClicked.x, personClicked.y));
            console.log(personClicked);
         }
      } else {
         //personClicked.x = clickPos.x - personClickOffset.x;
         //personClicked.y = clickPos.y - personClickOffset.y;
		 var force = [100 * (clickPos.x - personClicked.position[0]), 100 * (clickPos.y - personClicked.position[1])];
		 console.log(force);
		 personClicked.applyForce(force, personClicked.x, personClicked.y);
      }
   } else {
      if (personClicked != null) {
         //personClicked.body.reset(personClicked.x, personClicked.y);
      }
	  personClicked = null;
      clickPos = null;
   }

   // update people
   for (var i in peopleGroup.children) {
      var person = peopleGroup.children[i];
      // ...
   }

   // update zeppelin
   //zeppelin.y += 5 * deltaT * Math.sin(T);
   
   //game.physics.arcade.collide(peopleGroup, zeppelinFloor);
   
}

function render()
{
}

