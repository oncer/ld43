var game = new Phaser.Game(
   1024, 576,
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
   game.load.spritesheet('propeller', 'gfx/propeller.png', 16, 64, 4);
   game.load.spritesheet('people', 'gfx/people.png', 32, 32);
   game.load.physics('peopleShapes', 'gfx/people-shapes.json');
   game.load.spritesheet('ocean', 'gfx/ocean.png', 16, 32);
   game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function create ()
{
   game.physics.startSystem(Phaser.Physics.P2JS)
   game.physics.p2.gravity.y = 250;
   game.physics.p2.applyDamping = true;
   zeppelinCollisionGroup = game.physics.p2.createCollisionGroup();
   peopleCollisionGroup = game.physics.p2.createCollisionGroup();


   //864
   game.world.setBounds(0, 0, 512, 288);
   //game.camera.bounds.setTo(512, 288);
   game.camera.scale.setTo(2);

   // 2 bgs for scrolling
   bgGroup = game.add.group();
   bgGroup.create(0, 0, 'bg');
   bgGroup.create(512, 0, 'bg');

   game.add.sprite(0, 0, 'bg');
   propeller = game.add.sprite(-128, 20, 'propeller');
   propeller.animations.add('propel').play(15, true);
   zeppelin = game.add.sprite(144, 92, 'zeppelin');
   game.physics.enable(zeppelin, Phaser.Physics.P2JS);
   zeppelin.addChild(propeller);
   zeppelin.body.static = true;
   zeppelin.body.gravity = 0;
   zeppelin.body.clearShapes();
   zeppelin.body.addRectangle(224, 16, 0, 64 + 32);
   zeppelin.body.setCollisionGroup(zeppelinCollisionGroup);
   zeppelin.body.collides(peopleCollisionGroup);

   peopleOnZeppelin = [];

 
   // camera
   game.camera.follow(zeppelin);
   game.camera.deadzone = new Phaser.Rectangle(16, 16, game.width - 16, game.height - zeppelin.height - 64);
   game.camera.lerpY = 0.1;

   xVel = 1;

   //zeppelin.weight = 500;

   personClicked = null;
   personClickOffset = null;

   peopleGroup = game.add.group();
   //peopleGroup.enableBody = true;
   //peopleGroup.phyicsBodyType = Phaser.Physics.P2JS;
   for (var i = 0; i < 4; i++) {
      spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, 64 + i*32, 0)
   }
   
   // create physics body for mouse which we will use for dragging clicked bodies
   mouseBody = new p2.Body();
   game.physics.p2.world.addBody(mouseBody);

   // ocean waves
   oceanGroup = game.add.group();
   var f = 0;
   for (var x = 0; x < 2 * game.world.width; x += 16)
   {
      var wave = oceanGroup.create(x, game.world.height - 32, 'ocean');
      var waveAnim = wave.animations.add('wave');
      waveAnim.play(5, true);
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

   var mouseX = game.input.activePointer.position.x * 0.5;
   var mouseY = game.input.activePointer.position.y * 0.5;
   
   // mouse/touch logic
   if (game.input.activePointer.isDown) {
	  mouseBody.position[0] = game.physics.p2.pxmi(mouseX);
	  mouseBody.position[1] = game.physics.p2.pxmi(mouseY);
      var clickPos = new Phaser.Point(game.physics.p2.pxmi(mouseX), game.physics.p2.pxmi(mouseY));
      if (personClicked == null) {
		 //getObjectsUnderPointer is not in p2
         peopleClicked = game.physics.p2.hitTest(new Phaser.Point(mouseX, mouseY), peopleGroup.children);
		 if (peopleClicked.length > 0) {
            personClicked = peopleClicked[0];
            personClickOffset = Phaser.Point.subtract(clickPos, new Phaser.Point(personClicked.x, personClicked.y));
            console.log(personClicked);
			
			
		    var localPointInBody = [0, 0];
            // this function takes physicsPos and coverts it to the body's local coordinate system
            personClicked.toLocalFrame(localPointInBody, mouseBody.position);
        
            // use a revoluteContraint to attach mouseBody to the clicked body
		    mouseConstraint = this.game.physics.p2.createRevoluteConstraint(mouseBody, [0, 0], personClicked, [game.physics.p2.mpxi(localPointInBody[0]), game.physics.p2.mpxi(localPointInBody[1])]);
         }
		 
      } else {
         //personClicked.x = clickPos.x - personClickOffset.x;
         //personClicked.y = clickPos.y - personClickOffset.y;
		 // var force = [100 * (clickPos.x - personClicked.position[0]), 100 * (clickPos.y - personClicked.position[1])];
		 // console.log(force);
		 // personClicked.applyForce(force, personClicked.x, personClicked.y);
		 // personClicked.damping = 0.999;
      }
   } else {
      if (personClicked != null) {
         // personClicked.damping = 0;
         //personClicked.body.reset(personClicked.x, personClicked.y);
         game.physics.p2.removeConstraint(mouseConstraint);
         //var speed = Math.sqrt(personClicked.velocity.x*personClicked.velocity.x + personClicked.velocity.y*personClicked.velocity.y);
         //console.log(speed);
      }
      personClicked = null;
      clickPos = null;
   }

   // update people
   for (var i in peopleGroup.children) {
      var person = peopleGroup.children[i];
      // ...
   }

   // Scrolling
   // ocean wave movement
   oceanGroup.x = (oceanGroup.x - xVel) % game.world.width;
   bgGroup.x = (bgGroup.x - (0.4 * xVel)) % game.world.width;
   
   updateZeppelin();
   
   //zeppelin.body.rotateRight(1);
}

function updateZeppelin()
{
   // constant up/down shift
   zeppelin.body.moveUp(3 * Math.sin(T));

   // tilt based on people's weight
   var leftWeight = 0;
   var rightWeight = 0;
   for (var i in peopleOnZeppelin)
   {
      var person = peopleOnZeppelin[i];
      var distanceFromCenter = (zeppelin.x - person.x) / 64;
      if (distanceFromCenter < 0) {
         leftWeight -= distanceFromCenter * person.weight;
      } else {
         rightWeight += distanceFromCenter * person.weight;
      }
   }
}

function spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, x, y)
{
   var weights = [ 13, 13, 13, 13, 21, 21, 21, 21, 34, 34, 34, 34 ];
	var person = peopleGroup.create(x, y, 'people');
   person.frame = i;
   person.weight = weights[i];
   game.physics.p2.enable(person, false);
   person.body.clearShapes();
   person.body.loadPolygon('peopleShapes', 'person' + i);
   person.body.setCollisionGroup(peopleCollisionGroup);
   person.body.collides(zeppelinCollisionGroup);
   person.body.collides(peopleCollisionGroup);
   person.body.damping = 0;
   person.body.angularDamping = 0.995;
   person.body.onBeginContact.add(personZeppelinBeginContact, this);
   person.body.onEndContact.add(personZeppelinEndContact, this);
}

function personZeppelinBeginContact(body, bodyB, shapeA, shapeB, equation)
{
   if (body == zeppelin.body) {
      peopleOnZeppelin.unshift(shapeA.body.parent.sprite);
   }
}

function personZeppelinEndContact(body, bodyB, shapeA, shapeB, equation)
{
   if (body == zeppelin.body) {
      peopleOnZeppelin.shift(shapeA.body.parent.sprite);
   }
}

function render()
{
}

