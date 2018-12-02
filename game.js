var maxRotation = 0.5; // maximum rotation


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
   game.load.spritesheet('balloon', 'gfx/balloon.png', 32, 32);
   game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function create ()
{

   game.physics.startSystem(Phaser.Physics.P2JS)
   game.physics.p2.gravity.y = 250;
   game.physics.p2.applyDamping = true;
   zeppelinCollisionGroup = game.physics.p2.createCollisionGroup();
   peopleCollisionGroup = game.physics.p2.createCollisionGroup();
   balloonCollisionGroup = game.physics.p2.createCollisionGroup();
   

   game.world.setBounds(0, 0, 512, 864);
   //game.camera.bounds.setTo(512, 288);
   game.camera.scale.setTo(2);

   // 2 bgs for scrolling
   bgGroup = game.add.group();
   bgGroup.create(0, 0, 'bg');
   bgGroup.create(512, 0, 'bg');

   propeller = game.add.sprite(-128, 40, 'propeller');
   propeller.animations.add('propel').play(15, true);
   zeppelin = game.add.sprite(144, 192, 'zeppelin');
   game.physics.enable(zeppelin, Phaser.Physics.P2JS);
   zeppelin.addChild(propeller);
   zeppelin.body.static = true;
   zeppelin.body.gravity = 0;
   zeppelin.body.clearShapes();
   zeppelin.body.addRectangle(224, 16, 0, 64 + 32);
   zeppelin.body.setCollisionGroup(zeppelinCollisionGroup);
   zeppelin.body.collides(peopleCollisionGroup);

   zeppelinTargetRotation = 0;
   zeppelinSumWeight = 0;

 
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
      spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, 64 + i*32, 0);
   }
   
   balloonGroup = game.add.group();
   
   spawnPersonOnBalloon(peopleGroup, balloonGroup, peopleCollisionGroup, zeppelinCollisionGroup, balloonCollisionGroup, 5, 300, 200);
   
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

   var style = { font: "14px Consolas", fill: "#ffffff", align: "center" };
   debugText = game.add.text(256, 240, "debug text", style);
   debugText.anchor.set(0.5);

   var deltaT = game.time.elapsed;
   var T = game.time.now;
}

function update ()
{
   // time since last frame, in seconds
   deltaT = game.time.elapsed/1000;
   
   // time since some start point, in seconds
   T = game.time.now/1000;

   var mouseX = game.input.activePointer.position.x / game.camera.scale.y;
   var mouseY = (game.input.activePointer.position.y + game.camera.view.y) / game.camera.scale.y;
   
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
            //personClickOffset = Phaser.Point.subtract(clickPos, new Phaser.Point(personClicked.x, personClicked.y));
            console.log(personClicked);
			
		    var localPointInBody = [0, 0];
            // this function takes physicsPos and coverts it to the body's local coordinate system
            personClicked.toLocalFrame(localPointInBody, mouseBody.position);
            // use a revoluteContraint to attach mouseBody to the clicked body
		    mouseConstraint = this.game.physics.p2.createRevoluteConstraint(mouseBody, [0, 0], personClicked, [game.physics.p2.mpxi(localPointInBody[0]), game.physics.p2.mpxi(localPointInBody[1])]);
			
			console.log(personClicked.parent.rope);
			if (personClicked.parent.rope != null){
			   game.physics.p2.removeConstraint(personClicked.parent.rope);
			   delete personClicked.parent.rope;
			}
         }
		 balloonClicked = game.physics.p2.hitTest(new Phaser.Point(mouseX, mouseY), balloonGroup.children);
		 if (balloonClicked.length > 0){
			 balloon = balloonClicked[0];
			 game.physics.p2.removeConstraint(balloon.parent.rope);
			 delete balloon.parent.rope;
			 balloon.parent.sprite.popped = true;
			 balloon.parent.sprite.popTime = T;
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
   
   // update balloons
   for (var b in balloonGroup.children) {
	   var balloon = balloonGroup.children[b];
	   if (balloon.popped){
		   if ((T - balloon.popTime)*30 > balloon.frame){
			   if (balloon.frame == 3){
				   balloon.destroy();
			   } else {
				   balloon.frame += 1;
				   balloon.body.applyForce([0, 250/20], 0, 0);
			   }
		   }
		   
	   } else {		   
	       balloon.body.applyForce([0, 250/10 + 0.01], 0, 0);
	   }
   }

   // Scrolling
   // ocean wave movement
   oceanGroup.x = (oceanGroup.x - xVel) % game.world.width;
   bgGroup.x = (bgGroup.x - (0.4 * xVel)) % game.world.width;
   
   updateZeppelin();
   
   debugText.y = 240 + game.camera.view.y / game.camera.scale.y; 
   //zeppelin.body.rotateRight(1);
}

function recursivelyIndirectTouchingQuery(person)
{
   person.flagged = true;
   for (var i in person.touchingPeople)
   {
      var otherPerson = person.touchingPeople[i];
      if (otherPerson.touchingZeppelin) {
         return true;
      } else if (!otherPerson.flagged) {
         return recursivelyIndirectTouchingQuery(otherPerson);
      }
   }
}

function personIndirectlyTouchingZeppelin(person)
{
   for (var i in peopleGroup.children) {
      peopleGroup.children[i].flagged = false;
   }
   return recursivelyIndirectTouchingQuery(person);
}

function updateZeppelin()
{
   // constant up/down shift
   zeppelin.body.moveUp(3 * Math.sin(T));
 
   // determine who is on the zeppelin
   // - even indirectly, if standing on top of each other!
   peopleOnZeppelin = [];
   for (var i in peopleGroup.children) {
      var person = peopleGroup.children[i];
      if (person.touchingZeppelin
         || personIndirectlyTouchingZeppelin(person)) {
         peopleOnZeppelin.push(person);
      }
   }

   // tilt based on people's weight
   var leftWeight = 0;
   var rightWeight = 0;
   for (var i in peopleOnZeppelin)
   {
      var person = peopleOnZeppelin[i];
      var distanceFromCenter = (person.x - zeppelin.x) / 112;
      if (distanceFromCenter < 0) {
         leftWeight -= distanceFromCenter * person.weight;
      } else {
         rightWeight += distanceFromCenter * person.weight;
      }
   }
   var targetSumWeight = rightWeight - leftWeight;
   if (zeppelinSumWeight > targetSumWeight) {
      zeppelinSumWeight = Math.max(targetSumWeight, zeppelinSumWeight - 0.5);
   } else if (zeppelinSumWeight < targetSumWeight) {
      zeppelinSumWeight = Math.min(targetSumWeight, zeppelinSumWeight + 0.5);
   }
   var rotationScale = Math.min(1, Math.abs(zeppelinSumWeight / 30));
   zeppelinTargetRotation = maxRotation * rotationScale * rotationScale * Math.sign(zeppelinSumWeight);
   debugText.text = "balance: " + zeppelinSumWeight.toFixed(2) + ", rotation: " + zeppelinTargetRotation.toFixed(2);
   debugText.text += "\n";
   debugText.text += "people on board: " + peopleOnZeppelin.length;

   // do it!
   var rotationDistance = zeppelinTargetRotation - zeppelin.body.rotation;
   if (rotationDistance > 0) {
      zeppelin.body.rotateRight(1);
   } else if (rotationDistance < 0) {
      zeppelin.body.rotateLeft(1);
   }
}

function spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, x, y)
{
   var weights = [ 13, 13, 13, 13, 21, 21, 21, 21, 34, 34, 34, 34 ];
	var person = peopleGroup.create(x, y, 'people');
	person.frame = i;
   person.touchingZeppelin = false;
   person.touchingPeople = []
	game.physics.p2.enable(person, false);
	person.body.clearShapes();
	person.body.loadPolygon('peopleShapes', 'person' + i);
	person.body.setCollisionGroup(peopleCollisionGroup);
	person.body.collides(zeppelinCollisionGroup);
	person.body.collides(peopleCollisionGroup);
	person.body.damping = 0;
	person.body.angularDamping = 0.995;
	person.weight = weights[i];
	person.body.onBeginContact.add(personZeppelinBeginContact, this);
	person.body.onEndContact.add(personZeppelinEndContact, this);
	person.body.rope = null;
	
	return person;
}
function spawnBalloon(balloonGroup, balloonCollisionGroup, x, y){
	var balloon = balloonGroup.create(x, y, 'balloon');
	balloon.frame = 0;
	game.physics.p2.enable(balloon, false);
	balloon.body.setCollisionGroup(balloonCollisionGroup);
	//balloon.body.gravity = -260;
	
	//balloon.body.collides(zeppelinCollisionGroup);
	//balloon.body.collides(peopleCollisionGroup);
	balloon.damping = 0.999;
	balloon.angularDamping = 0.995;
	balloon.body.rope = null;
	balloon.popped = false;
	
	return balloon;
}

function spawnPersonOnBalloon(peopleGroup, balloonGroup, peopleCollisionGroup, zeppelinCollisionGroup, balloonCollisionGroup, i, x, y){
	person = spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, x, y);
	balloon = spawnBalloon(balloonGroup, balloonCollisionGroup, x + 2, y - 32);
	rope = this.game.physics.p2.createDistanceConstraint(balloon.body, person.body, 20, [0,15], [0,-1])
	
	person.body.rope = rope;
	balloon.body.rope = rope;
}

function personZeppelinBeginContact(body, bodyB, shapeA, shapeB, equation)
{
   if (body === zeppelin.body) {
      var person = shapeA.body.parent.sprite;
      person.touchingZeppelin = true;
   }
   if (body.sprite.key == "people") {
      body.sprite.touchingPeople.push(shapeA.body.parent.sprite);
   }
}

function personZeppelinEndContact(body, bodyB, shapeA, shapeB, equation)
{
   if (body === zeppelin.body) {
      var person = shapeA.body.parent.sprite;
      person.touchingZeppelin = false;
   }
   if (body.sprite.key == "people") {
      for (var i in body.sprite.touchingPeople) {
         if (body.sprite.touchingPeople[i] === shapeA.body.parent.sprite) {
            body.sprite.touchingPeople.splice(i, 1);
            break;
         }
      }
   }
}

function render()
{
}

