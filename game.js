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
   game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
}

function create ()
{
   game.physics.startSystem(Phaser.Physics.ARCADE)
   game.physics.arcade.gravity.y = 100;

   game.world.setBounds(0, 0, 512, 864);

   game.add.sprite(0, 0, 'bg');
   propeller = game.add.sprite(0, 80, 'propeller');
   zeppelin = game.add.sprite(18, 64, 'zeppelin');
   zeppelin.addChild(propeller);
   zeppelinFloor = game.add.sprite(0, 128, 'zeppelin-floor');
   zeppelin.addChild(zeppelinFloor);
   game.camera.follow(zeppelin);
   game.camera.deadzone = new Phaser.Rectangle(16, 16, game.width - 16, game.height - zeppelin.height - 64);
   game.camera.lerpY = 0.1;

   zeppelin.weight = 500;

   personClicked = null;
   personClickOffset = null;

   peopleGroup = game.add.group();
   peopleGroup.enableBody = true;
   peopleGroup.phyicsBodyType = Phaser.Physics.ARCADE;
   peopleGroup.create(0, 0, 'people');
   peopleGroup.create(32, 0, 'people').frame = 1;

   game.physics.enable(zeppelinFloor, Phaser.Physics.ARCADE);

   zeppelinFloor.body.gravity = 0;

   // set people start pos
   for (var i in peopleGroup.children) {
      var person = peopleGroup.children[i];
      person.y = zeppelin.y + zeppelin.height - 16 - person.height;
      person.x = 100 + person.x % 100;
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
            personClickOffset = Phaser.Point.subtract(clickPos, new Phaser.Point(personClicked.body.x, personClicked.body.y));
            console.log(personClickOffset);
         }
      } else {
         personClicked.body.enabled = false;
         game.physics.arcade.accelerateToPointer(personClicked, game.input.activePointer);
      }
   } else {
      if (personClicked != null) {
         personClicked.body.enabled = false;
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

