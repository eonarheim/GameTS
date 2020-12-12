import * as ex from '@excalibur';
import { ensureImagesLoaded, ExcaliburMatchers } from 'excalibur-jasmine';

xdescribe('A Circle Graphic', () => {
  beforeEach(() => {
    jasmine.addMatchers(ExcaliburMatchers);
  });

  it('exists', () => {
    expect(ex.Graphics.Circle).toBeDefined();
  });

  it('can have a radius', () => {
    const sut = new ex.Graphics.Circle({
      radius: 10
    });
    expect(sut.radius).toBe(10);
    expect(sut.width).toBe(20);
    expect(sut.height).toBe(20);
  });

  it('can set a color', async () => {
    const sut = new ex.Graphics.Circle({
      radius: 10,
      color: ex.Color.Green,
      strokeColor: ex.Color.Black
    });

    const canvasElement = document.createElement('canvas');
    canvasElement.width = 100;
    canvasElement.height = 100;
    const ctx = new ex.Graphics.ExcaliburGraphicsContext2DCanvas({canvasElement});

    ctx.clear();
    sut.draw(ctx, 50, 50);

    const [actual, image] = await ensureImagesLoaded(canvasElement, 'src/spec/images/GraphicsCircleSpec/circle.png');
    expect(actual).toEqualImage(image);
  });

  it('can be cloned', () => {
    const sut = new ex.Graphics.Circle({
      radius: 10,
      color: ex.Color.Green,
      strokeColor: ex.Color.Black
    });

    const clone = sut.clone();

    expect(clone.radius).toBe(10);
    expect(clone.color).toEqual(ex.Color.Green);
    expect(clone.strokeColor).toEqual(ex.Color.Black);
  });
});