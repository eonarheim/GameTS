/// <reference path="jasmine.d.ts" />
/// <reference path="support/js-imagediff.d.ts" />
/// <reference path="require.d.ts" />
/// <reference path="TestUtils.ts" />
/// <reference path="Mocks.ts" />

describe('A UIActor', () => {
   var uiActor: ex.UIActor;
   var engine: ex.Engine;
   var scene: ex.Scene;
   var mock = new Mocks.Mocker();
   
   beforeEach(() => {
      jasmine.addMatchers(imagediff.jasmine);

      uiActor = new ex.UIActor(50, 50, 100, 50);
      uiActor.color = ex.Color.Blue;
      uiActor.collisionType = ex.CollisionType.Active;
      engine = TestUtils.engine();

      
      scene = new ex.Scene(engine);
      engine.currentScene = scene;

      spyOn(scene, 'draw').and.callThrough();
      spyOn(uiActor, 'draw').and.callThrough();     
		
   });

   afterEach(() => {
      engine.stop();
   });
	
   it('is drawn when visible', () => {
      uiActor.visible = true;

      scene.add(uiActor);
      scene.draw(engine.ctx, 100);

      expect(uiActor.draw).toHaveBeenCalled();				
   });

   it('is not drawn when not visible', () => {
      uiActor.visible = false;

      scene.add(uiActor);
      scene.draw(engine.ctx, 100);

      expect(uiActor.draw).not.toHaveBeenCalled();				
   });

   it('is drawn on the screen when visible', (done) => {
        uiActor.visible = true;
        scene.add(uiActor);
        scene.draw(engine.ctx, 100);

        imagediff.expectCanvasImageMatches('UIActorSpec/actordraws.png', engine.canvas, done);
   });

   it('is not drawn on the screen when not visible', (done) => {
      uiActor.visible = false;
      scene.add(uiActor);
      scene.draw(engine.ctx, 100);
      
      imagediff.expectCanvasImageMatches('UIActorSpec/actordoesnotdraw.png', engine.canvas, done);
   });

   it('is drawn on the top left with empty constructor', (done) => {
            
      let bg = new ex.Texture('src/spec/images/UIActorSpec/emptyctor.png', true);
      let loader = new ex.Loader();

      loader.addResource(bg);

      engine.width = engine.canvas.width = 720;
      engine.height = engine.canvas.height = 480;

      engine.start(loader).then(() => {
         let uiActor = new ex.UIActor();
         uiActor.addDrawing(bg);
         engine.add(uiActor);

         engine.on('postframe', () => {            
            imagediff.expectCanvasImageMatches('UIActorSpec/emptyctor.png', engine.canvas, done);
            engine.stop();
         });
      });     
      
   });

});