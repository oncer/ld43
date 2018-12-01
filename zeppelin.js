class Zeppelin extends Phaser.GameObjects.Image
{
   constructor(scene, x, y) {
      super(scene, x, y, 'zeppelin');
      scene.children.add(this);
   }
};

