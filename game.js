var maxRotation = 0.5; // maximum rotation
var minZeppelinY = 108;
var goreEmmiter;

var meters = 0;
var maxDistance = 3000; // this is the distance to the final destination
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
	game.load.spritesheet('hudDistance', 'gfx/hud_distance_bar.png', 128, 16);
	game.load.spritesheet('hudDistanceCursor', 'gfx/hud_distance_cursor.png', 16, 16);
	game.load.spritesheet('gore', 'gfx/gore.png', 16, 16);
	game.load.image('island_start', 'gfx/island_start.png');
	game.load.image('island_end', 'gfx/island_end.png');
	game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function create ()
{

	game.physics.startSystem(Phaser.Physics.P2JS)
	game.physics.p2.gravity.y = 250;
	game.physics.p2.applyDamping = true;
	game.physics.p2.setImpactEvents(true);
	zeppelinCollisionGroup = game.physics.p2.createCollisionGroup();
	peopleCollisionGroup = game.physics.p2.createCollisionGroup();
	balloonCollisionGroup = game.physics.p2.createCollisionGroup();
	propellerCollisionGroup = game.physics.p2.createCollisionGroup();


	game.world.setBounds(0, 0, 512, 864);
	game.camera.scale.setTo(2);

	// 2 bgs for scrolling
	bgGroup = game.add.group();
	bgGroup.create(0, 0, 'bg');
	bgGroup.create(512, 0, 'bg');

	// starting island
	island_start = game.add.sprite(0, game.world.height - 80, 'island_start');
	// goal island
	island_end = game.add.sprite(maxDistance + 256, game.world.height - 80, 'island_end');

	propeller = game.add.sprite(26, game.world.height - 80, 'propeller');
	propeller.animations.add('propel').play(15, true);

	zeppelin = game.add.sprite(144, game.world.height - 154, 'zeppelin');
	game.physics.enable(zeppelin, Phaser.Physics.P2JS);
	//zeppelin.addChild(propeller);
	zeppelin.body.static = true;
	zeppelin.body.gravity = 0;
	zeppelin.body.clearShapes();
	zeppelin.body.addRectangle(224, 16, 0, 64 + 32);
	zeppelin.body.setCollisionGroup(zeppelinCollisionGroup);
	zeppelin.body.collides(peopleCollisionGroup);
	game.physics.enable(propeller, Phaser.Physics.P2JS);
	propeller.body.setCollisionGroup(propellerCollisionGroup);
	propeller.body.collides(peopleCollisionGroup, personShredded, this);
	game.physics.p2.createLockConstraint(zeppelin.body, propeller.body, [144-26, 80-154]);

	zeppelinTargetRotation = 0; // slowly rotate to this value
	zeppelinSumWeight = 0; // negative=tilt to left, positive=tilt to right
	// target velocity in Y direction
	zeppelinTargetYV = 0;
	zeppelinWeightCapacity = 75; // could become less over time
	peopleMass = 0;


	// camera
	game.camera.follow(zeppelin);
	game.camera.deadzone = new Phaser.Rectangle(0, 128, game.width, game.height - 440);
	game.camera.lerpY = 0.1;

	xVel = 0;

	//zeppelin.weight = 500;

	personClicked = null;
	personClickOffset = null;

	peopleGroup = game.add.group();
	//peopleGroup.enableBody = true;
	//peopleGroup.phyicsBodyType = Phaser.Physics.P2JS;
	for (var i = 0; i < 4; i++) {
		spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, 64 + i*32, zeppelin.y);
	}

	balloonGroup = game.add.group();

	spawnPersonOnBalloon(peopleGroup, balloonGroup, peopleCollisionGroup, zeppelinCollisionGroup, balloonCollisionGroup, 5, 500, 200);

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

	var style = { font: "14px Consolas", fill: "#ff004c", align: "center" };
	debugText = game.add.text(256, 240, "debug text", style);
	debugText.anchor.set(0.5);
	// HUD
	distanceBar = game.add.sprite(384, 10, 'hudDistance');
	distanceBar.fixedToCamera = true;

	distanceBarCursor = game.add.sprite(0, 10, 'hudDistanceCursor');
	distanceBarCursor.fixedToCamera = true;
	setDistanceBar(0);

	// gore emmiter
	goreEmitter = game.add.emitter(0, 0, 100);
	goreEmitter.makeParticles('gore', [0,1,2,3,4,5,6]);
	goreEmitter.gravity = 200;
	goreEmitter.maxParticles = 500;


}

function update ()
{
	// time since last frame, in seconds
	deltaT = game.time.elapsed/1000;

	// time since some start point, in seconds
	T = game.time.now/1000;

	var mouseX = game.input.activePointer.position.x / game.camera.scale.y;
	var mouseY = (game.input.activePointer.position.y + game.camera.view.y) / game.camera.scale.y;

	if (meters < maxDistance) {
		xVel = Math.min(xVel + .002, 1);
	} else {
		xVel = 0;// Math.max(xVel - .1, 0);

		// ~~~ Winning Condition ~~~

		// TODO: neutralize tilt, lower zeppelin, disable dragging people,....

		game.camera.follow(null);
		if (zeppelin.body.x < game.world.width - 128) {
			zeppelin.body.x += 1;
			for(var i in peopleGroup.children) {
				peopleGroup.children[i].body.x += 1;
			}
		}
	}
	meters += xVel;

	setDistanceBar(meters/maxDistance);

	// mouse/touch logic
	if (game.input.activePointer.isDown) {
		mouseBody.position[0] = game.physics.p2.pxmi(mouseX);
		mouseBody.position[1] = game.physics.p2.pxmi(mouseY);
		var clickPos = new Phaser.Point(game.physics.p2.pxmi(mouseX), game.physics.p2.pxmi(mouseY));
		if (personClicked == null) {
			//getObjectsUnderPointer is not in p2
			peopleClicked = game.physics.p2.hitTest(new Phaser.Point(mouseX, mouseY), peopleGroup.children);
			if (peopleClicked.length > 0) {
				for (var i in peopleClicked) {
					if (!peopleClicked[i].parent.sprite.inWater) {
						personClicked = peopleClicked[i];
						break;
					}
				}
				if (personClicked != null) {
					//personClicked = peopleClicked[0];
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
			if (personClicked.parent.sprite.inWater) {
				game.physics.p2.removeConstraint(mouseConstraint);
				personClicked = null;
			}

			// moves to the top z-layer
			personClicked.parent.sprite.moveUp();
			// disables collision
			personClicked.parent.data.shapes[0].sensor = true;

		}
	} else {
		if (personClicked != null) {
			game.physics.p2.removeConstraint(mouseConstraint);
			// enables collision again
			personClicked.parent.data.shapes[0].sensor = false;
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
			balloon.body.applyForce([0.1, 250/10 + 0.01], 0, 0);
		}
	}

	// ~~~ scrolling ~~~
	oceanGroup.x = (oceanGroup.x - xVel) % game.world.width;
	bgGroup.x = (bgGroup.x - (0.4 * xVel)) % game.world.width;
	island_start.x -= xVel; 
	island_end.x -= xVel; //Math.max(island_end.x - xVel, game.world.width - 256); 

	if (island_start.x < -256) {
		island_start.destroy();
	}

	updateZeppelin();
	updateWaterCurrent();

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
	var targetPeopleMass = 0;
	for (var i in peopleOnZeppelin)
	{
		var person = peopleOnZeppelin[i];
		targetPeopleMass += person.weight;
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

	if (peopleMass > targetPeopleMass) {
		peopleMass--;
	} else if (peopleMass < targetPeopleMass) {
		peopleMass++;
	}
	var rotationScale = Math.min(1, Math.abs(zeppelinSumWeight / 30));
	zeppelinTargetRotation = maxRotation * rotationScale * Math.sign(zeppelinSumWeight);
	debugText.text += "\n";
	debugText.text += "meters: " + meters;

	// do the tilt!
	var rotationDistance = zeppelinTargetRotation - zeppelin.body.rotation;
	if (rotationDistance > 0) {
		zeppelin.body.rotateRight(1);
	} else if (rotationDistance < 0) {
		zeppelin.body.rotateLeft(1);
	}

	// calculate Y velocity
	windVelocity = 0;
	c1 = -100;
	c2 = 0;
	c3 = 0;
	zeppelinTargetYV = c1 * zeppelin.body.rotation +
		c2 * (zeppelinWeightCapacity - peopleMass) +
		c3 * Math.sin(T);

	if (zeppelin.body.y <= minZeppelinY) {
		zeppelinTargetYV = 0;
	}

	zeppelin.body.moveUp(zeppelinTargetYV);

	debugText.text = "balance: " + zeppelinSumWeight.toFixed(2) + ", rotation: " + zeppelinTargetRotation.toFixed(2);
	debugText.text += "\n";
	debugText.text += "people on board: " + peopleOnZeppelin.length + ", people mass: " + peopleMass;
	debugText.text += "\n";
	debugText.text += "target y vel: " + zeppelinTargetYV.toFixed(2);
}

function updateWaterCurrent()
{
	for (var i in peopleGroup.children)
	{
		var person = peopleGroup.children[i];
		if (person.body.y > game.world.bounds.height - 32) {
			person.inWater = true;
			person.body.moveLeft(100);
			if (person.body.y > game.world.bounds.height - 48) {
				// prevent person from disappearing
				person.body.moveUp(10);
			}
		} else {
			person.inWater = false;
		}
	}

}

function spawnPerson(peopleGroup, peopleCollisionGroup, zeppelinCollisionGroup, i, x, y)
{
	var weights = [ 13, 13, 13, 13, 21, 21, 21, 21, 34, 34, 34, 34 ];
	var person = peopleGroup.create(x, y, 'people');
	person.frame = i;
	person.touchingZeppelin = false;
	person.touchingPeople = []
	person.inWater = false;
	game.physics.p2.enable(person, false);
	person.body.clearShapes();
	person.body.loadPolygon('peopleShapes', 'person' + i);
	person.body.setCollisionGroup(peopleCollisionGroup);
	person.body.collides(zeppelinCollisionGroup);
	person.body.collides(peopleCollisionGroup);
	person.body.collides(propellerCollisionGroup);
	person.body.damping = 0;
	person.body.angularDamping = 0.995;
	person.weight = weights[i];
	person.body.onBeginContact.add(personZeppelinBeginContact, this);
	person.body.onEndContact.add(personZeppelinEndContact, this);
	person.body.rope = null;

	return person;
}

function destroyPerson(person)
{
	// make sure the person is not referenced anymore
	for (var i in peopleGroup.children)
	{
		var otherPerson = peopleGroup.children[i];
		for (var j in otherPerson.touchingPeople) {
			if (otherPerson.touchingPeople[j] === person) {
				otherPerson.touchingPeople.splice(j, 1);
			}
		}
	}
	if (personClicked.parent.sprite === person) {
		game.physics.p2.removeConstraint(mouseConstraint);
		personClicked = null;
	}

	person.destroy();
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

function setDistanceBar(value){
	//game.add.tween(logo2.cameraOffset).to( { y: 400 }, 2000, Phaser.Easing.Back.InOut, true, 0, 2000, true);
	distanceBarCursor.cameraOffset.x = 376 + value * 242
}

function personShredded(body1, body2){
	goreEmitter.area = body2.sprite.getLocalBounds()
	
	goreEmitter.x = body2.x;
	goreEmitter.y = body2.y;
	
	goreEmitter.start(true, 2000, null, 50);
	//body2.sprite.destroy();
}

function render()
{
}

