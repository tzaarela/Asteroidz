import Phaser from 'phaser';

console.log(`Phaser version: ${Phaser.VERSION}`);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#000000',
  scene: {
    preload() {},
    create() {},
    update() {},
  },
};

new Phaser.Game(config);
