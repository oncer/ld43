
var config = {
	type: Phaser.AUTO,
	width: 512,
	height: 288,
   pixelArt: true,
   zoom: 2,
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 200 }
		}
	},
	scene: {
		preload: preload,
		create: create
	}
};

function preload ()
{
	this.load.image('bg', 'gfx/background.png');
   this.load.image('zeppelin', 'gfx/zeppelin.png')
}

function create ()
{
	this.add.image(512/2, 288/2, 'bg');
   this.add.image(144, 128, 'zeppelin');
}

function resize() {
    let canvas = document.querySelector("canvas");
    let width = window.innerWidth;
    let height = window.innerHeight;
    let wratio = width / height;
    let ratio = config.width / config.height;
    if (wratio < ratio) {
        canvas.style.width = width + "px";
        canvas.style.height = (width / ratio) + "px";
    } else {
        canvas.style.width = (height * ratio) + "px";
        canvas.style.height = height + "px";
    }
}

window.onload = () => {
  new Phaser.Game(config)
  resize()
  window.addEventListener("resize",resize,false)
}

