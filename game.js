//TODO: win screen
//TODO: lose screen
//TODO: anfangsbedingungen
//TODO: leute zerstören wenn sie links rausfliegen
//TODO: explosionspartikel in richtige richtung
//TODO: minen über zeppelin droppen
//TODO: minen mit stahlballons
//TODO: ballons in verschiedenen farben
//XXX: vögel
//XXX: mehrere ballons pro person

var maxRotation = 0.5; // maximum rotation
var minZeppelinY = 108;
var zeppelinLandY = 714;
var waterY = 832;
var goreEmitter;
var zeroPeopleTimer; // counts up as soon as there is no one left on the zeppelin
var zeroPeopleTimeout = 0.5; // how many seconds until the zeppelin drops when zero people are on board

var meters = 0;
var maxDistance = 3000; // this is the distance to the final destination
var timer = 0; // for spawning people etc.

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
	game.load.spritesheet('mine', 'gfx/mine.png', 31, 31);
	game.load.spritesheet('explosion', 'gfx/explosion.png', 64, 64);
	game.load.image('rope', 'gfx/rope.png');
	game.load.image('island_start', 'gfx/island_start.png');
	game.load.image('island_end', 'gfx/island_end.png');
	game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function create ()
{
	game.physics.startSystem(Phaser.Physics.P2JS)
	game.physics.p2.gravity.y = 320;
	game.physics.p2.applyDamping = true;
	game.physics.p2.setImpactEvents(true);
	zeppelinCollisionGroup = game.physics.p2.createCollisionGroup();
	peopleCollisionGroup = game.physics.p2.createCollisionGroup();
	balloonCollisionGroup = game.physics.p2.createCollisionGroup();
	propellerCollisionGroup = game.physics.p2.createCollisionGroup();
	mineCollisionGroup = game.physics.p2.createCollisionGroup();

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

	zeppelin = game.add.sprite(164, zeppelinLandY - 4, 'zeppelin');
	game.physics.enable(zeppelin, Phaser.Physics.P2JS);
	//zeppelin.addChild(propeller);
	zeppelin.body.static = true;
	zeppelin.body.gravity = 0;
	zeppelin.body.clearShapes();
	zeppelin.body.addRectangle(224, 16, 0, 64 + 32);
	zeppelin.body.setCollisionGroup(zeppelinCollisionGroup);
	zeppelin.body.collides([peopleCollisionGroup, mineCollisionGroup]);
	game.physics.enable(propeller, Phaser.Physics.P2JS);
	propeller.body.clearShapes();
	propeller.body.addRectangle(5, 60, -4, 0);
	propeller.body.setCollisionGroup(propellerCollisionGroup);
	propeller.body.collides(peopleCollisionGroup, personShredded, this);
	propeller.body.collides(balloonCollisionGroup, balloonShredded, this);
	propeller.body.collides(mineCollisionGroup);
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

	ropesGroup = game.add.group();
	peopleGroup = game.add.group();
	//peopleGroup.enableBody = true;
	//peopleGroup.phyicsBodyType = Phaser.Physics.P2JS;
	for (var i = 0; i < 4; i++) {
		person = spawnPerson(i, 64 + i*32, zeppelin.y);
	}

	balloonGroup = game.add.group();

	// create physics body for mouse which we will use for dragging clicked bodies
	mouseBody = new p2.Body();
	game.physics.p2.world.addBody(mouseBody);

	mineGroup = game.add.group();

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

	explosionGroup = game.add.group();

	// gore emmiter
	goreEmitter = game.add.emitter(0, 0, 100);
	goreEmitter.makeParticles('gore', [0,1,2,3,4,5,6]);
	goreEmitter.gravity = 200;
	goreEmitter.maxParticles = 500;
	goreEmitter.setXSpeed(-300,-100);
}

function update ()
{
	// time since last frame, in seconds
	deltaT = game.time.elapsed/1000;

	// time since some start point, in seconds
	T = game.time.now/1000;

	var mouseX = game.input.activePointer.position.x / game.camera.scale.y;
	var mouseY = (game.input.activePointer.position.y + game.camera.view.y) / game.camera.scale.y;

	if (zeroPeopleTimer >= zeroPeopleTimeout) {
		xVel = Math.max(xVel - .002, 0);
	} else if (meters < maxDistance) {
		xVel = Math.min(xVel + .002, 1);
	} else {
		xVel = 0
		
		// ~~~ Winning Condition ~~~
		if (zeppelin.body.x < game.world.width - 128) {
			zeppelin.body.x += 1;
			for(var i in peopleGroup.children) {
				peopleGroup.children[i].body.x += 1;
			}
		}
	}
	meters += xVel;
	timer ++;
	
	setDistanceBar(meters/maxDistance);

	if (meters < maxDistance && timer % 360 == 0) {
		var v = Phaser.Math.between(0, 11);
		if (Math.floor(Math.random() * 2)) {
			spawnPersonOnBalloon(v, 512 + 32, zeppelin.y + Phaser.Math.between(-64, 64));
		} else {
			var steel = false;
			if (Math.random() < 0.5) steel = true;
			spawnMineOnBalloon(512 + 32, zeppelin.y + Phaser.Math.between(-64, 64), steel);
		}
	}
	
	// mouse/touch logic
	if (game.input.activePointer.isDown && meters < maxDistance) {
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
					//console.log(personClicked);

					var localPointInBody = [0, 0];
					// this function takes physicsPos and coverts it to the body's local coordinate system
					personClicked.toLocalFrame(localPointInBody, mouseBody.position);
					// use a revoluteContraint to attach mouseBody to the clicked body
					mouseConstraint = this.game.physics.p2.createRevoluteConstraint(mouseBody, [0, 0], personClicked, [game.physics.p2.mpxi(localPointInBody[0]), game.physics.p2.mpxi(localPointInBody[1])]);

					//console.log(personClicked.parent.rope);
					if (personClicked.parent.ropeConstraint != null){
						personClicked.parent.ropeConstraint.bodyA.parent.ropeConstraint = null;
						game.physics.p2.removeConstraint(personClicked.parent.ropeConstraint);

						personClicked.parent.ropeConstraint = null;
					}
				}
			}
			balloonClicked = game.physics.p2.hitTest(new Phaser.Point(mouseX, mouseY), balloonGroup.children);
			if (balloonClicked.length > 0){
				for (var i in balloonClicked) {
					balloon = balloonClicked[i];
					if (!balloon.parent.sprite.popped) {
						pop(balloon.parent.sprite);
						break;
					}
				}
			}

		} else {
			// moves to the top z-layer
			personClicked.parent.sprite.moveUp();
			// disables collision with other people
			for (var i in personClicked.parent.collidesWith) {
				if (personClicked.parent.collidesWith[i] === peopleCollisionGroup || personClicked.parent.collidesWith[i] === zeppelinCollisionGroup) {
					personClicked.parent.collidesWith.splice(i, 1);
				}
			}
			personClicked.parent.updateCollisionMask();
			
			if (personClicked.parent.sprite.inWater) {
				game.physics.p2.removeConstraint(mouseConstraint);
				personClicked = null;
			}
			
		}
	} else {
		if (personClicked != null) {
			game.physics.p2.removeConstraint(mouseConstraint);
			// enables collision again
			personClicked.parent.collides(peopleCollisionGroup);
			personClicked.parent.collides(zeppelinCollisionGroup);
		}
		personClicked = null;
		clickPos = null;
	}

	// update balloons
	for (var b in balloonGroup.children) {
		var balloon = balloonGroup.children[b];
		balloon.body.angle = 0;
		if (balloon.popped) {
			if ((T - balloon.popTime)*30 > balloon.frame){
				if (balloon.frame % 5 == 4){
					balloon.destroy();
				} else {
					balloon.frame += 1;
					balloon.body.applyForce([0, game.physics.p2.gravity.y/20], 0, 0);
				}
			}
		} else {		   
			balloon.body.applyForce([0.1, game.physics.p2.gravity.y/10 + 0.01], 0, 0);
			if (balloon.body.x < -32) {
				destroyRope(balloon);
				balloon.destroy();
			}
		}
	}

	// update mines
	for (var i in mineGroup.children) {
		var mine = mineGroup.children[i];
		// drop mine over zeppelin
		if (mine.body.y < zeppelin.body.y + 64
			 && mine.body.x <= zeppelin.body.x + mine.dropOffset
			 && mine.body.ropeConstraint != null) {
			var balloon = mine.body.ropeConstraint.bodyA.parent.sprite;
			if (balloon != null) pop(balloon);
		}
		if (mine.body.y >= waterY) {
			explodeMine(mine);
		}
	}

	// update people
	for (var i in peopleGroup.children) {
		var person = peopleGroup.children[i];
		if (person.body.x < -32) {
			destroyPerson(person);
		}
	}

	// ~~~ scrolling ~~~
	oceanGroup.x = (oceanGroup.x - xVel) % game.world.width;
	bgGroup.x = (bgGroup.x - (0.4 * xVel)) % game.world.width;
	island_start.x -= xVel; 
	island_end.x -= xVel;
	
	for(var b in balloonGroup.children) {
		balloonGroup.children[b].body.moveLeft(30);
	}
	if (island_start.x < -256) {
		island_start.destroy();
	}

	updateZeppelin();
	updateWaterCurrent();
	updateRopes();

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
	if (meters < maxDistance) {
		zeppelinTargetRotation = maxRotation * rotationScale * Math.sign(zeppelinSumWeight);
	} else {
		// won!
		zeppelinTargetRotation = 0;
	}
	var rotateSpeed = 1;

	if (peopleOnZeppelin.length > 0) {
		zeroPeopleTimer = 0;
	} else {
		zeroPeopleTimer += deltaT;
		if (zeroPeopleTimer > 0.5) {
			zeppelinTargetRotation = 0.8; // steep decline
			rotateSpeed = 2;
			xVel -= 0.01;
		}
	}

	// do the tilt!
	var rotationDistance = zeppelinTargetRotation - zeppelin.body.rotation;
	if (rotationDistance > 0) {
		zeppelin.body.rotateRight(rotateSpeed);
	} else if (rotationDistance < 0) {
		zeppelin.body.rotateLeft(rotateSpeed);
	}

	// calculate Y velocity
	windVelocity = 0;
	c1 = -100;
	c2 = 0;
	c3 = 0;
	if (meters < maxDistance) {
		zeppelinTargetYV = c1 * zeppelin.body.rotation +
			c2 * (zeppelinWeightCapacity - peopleMass) +
			c3 * Math.sin(T);
	} else {
		// won!
		zeppelinTargetYV = -50;
		if (zeppelin.body.y >= zeppelinLandY) {
			zeppelinTargetYV = 0;
		}
	}

	if (zeppelin.body.y <= minZeppelinY) {
		zeppelinTargetYV = 0;
	}

	zeppelin.body.moveUp(zeppelinTargetYV);

	debugText.text += "\n";
	debugText.text += "meters: " + meters;

	debugText.text = "balance: " + zeppelinSumWeight.toFixed(2) + ", rotation: " + zeppelinTargetRotation.toFixed(2);
	debugText.text += "\n";
	debugText.text += "people on board: " + peopleOnZeppelin.length + ", people mass: " + peopleMass;
	debugText.text += "\n";
	debugText.text += "target y vel: " + zeppelinTargetYV.toFixed(2) + ", current y: " + zeppelin.body.y;
}

function updateWaterCurrent()
{
	for (var i in peopleGroup.children)
	{
		var person = peopleGroup.children[i];
		if (person.body.y > waterY) {
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

function spawnPerson(i, x, y)
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
	person.body.collides(mineCollisionGroup);
	person.body.damping = 0;
	person.body.angularDamping = 0.995;
	person.weight = weights[i];
	person.body.onBeginContact.add(personZeppelinBeginContact, this);
	person.body.onEndContact.add(personZeppelinEndContact, this);
	person.body.ropeConstraint = null;

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
	if (person.body.ropeConstraint != null) {
		person.body.ropeConstraint.bodyA.parent.ropeConstraint = null;
		game.physics.p2.removeConstraint(person.body.ropeConstraint);
		person.body.ropeConstraint = null;
	}
	if (personClicked != null && personClicked.parent.sprite === person) {
		game.physics.p2.removeConstraint(mouseConstraint);
		personClicked = null;
	}

	person.destroy();
}

function balloonShredded(body1, body2)
{
	if (body2 != null && body2.sprite != null && body2.sprite.popped == false) {
		game.physics.p2.removeConstraint(body2.ropeConstraint);
		body1.ropeConstraint = null;
		body2.ropeConstraint = null;
		pop(body2.sprite);
	}
}

function spawnBalloon(x, y, steel){
	var ropeGroup = game.add.group();
	ropesGroup.add(ropeGroup);
	ropeGroup.createMultiple(16, 'rope');
	for (var i in ropeGroup.children) {
		ropeGroup.children[i].anchor.set(0.5, 0.5);
	}
	var balloon = balloonGroup.create(x, y, 'balloon');
	if (steel) {
		balloon.frame = 15;
	} else {
		balloon.frame = Math.floor(Math.random() * 3) * 5;
	}
	game.physics.p2.enable(balloon, false);
	balloon.body.setCollisionGroup(balloonCollisionGroup);
	balloon.body.collides(propellerCollisionGroup);
	//balloon.body.gravity = -260;

	//balloon.body.collides(zeppelinCollisionGroup);
	//balloon.body.collides(peopleCollisionGroup);
	balloon.damping = 0.999;
	balloon.angularDamping = 0.995;
	balloon.body.ropeConstraint = null;
	balloon.popped = false;
	balloon.steel = steel;
	balloon.rope = ropeGroup;

	return balloon;
}

function destroyRope(balloon)
{
	if (balloon.body.ropeConstraint != null) {
		balloon.body.ropeConstraint.bodyB.parent.ropeConstraint = null;
		game.physics.p2.removeConstraint(balloon.body.ropeConstraint);

		balloon.body.ropeConstraint = null;
	}
	if (balloon.rope != null) {
		balloon.rope.destroy();
	}
}

function pop(balloon){
	destroyRope(balloon);
	balloon.popped = true;
	balloon.popTime = T;
}

function spawnPersonOnBalloon(i, x, y){
	person = spawnPerson(i, x, y);
	balloon = spawnBalloon(x + 2, y - 32, false);
	ropeConstraint = this.game.physics.p2.createDistanceConstraint(balloon.body, person.body, 20, [0,15], [0,-1])

	person.body.ropeConstraint = ropeConstraint;
	balloon.body.ropeConstraint = ropeConstraint;
}

function spawnMine(x, y){
	var mine = mineGroup.create(x, y, 'mine');
	mine.frame = 0;
	mine.dropOffset = Math.random() * 32;
	game.physics.p2.enable(mine, false);
	mine.body.setCollisionGroup(mineCollisionGroup);
	mine.body.collides([propellerCollisionGroup, zeppelinCollisionGroup, peopleCollisionGroup, mineCollisionGroup], mineCollides, self);
	mine.body.ropeConstraint = null;
	
	return mine;
}
	
function spawnMineOnBalloon(x, y, steel){
	mine = spawnMine(x, y);
	balloon = spawnBalloon(x + 2, y - 32, steel);
	ropeConstraint = this.game.physics.p2.createDistanceConstraint(balloon.body, mine.body, 20, [0,15], [0,-1])

	mine.body.ropeConstraint = ropeConstraint;
	balloon.body.ropeConstraint = ropeConstraint;
}

function mineCollides(body1, body2){
	//TODO: damage airship

	//apply impulse to all persons, based on distance to mine
	strength = -200
	for (var i in peopleGroup.children) {
		var person = peopleGroup.children[i];
		dx = person.x - body1.x;
		dy = person.y - body1.y;
		distanceSq = dx * dx + dy * dy
		//console.log(distanceSq);
		//console.log(dx/distanceSq);
		//console.log(dy/distanceSq);
		person.body.applyImpulse([strength * dx/distanceSq, strength * dy/distanceSq], 0, 0);
		if (distanceSq < 40 * 40) {
			personExploded(body1, person.body);
		}
	}
	
	explodeMine(body1.sprite);
	body2.ropeConstraint = null;
}

function destroyMine(mine)
{
	if (mine.body.ropeConstraint != null){
		var balloon = mine.body.ropeConstraint.bodyA.parent.sprite;
		if (balloon != null) pop(balloon);
		game.physics.p2.removeConstraint(mine.body.ropeConstraint);
		mine.body.ropeConstraint = null;
	}
	mine.destroy();
}

function explodeMine(mine)
{
	mine.body.clearCollision();
	spawnExplosion(mine.x, mine.y);
	destroyMine(mine);
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
	if (shapeA.body == null) return;
	if (body === zeppelin.body) {
		var person = shapeA.body.parent.sprite;
		person.touchingZeppelin = false;
	}
	if (body.sprite != null && body.sprite.key == "people") {
		for (var i in body.sprite.touchingPeople) {
			if (body.sprite.touchingPeople[i] === shapeA.body.parent.sprite) {
				body.sprite.touchingPeople.splice(i, 1);
				break;
			}
		}
	}
}

function setDistanceBar(value){
	distanceBarCursor.cameraOffset.x = 376 + value * 242
}

function personExploded(body1, body2){
	if (body2 != null && body2.sprite != null){
		//goreEmitter.area = body2.sprite.getLocalBounds()
		spawnGoreParticles(body2.x, body2.y, -200, 200)
		destroyPerson(body2.sprite);
	}
}

function personShredded(body1, body2){
	if (body2 != null && body2.sprite != null){
		//goreEmitter.area = body2.sprite.getLocalBounds()
		spawnGoreParticles(body2.x, body2.y, -300, -100);
		destroyPerson(body2.sprite);
	}
}

function updateRopes()
{
	for (var i in balloonGroup.children) {
		var balloon = balloonGroup.children[i];
		if (balloon.rope != null) {
			if (balloon.body.ropeConstraint == null) {
				// rope is not needed anymore
				balloon.rope.destroy();
				balloon.rope = null;
			} else {
				// adjust rope segments
				var object = balloon.body.ropeConstraint.bodyB.parent.sprite;
				var dx = object.x - balloon.x;
				var dy = object.y - balloon.y;
				var count = balloon.rope.children.length;
				for (var j in balloon.rope.children) {
					var segment = balloon.rope.children[j];
					segment.x = balloon.x + dx / count * j;
					segment.y = balloon.y + dy / count * j;
					segment.exists = true;
				}
			}
		}
	}
}

function spawnExplosion(x, y)
{
	var explosion = explosionGroup.create(x, y, 'explosion');
	explosion.anchor.set(0.5, 0.5);
	var anim = explosion.animations.add('explode');
	anim.play(30);
	anim.onComplete.add(function(){ explosion.destroy(); });
}

function spawnGoreParticles(x, y, minVelX, maxVelX)
{
	goreEmitter.x = x;
	goreEmitter.y = y;
	goreEmitter.setXSpeed(minVelX, maxVelX);

	goreEmitter.start(true, 2000, null, 20);
}

function render()
{
}

