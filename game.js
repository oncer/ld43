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
   game.physics.startSystem(Phaser.Physics.ARCADE)
   game.physics.arcade.gravity.y = 100;

   game.world.setBounds(0, 0, 512, 864);

   game.add.sprite(0, 0, 'bg');
   propeller = game.add.sprite(0, 80, 'propeller');
   zeppelin = game.add.sprite(18, 692, 'zeppelin');
   zeppelin.addChild(propeller);
   zeppelinFloor = game.add.sprite(0, 128, 'zeppelin-floor');
   zeppelin.addChild(zeppelinFloor);

   // ocean waves
   oceanGroup = game.add.group();
   var f = 0;
   for (var x = 0; x < game.world.width; x += 16)
   {
      var wave = oceanGroup.create(x, game.world.height - 32, 'ocean');
      var waveAnim = wave.animations.add('wave');
      waveAnim.play(10, true);
   }
 
   // camera
   game.camera.follow(zeppelin);
   game.camera.deadzone = new Phaser.Rectangle(16, 16, game.width - 16, game.height - zeppelin.height - 64);
   game.camera.lerpY = 0.1;

   

   //zeppelin.weight = 500;

   personClicked = null;
   personClickOffset = null;

   peopleGroup = game.add.group();
   peopleGroup.enableBody = true;
   peopleGroup.phyicsBodyType = Phaser.Physics.ARCADE;
   for (var i = 0; i < 4; i++) {
      peopleGroup.create(i * 32, 0, 'people').frame = i;
   }

   game.physics.enable(zeppelinFloor, Phaser.Physics.ARCADE);

   zeppelinFloor.body.gravity = 0;

   // set people start pos
   for (var i in peopleGroup.children) {
      var person = peopleGroup.children[i];
      person.y = zeppelin.y + zeppelin.height - 16 - person.height;
      person.x = 64 + person.x % 200;
   }
}

function update ()
{
   // mouse/touch logic
   if (game.input.activePointer.isDown) {
      var clickPos = new Phaser.Point(game.camera.view.x + game.input.activePointer.x, game.camera.view.y + game.input.activePointer.y);
      if (personClicked == null) {
         peopleClicked = game.physics.arcade.getObjectsUnderPointer(game.input.activePointer, peopleGroup);
         if (peopleClicked.length > 0) {
            personClicked = peopleClicked[0];
            personClickOffset = Phaser.Point.subtract(clickPos, new Phaser.Point(personClicked.x, personClicked.y));
            console.log(personClickOffset);
         }
      } else {
         personClicked.x = clickPos.x - personClickOffset.x;
         personClicked.y = clickPos.y - personClickOffset.y;
      }
   } else {
      if (personClicked != null) {
         personClicked.body.reset(personClicked.x, personClicked.y);
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
   //zeppelin.y += 1;
   
   game.physics.arcade.collide(peopleGroup, zeppelinFloor);
}

function render()
{
}

