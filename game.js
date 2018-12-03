//TODO: start on click
//TODO: fadein/out für restart
//XXX: mehrere ballons pro person

class GameState extends Phaser.State
{
preload ()
{
	this.start = false; // click to start - if false, the zeppelin will not fly and nothing else will happen
	this.winScreen = null;
	this.loseScreen = null;
	this.initialZeppelinWeightCapacity = 150; // could become less over time
	this.maxRotation = 0.5; // maximum rotation
	this.minZeppelinY = 107;
	this.zeppelinLandY = 714;
	this.waterY = 832;
	this.goreEmitter = null;
	this.zeroPeopleTimer; // counts up as soon as there is no one left on the zeppelin
	this.zeroPeopleTimeout = 0.5; // how many seconds until the zeppelin drops when zero people are on board

	this.meters = 0;
	this.maxDistance = 9001; // this is the distance to the final destination
	this.timer = 0; // for spawning people etc.

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
	game.load.spritesheet('bird', 'gfx/bird.png', 32, 32);
	game.load.image('rope', 'gfx/rope.png');
	game.load.image('island_start', 'gfx/island_start.png');
	game.load.image('island_end', 'gfx/island_end.png');
	game.load.image('win_screen', 'gfx/winscreen.png');
	game.load.image('lose_screen', 'gfx/losescreen.png');
	game.load.image('start_screen', 'gfx/startscreen.png');
	game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
	game.load.audio('music', 'sfx/theme.ogg');
}

create ()
{
	// input keys
	this.keySpacebar = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);

	game.physics.startSystem(Phaser.Physics.P2JS)
	game.physics.p2.gravity.y = 320;
	game.physics.p2.friction = 0.4;
	game.physics.p2.applyDamping = true;
	game.physics.p2.setImpactEvents(true);
	this.zeppelinCollisionGroup = game.physics.p2.createCollisionGroup();
	this.peopleCollisionGroup = game.physics.p2.createCollisionGroup();
	this.balloonCollisionGroup = game.physics.p2.createCollisionGroup();
	this.propellerCollisionGroup = game.physics.p2.createCollisionGroup();
	this.mineCollisionGroup = game.physics.p2.createCollisionGroup();
	this.birdCollisionGroup = game.physics.p2.createCollisionGroup();

	game.world.setBounds(0, 0, 512, 864);
	game.camera.scale.setTo(2);

	// 2 bgs for scrolling
	this.bgGroup = game.add.group();
	this.bgGroup.create(0, 0, 'bg');
	this.bgGroup.create(512, 0, 'bg');


	// starting island
	this.island_start = game.add.sprite(0, game.world.height - 80, 'island_start');
	// goal island
	this.island_end = game.add.sprite(this.maxDistance + 256, game.world.height - 80, 'island_end');

	this.zeppelin = game.add.sprite(164, this.zeppelinLandY, 'zeppelin');
	game.physics.enable(this.zeppelin, Phaser.Physics.P2JS);
	//zeppelin.addChild(propeller);
	this.zeppelin.body.static = true;
	this.zeppelin.body.gravity = 0;
	this.zeppelin.body.clearShapes();
	this.zeppelin.body.addRectangle(224, 16, 0, 64 + 32);
	this.zeppelin.body.setCollisionGroup(this.zeppelinCollisionGroup);
	this.zeppelin.body.collides([this.peopleCollisionGroup, this.mineCollisionGroup, this.birdCollisionGroup]);
	this.propeller = game.add.sprite(this.zeppelin.body.x - 118, this.zeppelin.body.y + 74, 'propeller');

	game.physics.enable(this.propeller, Phaser.Physics.P2JS);
	this.propeller.body.clearShapes();
	this.propeller.body.addRectangle(5, 60, -4, 0);
	this.propeller.body.setCollisionGroup(this.propellerCollisionGroup);
	this.propeller.body.collides(this.peopleCollisionGroup, this.personShredded, this);
	this.propeller.body.collides(this.balloonCollisionGroup, this.balloonShredded, this);
	this.propeller.body.collides(this.birdCollisionGroup, this.personShredded, this);
	this.propeller.body.collides(this.mineCollisionGroup);
	game.physics.p2.createLockConstraint(this.zeppelin.body, this.propeller.body, [144-26, 80-154]);

	this.zeppelinTargetRotation = 0; // slowly rotate to this value
	this.zeppelinSumWeight = 0; // negative=tilt to left, positive=tilt to right
	// target velocity in Y direction
	this.zeppelinTargetYV = 0;
	this.peopleMass = 0;


	// camera
	game.camera.follow(this.zeppelin);
	game.camera.deadzone = new Phaser.Rectangle(0, 128, game.width, game.height - 440);
	game.camera.lerpY = 0.1;

	this.xVel = 0;

	//zeppelin.weight = 500;

	this.personClicked = null;
	this.personClickOffset = null;

	this.ropesGroup = game.add.group();
	this.peopleGroup = game.add.group();
	//peopleGroup.enableBody = true;
	//peopleGroup.phyicsBodyType = Phaser.Physics.P2JS;
	
	// initial group of people
	{
		var typesSpawned = [];
		for (var i = 0; i < 5; i++) {
			var type = Math.floor(Math.random() * 8);
			while (typesSpawned[type] == 1) {
				type = (type + 1) % 8;
			}
			typesSpawned[type] = 1;
			this.spawnPerson(type, 84 + i*24 + Math.random() * 6, this.zeppelin.y + 72);
		}
	}

	this.balloonGroup = game.add.group();

	// create physics body for mouse which we will use for dragging clicked bodies
	this.mouseBody = new p2.Body();
	game.physics.p2.world.addBody(this.mouseBody);

	this.mineGroup = game.add.group();
	
	this.birdGroup = game.add.group();

	// ocean waves
	this.oceanGroup = game.add.group();
	var f = 0;
	for (var x = 0; x < 2 * game.world.width; x += 16)
	{
		var wave = this.oceanGroup.create(x, game.world.height - 32, 'ocean');
		var waveAnim = wave.animations.add('wave');
		waveAnim.play(5, true);
	}

	var style = { font: "14px Consolas", fill: "#ff004c", align: "center" };
	this.debugText = game.add.text(256, 240, "debug text", style);
	this.debugText.anchor.set(0.5);
	this.debugText.exists = false;
	// HUD
	this.distanceBar = game.add.sprite(384, 10, 'hudDistance');
	this.distanceBar.fixedToCamera = true;

	this.distanceBarCursor = game.add.sprite(0, 10, 'hudDistanceCursor');
	this.distanceBarCursor.fixedToCamera = true;
	this.setDistanceBar(0);

	this.explosionGroup = game.add.group();

	// gore emitter
	this.goreEmitter = game.add.emitter(0, 0, 100);
	this.goreEmitter.makeParticles('gore', [0,1,2,3,4,5,6], 300);
	this.goreEmitter.gravity = 200;
	this.goreEmitter.setXSpeed(-300,-100);

	//start screen
	this.showStartScreen();
	
	this.music = game.add.audio('music');
	this.music.play('', 0, 1, true);
}

startGame()
{
	this.start = true;
	// NPE
	this.npePerson = this.spawnPersonOnBalloon(8, 530, 680);

	var tween = game.add.tween(this.titleScreen)
	tween.to( { alpha: 0 }, 3000, Phaser.Easing.Exponential.In, true, 0, 0, false);
	tween.onComplete.add(this.showStartScreen2, this);

	this.propeller.animations.add('propel').play(15, true);
}

update ()
{
	// time since last frame, in seconds
	this.deltaT = game.time.elapsed/1000;

	// time since some start point, in seconds
	this.T = game.time.now/1000;

	if (!this.start && game.input.activePointer.justPressed()) {
		this.startGame();
	}

	var mouseX = game.input.activePointer.position.x / game.camera.scale.y;
	var mouseY = (game.input.activePointer.position.y + game.camera.view.y) / game.camera.scale.y;

	if (this.start) {
		if (this.zeroPeopleTimer >= this.zeroPeopleTimeout) {
			this.xVel = Math.max(this.xVel - .002, 0);
		} else if (this.meters < this.maxDistance) {
			this.xVel = Math.min(this.xVel + .002, 1);
		} else {
			this.xVel = 0
			
			// ~~~ Winning Condition ~~~
			if (this.zeppelin.body.x < game.world.width - 128) {
				this.zeppelin.body.x += 1;
				for(var i in this.peopleGroup.children) {
					this.peopleGroup.children[i].body.x += 1;
				}
			} else {
				if (this.zeppelin.body.y >= this.zeppelinLandY - 0.1 && Math.abs(this.zeppelin.body.rotation) < 0.00001 && this.winScreen == null) {
					this.showWinScreen();
				}
				game.physics.p2.friction = 1;
			}
		}
		this.meters += this.xVel;
		this.timer ++;
	}
	
	this.setDistanceBar(this.meters/this.maxDistance);

	if (this.meters < this.maxDistance && this.timer > 0 && this.timer % 360 == 0 && this.xVel > 0 && this.npePerson == null) {
		var v = Phaser.Math.between(0, 11);
		var typesNotOnZeppelin = [];
		for (var i = 0; i < 12; i++) {
			if (!this.personTypeOnZeppelin(v)) {
				typesNotOnZeppelin.push(v);
			}
		}
		if (typesNotOnZeppelin.length > 0) {
			v = typesNotOnZeppelin[Phaser.Math.between(0, typesNotOnZeppelin.length - 1)];
		}
		if (Math.floor(Math.random() * 2)) {
			this.spawnPersonOnBalloon(v, 512 + 32, this.zeppelin.y + Phaser.Math.between(-64, 64));
		} else {
			var steel = false;
			if (Math.random() < 0.5) steel = true;
			this.spawnMineOnBalloon(512 + 32, this.zeppelin.y + Phaser.Math.between(-64, 64), steel);
		}
	}
	
	if (this.meters < this.maxDistance && this.npePerson == null && this.timer > 0 && this.timer % 300 == 0 && this.npePerson == null && Math.random() < 0.5) {
		this.spawnBird(512+32, this.zeppelin.y + Phaser.Math.between(-120, 160));
	}
	
	// mouse/touch logic
	if (game.input.activePointer.isDown && this.meters < this.maxDistance) {
		this.mouseBody.position[0] = game.physics.p2.pxmi(mouseX);
		this.mouseBody.position[1] = game.physics.p2.pxmi(mouseY);
		var clickPos = new Phaser.Point(game.physics.p2.pxmi(mouseX), game.physics.p2.pxmi(mouseY));
		if (this.personClicked == null) {
			//getObjectsUnderPointer is not in p2
			var peopleClicked = game.physics.p2.hitTest(new Phaser.Point(mouseX, mouseY), this.peopleGroup.children);
			if (peopleClicked.length > 0) {
				for (var i in peopleClicked) {
					if (!peopleClicked[i].parent.sprite.inWater) {
						this.personClicked = peopleClicked[i];
						break;
					}
				}
				if (this.personClicked != null) {
					//personClicked = peopleClicked[0];
					//personClickOffset = Phaser.Point.subtract(clickPos, new Phaser.Point(personClicked.x, personClicked.y));
					//console.log(personClicked);

					var localPointInBody = [0, 0];
					// this function takes physicsPos and coverts it to the body's local coordinate system
					this.personClicked.toLocalFrame(localPointInBody, this.mouseBody.position);
					// use a revoluteContraint to attach mouseBody to the clicked body
					this.mouseConstraint = this.game.physics.p2.createRevoluteConstraint(this.mouseBody, [0, 0], this.personClicked, [game.physics.p2.mpxi(localPointInBody[0]), game.physics.p2.mpxi(localPointInBody[1])]);

					//console.log(personClicked.parent.rope);
					if (this.personClicked.parent.ropeConstraint != null){
						this.personClicked.parent.ropeConstraint.bodyA.parent.ropeConstraint = null;
						game.physics.p2.removeConstraint(this.personClicked.parent.ropeConstraint);

						this.personClicked.parent.ropeConstraint = null;
					}
				}
			}
			var balloonClicked = game.physics.p2.hitTest(new Phaser.Point(mouseX, mouseY), this.balloonGroup.children);
			if (balloonClicked.length > 0){
				for (var i in balloonClicked) {
					balloon = balloonClicked[i];
					if (!balloon.parent.sprite.popped && !balloon.parent.sprite.steel) {
						this.pop(balloon.parent.sprite);
						break;
					}
				}
			}

		} else {
			// moves to the top z-layer
			this.personClicked.parent.sprite.moveUp();
			// disables collision with other people
			for (var i in this.personClicked.parent.collidesWith) {
				if (this.personClicked.parent.collidesWith[i] === this.peopleCollisionGroup || this.personClicked.parent.collidesWith[i] === this.zeppelinCollisionGroup) {
					this.personClicked.parent.collidesWith.splice(i, 1);
				}
			}
			this.personClicked.parent.updateCollisionMask();
			
			if (this.personClicked.parent.sprite.inWater) {
				game.physics.p2.removeConstraint(this.mouseConstraint);
				this.personClicked = null;
			}
			
		}
	} else {
		if (this.personClicked != null) {
			game.physics.p2.removeConstraint(this.mouseConstraint);
			// enables collision again
			this.personClicked.parent.collides(this.peopleCollisionGroup);
			this.personClicked.parent.collides(this.zeppelinCollisionGroup);
		}
		this.personClicked = null;
	}

	// update balloons
	for (var b in this.balloonGroup.children) {
		var balloon = this.balloonGroup.children[b];
		balloon.body.angle = 0;
		if (balloon.popped) {
			if ((this.T - balloon.popTime)*30 > (balloon.frame % 5)){
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
				this.destroyRope(balloon);
				balloon.destroy();
			}
		}
	}

	// update mines
	for (var i in this.mineGroup.children) {
		var mine = this.mineGroup.children[i];
		// drop mine over zeppelin
		if (mine.body.y < this.zeppelin.body.y + 64
			 && mine.body.y > (game.camera.view.y / game.camera.scale.y) + 32
			 && mine.body.x <= this.zeppelin.body.x + mine.dropOffset
			 && mine.body.ropeConstraint != null) {
			var balloon = mine.body.ropeConstraint.bodyA.parent.sprite;
			//console.log("cam " + game.camera.view.y + " mine " + mine.body.y);
			if (balloon != null) this.destroyRope(balloon);
		}
		if (mine.body.y >= this.waterY) {
			this.explodeMine(mine);
		}
	}
	
	// update people
	for (var i in this.peopleGroup.children) {
		var person = this.peopleGroup.children[i];
		if (person.body.x < -32) {
			this.destroyPerson(person);
		}
	}

	// update birds
	for (var i in this.birdGroup.children) {
		var bird = this.birdGroup.children[i];
		bird.body.applyForce([0,game.physics.p2.gravity.y/40], 0, 0);
		if (bird.body.velocity.y > 50) {
			bird.body.applyImpulse([0,5], 0, 0);
		}
		if (bird.body.velocity.x > -80) {
			bird.body.applyImpulse([1,0], 0, 0);
		}
	}
	

	// ~~~ scrolling ~~~
	this.oceanGroup.x = (this.oceanGroup.x - this.xVel) % game.world.width;
	this.bgGroup.x = (this.bgGroup.x - (0.4 * this.xVel)) % game.world.width;
	this.island_start.x -= this.xVel; 
	this.island_end.x -= this.xVel;
	
	for(var b in this.balloonGroup.children) {
		this.balloonGroup.children[b].body.moveLeft(30);
	}
	if (this.island_start.x < -256) {
		this.island_start.destroy();
	}

	this.updateZeppelin();
	this.updateWaterCurrent();
	this.updateRopes();
	if (this.npePerson != null) this.updateNpePerson();

	this.debugText.y = 240 + game.camera.view.y / game.camera.scale.y; 
	//zeppelin.body.rotateRight(1);

}

showWinScreen() {
	this.winScreen = game.add.sprite(0, 16, 'win_screen');
	this.winScreen.fixedToCamera = true;
	
	this.winScreen.alpha = 0;
	game.add.tween(this.winScreen).to( { alpha: 1 }, 200, Phaser.Easing.Linear.None, true, 0, 0, false);
}

showLoseScreen() {
	this.loseScreen = game.add.sprite(0, 0, 'lose_screen');
	this.loseScreen.fixedToCamera = true;
	
	this.loseScreen.alpha = 0;
	game.add.tween(this.loseScreen).to( { alpha: 1 }, 2000, Phaser.Easing.Exponential.Out, true, 0, 0, false);
}

showStartScreen() {
	this.titleScreen = game.add.sprite(0, 0, 'start_screen');
	this.titleScreen.fixedToCamera = true;
}

showStartScreen2() {
	this.titleScreen.destroy();
}

recursivelyIndirectTouchingQuery(person)
{
	person.flagged = true;
	for (var i in person.touchingPeople)
	{
		var otherPerson = person.touchingPeople[i];
		if (otherPerson.touchingZeppelin) {
			return true;
		} else if (!otherPerson.flagged) {
			return this.recursivelyIndirectTouchingQuery(otherPerson);
		}
	}
}

personIndirectlyTouchingZeppelin(person)
{
	for (var i in this.peopleGroup.children) {
		this.peopleGroup.children[i].flagged = false;
	}
	return this.recursivelyIndirectTouchingQuery(person);
}

updateZeppelin()
{
	// determine who is on the zeppelin
	// - even indirectly, if standing on top of each other!
	this.peopleOnZeppelin = [];
	for (var i in this.peopleGroup.children) {
		var person = this.peopleGroup.children[i];
		if (person.touchingZeppelin
			|| this.personIndirectlyTouchingZeppelin(person)) {
			this.peopleOnZeppelin.push(person);
		}
	}

	// tilt based on people's weight
	var leftWeight = 0;
	var rightWeight = 0;
	var targetPeopleMass = 0;
	for (var i in this.peopleOnZeppelin)
	{
		var person = this.peopleOnZeppelin[i];
		targetPeopleMass += person.weight;
		var distanceFromCenter = (person.x - this.zeppelin.x) / 112;
		if (distanceFromCenter < 0) {
			leftWeight -= distanceFromCenter * person.weight;
		} else {
			rightWeight += distanceFromCenter * person.weight;
		}
	}
	var targetSumWeight = rightWeight - leftWeight;
	if (this.zeppelinSumWeight > targetSumWeight) {
		this.zeppelinSumWeight = Math.max(targetSumWeight, this.zeppelinSumWeight - 0.5);
	} else if (this.zeppelinSumWeight < targetSumWeight) {
		this.zeppelinSumWeight = Math.min(targetSumWeight, this.zeppelinSumWeight + 0.5);
	}

	if (this.peopleMass > targetPeopleMass) {
		this.peopleMass--;
	} else if (this.peopleMass < targetPeopleMass) {
		this.peopleMass++;
	}
	var rotationScale = Math.min(1, Math.abs(this.zeppelinSumWeight / 30));
	if (this.meters < this.maxDistance) {
		this.zeppelinTargetRotation = this.maxRotation * rotationScale * Math.sign(this.zeppelinSumWeight);
	} else {
		// won!
		this.zeppelinTargetRotation = 0;
	}
	var rotateSpeed = 1;

	if (this.peopleOnZeppelin.length > 0) {
		this.zeroPeopleTimer = 0;
	} else {
		this.zeroPeopleTimer += this.deltaT;
		if (this.zeroPeopleTimer > this.zeroPeopleTimeout) {
			this.zeppelinTargetRotation = 0.8; // steep decline
			rotateSpeed = 2;
		}
	}

	// do the tilt!
	if (this.start) {
		var rotationDistance = this.zeppelinTargetRotation - this.zeppelin.body.rotation;
		if (Math.abs(rotationDistance) < 0.001) {
			this.zeppelin.body.rotation = this.zeppelinTargetRotation;
			this.zeppelin.body.angularVelocity = 0;
		} else if (rotationDistance > 0) {
			this.zeppelin.body.rotateRight(rotateSpeed);
		} else if (rotationDistance < 0) {
			this.zeppelin.body.rotateLeft(rotateSpeed);
		}
	}

	// calculate Y velocity
	var windVelocity = 0;
	var zeppelinWeightCapacity = this.initialZeppelinWeightCapacity * (0.5 - this.meters / this.maxDistance);
	var c1 = -100;
	var c2 = 0.2;
	var c3 = 0;
	if (this.meters < this.maxDistance) {
		this.zeppelinTargetYV = c1 * this.zeppelin.body.rotation +
			c2 * (zeppelinWeightCapacity - this.peopleMass) +
			c3 * Math.sin(this.T);
	} else {
		// won!
		this.zeppelinTargetYV = -50;
		if (this.zeppelin.body.y >= this.zeppelinLandY) {
			this.zeppelinTargetYV = 0;
		}
	}

	if (this.zeppelin.body.y <= this.minZeppelinY) {
		this.zeppelinTargetYV = Math.min(0, this.zeppelinTargetYV);
	}


	if (this.zeroPeopleTimer > this.zeroPeopleTimeout
		 && this.zeppelin.body.y + 80 > this.waterY) {
		this.zeppelinTargetYV = Math.max(-8, Math.min(0.0, this.zeppelinTargetYV));
	}
	
	if (this.zeppelin.body.y + 60 > this.waterY && this.loseScreen == null) {
		this.showLoseScreen();
	}


	if (this.loseScreen != null && this.loseScreen.alpha >= 1) {
		if (game.input.activePointer.justPressed()) {
			game.state.start(game.state.current);
		}
	}

	if (this.start) {
		this.zeppelin.body.moveUp(this.zeppelinTargetYV);
	}

	this.debugText.text += "\n";
	this.debugText.text += "meters: " + this.meters;

	this.debugText.text = "balance: " + this.zeppelinSumWeight.toFixed(2) + ", rotation: " + this.zeppelinTargetRotation.toFixed(2);
	this.debugText.text += "\n";
	this.debugText.text += "people on board: " + this.peopleOnZeppelin.length + ", people mass: " + this.peopleMass + "/" + zeppelinWeightCapacity.toFixed(2);
	this.debugText.text += "\n";
	this.debugText.text += "target y vel: " + this.zeppelinTargetYV.toFixed(2) + ", current y: " + this.zeppelin.body.y.toFixed(2);
}

updateWaterCurrent()
{
	for (var i in this.peopleGroup.children)
	{
		var person = this.peopleGroup.children[i];
		if (person.body.y > this.waterY) {
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

spawnPerson(i, x, y)
{
	var weights = [ 13, 13, 13, 13, 21, 21, 21, 21, 34, 34, 34, 34 ];
	var person = this.peopleGroup.create(x, y, 'people');
	person.frame = i;
	person.touchingZeppelin = false;
	person.touchingPeople = []
	person.inWater = false;
	game.physics.p2.enable(person, false);
	person.body.clearShapes();
	person.body.loadPolygon('peopleShapes', 'person' + i);
	person.body.setCollisionGroup(this.peopleCollisionGroup);
	person.body.collides(this.zeppelinCollisionGroup);
	person.body.collides(this.peopleCollisionGroup);
	person.body.collides(this.propellerCollisionGroup);
	person.body.collides(this.mineCollisionGroup);
	person.body.collides(this.birdCollisionGroup);
	person.body.damping = 0;
	person.body.angularDamping = 0.995;
	person.weight = weights[i];
	person.body.onBeginContact.add(this.personZeppelinBeginContact, this);
	person.body.onEndContact.add(this.personZeppelinEndContact, this);
	person.body.ropeConstraint = null;

	return person;
}

destroyPerson(person)
{
	if (person === this.npePerson) {
		this.npePerson = null;
	}
	// make sure the person is not referenced anymore
	for (var i in this.peopleGroup.children)
	{
		var otherPerson = this.peopleGroup.children[i];
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
	if (this.personClicked != null && this.personClicked.parent.sprite === person) {
		game.physics.p2.removeConstraint(this.mouseConstraint);
		this.personClicked = null;
	}

	person.destroy();
}

balloonShredded(body1, body2)
{
	if (body2 != null && body2.sprite != null && body2.sprite.popped == false) {
		game.physics.p2.removeConstraint(body2.ropeConstraint);
		body1.ropeConstraint = null;
		body2.ropeConstraint = null;
		this.pop(body2.sprite);
	}
}

spawnBalloon(x, y, steel){
	var ropeGroup = game.add.group();
	this.ropesGroup.add(ropeGroup);
	ropeGroup.createMultiple(16, 'rope');
	for (var i in ropeGroup.children) {
		ropeGroup.children[i].anchor.set(0.5, 0.5);
	}
	var balloon = this.balloonGroup.create(x, y, 'balloon');
	if (steel) {
		balloon.frame = 15;
	} else {
		balloon.frame = Math.floor(Math.random() * 3) * 5;
	}
	game.physics.p2.enable(balloon, false);
	balloon.body.setCollisionGroup(this.balloonCollisionGroup);
	balloon.body.collides(this.propellerCollisionGroup);
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

destroyRope(balloon)
{
	if (balloon.body.ropeConstraint != null) {
		balloon.body.ropeConstraint.bodyB.parent.ropeConstraint = null;
		game.physics.p2.removeConstraint(balloon.body.ropeConstraint);

		balloon.body.ropeConstraint = null;
	}
}

pop(balloon)
{
	this.destroyRope(balloon);
	balloon.popped = true;
	balloon.popTime = this.T;
}

spawnPersonOnBalloon(i, x, y){
	var person = this.spawnPerson(i, x, y);
	var balloon = this.spawnBalloon(x + 2, y - 32, false);
	var ropeConstraint = this.game.physics.p2.createDistanceConstraint(balloon.body, person.body, 20, [0,15], [0,-1])

	person.body.ropeConstraint = ropeConstraint;
	balloon.body.ropeConstraint = ropeConstraint;
	
	return person;
}

spawnMine(x, y){
	var mine = this.mineGroup.create(x, y, 'mine');
	mine.frame = 0;
	mine.dropOffset = Math.random() * 64;
	game.physics.p2.enable(mine, false);
	mine.body.setCollisionGroup(this.mineCollisionGroup);
	mine.body.collides([this.propellerCollisionGroup, this.zeppelinCollisionGroup, this.peopleCollisionGroup, this.mineCollisionGroup], this.mineCollides, this);
	mine.body.ropeConstraint = null;
	
	return mine;
}
	
spawnMineOnBalloon(x, y, steel){
	var mine = this.spawnMine(x, y);
	var balloon = this.spawnBalloon(x + 2, y - 32, steel);
	var ropeConstraint = this.game.physics.p2.createDistanceConstraint(balloon.body, mine.body, 20, [0,15], [0,-1])

	mine.body.ropeConstraint = ropeConstraint;
	balloon.body.ropeConstraint = ropeConstraint;
}

mineCollides(body1, body2){
	//TODO: damage airship

	//apply impulse to all persons, based on distance to mine
	var strength = -200;
	for (var i in this.peopleGroup.children) {
		var person = this.peopleGroup.children[i];
		var dx = person.x - body1.x;
		var dy = person.y - body1.y;
		var distanceSq = dx * dx + dy * dy
		//console.log(distanceSq);
		//console.log(dx/distanceSq);
		//console.log(dy/distanceSq);
		person.body.applyImpulse([strength * dx/distanceSq, strength * dy/distanceSq], 0, 0);
		if (distanceSq < 40 * 40) {
			this.personExploded(body1, person.body);
		}
	}
	
	this.explodeMine(body1.sprite);
	body2.ropeConstraint = null;
}

destroyMine(mine)
{
	if (mine.body.ropeConstraint != null){
		var balloon = mine.body.ropeConstraint.bodyA.parent.sprite;
		if (balloon != null) this.destroyRope(balloon);
		game.physics.p2.removeConstraint(mine.body.ropeConstraint);
		mine.body.ropeConstraint = null;
	}
	mine.destroy();
}

spawnBird(x, y) {
	var bird = this.birdGroup.create(x, y, 'bird');
	bird.animations.add('birdfly').play(15, true);
	game.physics.p2.enable(bird, false);
	bird.body.clearShapes();
	bird.body.addRectangle(22, 8, 0, 0);
	bird.body.setCollisionGroup(this.birdCollisionGroup);
	bird.body.collides([this.propellerCollisionGroup, this.zeppelinCollisionGroup, this.peopleCollisionGroup]);
	
	bird.body.fixedRotation = true;
	
	bird.body.applyImpulse([6, 0], 0, 0);
	
	return bird;
}

explodeMine(mine)
{
	mine.body.clearCollision();
	this.spawnExplosion(mine.x, mine.y);
	this.destroyMine(mine);
}

personZeppelinBeginContact(body, bodyB, shapeA, shapeB, equation)
{
	if (body === this.zeppelin.body) {
		var person = shapeA.body.parent.sprite;
		person.touchingZeppelin = true;
	}
	if (body.sprite.key == "people") {
		body.sprite.touchingPeople.push(shapeA.body.parent.sprite);
	}
}

personZeppelinEndContact(body, bodyB, shapeA, shapeB, equation)
{
	if (shapeA.body == null) return;
	if (body === this.zeppelin.body) {
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

setDistanceBar(value){
	this.distanceBarCursor.cameraOffset.x = 376 + value * 242
}

personExploded(body1, body2){
	if (body2 != null && body2.sprite != null){
		//goreEmitter.area = body2.sprite.getLocalBounds()
		var dx = body2.x - body1.x;
		if (dx < 0) {
			this.spawnGoreParticles(body2.x, body2.y, -300, -100)
		} else {
			this.spawnGoreParticles(body2.x, body2.y, 100, 300)
		}
		this.destroyPerson(body2.sprite);
	}
}

personShredded(body1, body2){
	if (body2 != null && body2.sprite != null){
		//goreEmitter.area = body2.sprite.getLocalBounds()
		this.spawnGoreParticles(body2.x, body2.y, -300, -100);
		this.destroyPerson(body2.sprite);
	}
}

updateRopes()
{
	for (var i in this.balloonGroup.children) {
		var balloon = this.balloonGroup.children[i];
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

spawnExplosion(x, y)
{
	var explosion = this.explosionGroup.create(x, y, 'explosion');
	explosion.anchor.set(0.5, 0.5);
	var anim = explosion.animations.add('explode');
	anim.play(30);
	anim.onComplete.add(function(){ explosion.destroy(); });
}

spawnGoreParticles(x, y, minVelX, maxVelX)
{
	this.goreEmitter.x = x;
	this.goreEmitter.y = y;
	this.goreEmitter.setXSpeed(minVelX, maxVelX);

	this.goreEmitter.start(true, 2000, null, 20);
}

updateNpePerson()
{
	if (this.npePerson.body.y > this.zeppelin.body.y + 32) {
		this.npePerson.body.y--;
	}
	if (this.npePerson.body.x < this.zeppelin.body.x + 130) {
		if (this.npePerson.body != null && this.npePerson.body.ropeConstraint != null) {
			var balloon = this.npePerson.body.ropeConstraint.bodyA.parent.sprite;
			if (balloon != null) this.pop(balloon);
		}
		this.npePerson = null;
	}
}

personTypeOnZeppelin(type)
{
	for (var i in this.peopleOnZeppelin) {
		if (this.peopleOnZeppelin[i].frame === type) return true;
	}
	return false;
}

render()
{
}

}


game = new Phaser.Game(
	1024, 576,
	Phaser.AUTO,
	'lighter-than-air',
);

game.transparent = false;
game.antialias = false;

game.state.add('Game', GameState, false);
game.state.start('Game');
