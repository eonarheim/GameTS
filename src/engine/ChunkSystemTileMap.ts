import { Vector } from './Algebra';
import { Class } from './Class';
import { BoundingBox } from './Collision/BoundingBox';
import { Configurable } from './Configurable';
import { Engine } from './Engine';
import * as Events from './Events';
import { SpriteSheet } from './Drawing/SpriteSheet';
import { Cell, TileMap } from './TileMap';

export type ChunkGenerator = (chunkColumn: number, chunkRow: number, chunkSystemTileMap: ChunkSystemTileMap, engine: Engine) => TileMap;
export type BaseChunkGenerator = (
  chunk: TileMap,
  chunkCellColumn: number,
  chunkCellRow: number,
  chunkSystemTileMap: ChunkSystemTileMap,
  engine: Engine
) => TileMap;
export type BaseCellGenerator = (
  cell: Cell,
  cellColumn: number,
  cellRow: number,
  chunk: TileMap,
  chunkSystemTileMape: ChunkSystemTileMap,
  engine: Engine
) => Cell;

export type ChunkSystemGarbageCollectorPredicate = (chunk: TileMap, chunkSystemTileMap: ChunkSystemTileMap, engine: Engine) => boolean;

export type ChunkRenderingCachePredicate = (chunk: TileMap, chunkSystemTileMap: ChunkSystemTileMap, engine: Engine) => boolean;

type CachedTileMap = TileMap & { renderingCache: null | HTMLCanvasElement };

interface ChunkSystemTileMapArgs {
  x: number;
  y: number;
  chunkSize: number;
  cellWidth: number;
  cellHeight: number;
  rows: number;
  cols: number;
  chunkGenerator: ChunkGenerator;
  chunkGarbageCollectorPredicate?: null | ChunkSystemGarbageCollectorPredicate;
  chunkRenderingCachePredicate?: null | ChunkRenderingCachePredicate;
}

/**
 * @hidden
 */
export class ChunkSystemTileMapImpl extends Class {
  public readonly x: number;
  public readonly y: number;
  public readonly cellWidth: number;
  public readonly cellHeight: number;
  public readonly chunkSize: number;
  public readonly cols: number;
  public readonly rows: number;
  public readonly chunkCols: number;
  public readonly chunkRows: number;
  public readonly chunkGenerator: ChunkGenerator;
  public readonly chunkGarbageCollectorPredicate: null | ChunkSystemGarbageCollectorPredicate;
  private readonly _chunks: Array<Array<CachedTileMap | undefined> | undefined>;
  private _chunksXOffset: number;
  private _chunksYOffset: number;
  private readonly _chunksToRender: CachedTileMap[];
  private readonly _spriteSheets: { [key: string]: SpriteSheet };
  private readonly _chunkRenderingCachePredicate: null | ChunkRenderingCachePredicate;

  constructor(config: ChunkSystemTileMapArgs) {
    if (config.chunkSize <= 0 || !Number.isSafeInteger(config.chunkSize)) {
      throw new TypeError(`The chunkSize option must be a positive integer, ${config.chunkSize} was provided`);
    }
    if (config.rows <= 0 || !Number.isSafeInteger(config.rows)) {
      throw new TypeError(`The rows option must be a positive integer, ${config.rows} was provided`);
    }
    if (config.cols <= 0 || !Number.isSafeInteger(config.cols)) {
      throw new TypeError(`The cols option must be a positive integer, ${config.cols} was provided`);
    }
    if (config.cols % config.chunkSize) {
      throw new Error(
        `The cols option must be a multiple of the chunkSize option, ${config.cols} was provided for the cols option, ${config.chunkSize}` +
          ' was provided for the chunkSize option.'
      );
    }
    if (config.rows % config.chunkSize) {
      throw new Error(
        `The rows option must be a multiple of the chunkSize option, ${config.rows} was provided for the rows option, ${config.chunkSize}` +
          ' was provided for the chunkSize option.'
      );
    }

    super();

    this.x = config.x;
    this.y = config.y;
    this.cellWidth = config.cellWidth;
    this.cellHeight = config.cellHeight;
    this.chunkSize = config.chunkSize;
    this.cols = config.cols;
    this.rows = config.rows;
    this.chunkCols = this.cols / this.chunkSize;
    this.chunkRows = this.rows / this.chunkSize;
    this.chunkGenerator = config.chunkGenerator;
    this.chunkGarbageCollectorPredicate = config.chunkGarbageCollectorPredicate || null;
    this._chunks = [];
    this._chunksXOffset = 0;
    this._chunksYOffset = 0;
    this._chunksToRender = [];
    this._spriteSheets = {};
    this._chunkRenderingCachePredicate = config.chunkRenderingCachePredicate || null;
  }

  public registerSpriteSheet(key: string, spriteSheet: SpriteSheet): void {
    this._spriteSheets[key] = spriteSheet;
    for (let rowIndex = 0; rowIndex < this._chunks.length; rowIndex++) {
      const chunkRow = this._chunks[rowIndex];
      for (let columnIndex = 0; columnIndex < chunkRow.length; columnIndex++) {
        const chunk = chunkRow[columnIndex];
        if (chunk) {
          chunk.registerSpriteSheet(key, spriteSheet);
        }
      }
    }
  }

  public getChunk(cellX: number, cellY: number): TileMap | null {
    const chunkX = Math.floor(cellX / this.chunkSize);
    const chunkY = Math.floor(cellY / this.chunkSize);
    const chunkRow = this._chunks[chunkY - this._chunksYOffset];
    const chunk = chunkRow && chunkRow[chunkX - this._chunksXOffset];
    return chunk || null;
  }

  public getCell(cellX: number, cellY: number): Cell | null {
    const chunk = this.getChunk(cellX, cellY);
    if (!chunk) {
      return null;
    }

    return chunk.getCell(cellX % this.chunkSize, cellY % this.chunkSize);
  }

  public getCellByPoint(x: number, y: number): Cell | null {
    const cellX = Math.floor((x - this.x) / this.cellWidth);
    const cellY = Math.floor((y - this.y) / this.cellHeight);
    return this.getCell(cellX, cellY);
  }

  public update(engine: Engine, delta: number): void {
    this.emit('preupdate', new Events.PreUpdateEvent(engine, delta, this));

    const worldCoordsUpperLeft = engine.screenToWorldCoordinates(new Vector(0, 0));
    const worldCoordsLowerRight = engine.screenToWorldCoordinates(new Vector(engine.canvas.clientWidth, engine.canvas.clientHeight));

    const cellOnScreenXStart = Math.floor((worldCoordsUpperLeft.x - this.x) / this.cellWidth) - 2;
    const cellOnScreenYStart = Math.floor((worldCoordsUpperLeft.y - this.y) / this.cellHeight) - 2;
    const cellOnScreenXEnd = Math.floor((worldCoordsLowerRight.x - this.x) / this.cellWidth) + 2;
    const cellOnScreenYEnd = Math.floor((worldCoordsLowerRight.y - this.y) / this.cellHeight) + 2;

    const chunkOnScreenXStart = Math.floor(cellOnScreenXStart / this.chunkSize);
    const chunkOnScreenYStart = Math.floor(cellOnScreenYStart / this.chunkSize);
    const chunkOnScreenXEnd = Math.floor(cellOnScreenXEnd / this.chunkSize);
    const chunkOnScreenYEnd = Math.floor(cellOnScreenYEnd / this.chunkSize);

    if (this.chunkGarbageCollectorPredicate) {
      this._garbageCollectChunks(chunkOnScreenXStart, chunkOnScreenYStart, chunkOnScreenXEnd, chunkOnScreenYEnd, engine);
    }

    const renderChunkXStart = Math.min(Math.max(chunkOnScreenXStart, 0), this.cols / this.chunkSize - 1);
    const renderChunkYStart = Math.min(Math.max(chunkOnScreenYStart, 0), this.rows / this.chunkSize - 1);
    const renderChunkXEnd = Math.min(Math.max(chunkOnScreenXEnd, 0), this.cols / this.chunkSize - 1);
    const renderChunkYEnd = Math.min(Math.max(chunkOnScreenYEnd, 0), this.rows / this.chunkSize - 1);
    if (!this._chunks.length) {
      this._chunksXOffset = renderChunkXStart;
      this._chunksYOffset = renderChunkYStart;
    }

    this._chunksToRender.splice(0);
    if (
      new BoundingBox(renderChunkXStart, renderChunkYStart, renderChunkXEnd, renderChunkYEnd).intersect(
        new BoundingBox(chunkOnScreenXStart, chunkOnScreenYStart, chunkOnScreenXEnd, chunkOnScreenYEnd)
      )
    ) {
      for (let chunkY = renderChunkYStart; chunkY <= renderChunkYEnd; chunkY++) {
        for (let chunkX = renderChunkXStart; chunkX <= renderChunkXEnd; chunkX++) {
          this._chunksToRender.push(this._updateChunk(chunkX, chunkY, engine, delta));
        }
      }
    }

    this.emit('postupdate', new Events.PostUpdateEvent(engine, delta, this));
  }

  public draw(ctx: CanvasRenderingContext2D, delta: number): void {
    this.emit('predraw', new Events.PreDrawEvent(ctx, delta, this));

    for (let i = 0, len = this._chunksToRender.length; i < len; i++) {
      const chunk = this._chunksToRender[i];
      if (chunk.renderingCache) {
        ctx.drawImage(chunk.renderingCache, chunk.x, chunk.y);
      } else {
        chunk.draw(ctx, delta);
      }
    }

    this.emit('postdraw', new Events.PostDrawEvent(ctx, delta, this));
  }

  public debugDraw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0, len = this._chunksToRender.length; i < len; i++) {
      this._chunksToRender[i].debugDraw(ctx);
    }
  }

  private _updateChunk(chunkX: number, chunkY: number, engine: Engine, delta: number): CachedTileMap {
    this._growChunkMatrixForChunkAt(chunkX, chunkY);

    // Create the chunk if it does not exist already and update it
    const chunkRow = this._chunks[chunkY - this._chunksYOffset];
    if (!chunkRow[chunkX - this._chunksXOffset]) {
      const chunk = this.chunkGenerator(chunkX, chunkY, this, engine);
      const spritesToRegister = Object.entries(this._spriteSheets);
      for (let spriteIndex = 0; spriteIndex < spritesToRegister.length; spriteIndex++) {
        const [key, spriteSheet] = spritesToRegister[spriteIndex];
        chunk.registerSpriteSheet(key, spriteSheet);
      }
      chunkRow[chunkX - this._chunksXOffset] = Object.assign(chunk, { renderingCache: null });
    }
    const chunk = chunkRow[chunkX - this._chunksXOffset];

    if (!chunk.renderingCache) {
      if (this._chunkRenderingCachePredicate && this._chunkRenderingCachePredicate(chunk, this, engine)) {
        this._preRenderChunk(chunk, engine, delta);
      } else {
        chunk.update(engine, delta);
      }
    }

    return chunk;
  }

  private _growChunkMatrixForChunkAt(chunkX: number, chunkY: number): void {
    if (chunkX < this._chunksXOffset) {
      for (const row of this._chunks) {
        row.unshift(...new Array(this._chunksXOffset - chunkX));
      }
      this._chunksXOffset = chunkX;
    }
    if (this._chunks.length && chunkX >= this._chunksXOffset + this._chunks[0].length) {
      for (const row of this._chunks) {
        row.push(...new Array(chunkX - (this._chunksXOffset + row.length) + 1));
      }
    }
    const expectedChunkRowLength = this._chunks.length ? this._chunks[0].length : 1;
    while (chunkY < this._chunksYOffset) {
      this._chunks.unshift([...new Array(expectedChunkRowLength)]);
      this._chunksYOffset--;
    }
    while (chunkY >= this._chunksYOffset + this._chunks.length) {
      this._chunks.push([...new Array(expectedChunkRowLength)]);
    }
  }

  private _preRenderChunk(chunk: CachedTileMap, engine: Engine, delta: number): void {
    const chunkOffScreenCulling = chunk.offScreenCulling;
    chunk.offScreenCulling = false;
    chunk.update(engine, delta);

    chunk.renderingCache = document.createElement('canvas');
    chunk.renderingCache.width = chunk.cols * chunk.cellWidth;
    chunk.renderingCache.height = chunk.rows * chunk.cellHeight;
    const cacheRenderingContext = chunk.renderingCache.getContext('2d');
    cacheRenderingContext.translate(-chunk.x, -chunk.y);
    chunk.draw(cacheRenderingContext, delta);

    chunk.offScreenCulling = chunkOffScreenCulling;
  }

  private _garbageCollectChunks(
    chunkOnScreenXStart: number,
    chunkOnScreenYStart: number,
    chunkOnScreenXEnd: number,
    chunkOnScreenYEnd: number,
    engine: Engine
  ): void {
    const onScreenRowIndexStart = chunkOnScreenYStart - this._chunksYOffset;
    const onScreenRowIndexEnd = chunkOnScreenYEnd - this._chunksYOffset;
    const onScreenColumnIndexStart = chunkOnScreenXStart - this._chunksXOffset;
    const onScreenColumnIndexEnd = chunkOnScreenXEnd - this._chunksXOffset;

    let leadingRowsToRemove = 0;
    let trailingRowsToRemove = 0;
    let leadingColumnsToRemove = Number.POSITIVE_INFINITY;
    let trailingColumnsToRemove = Number.POSITIVE_INFINITY;

    for (let chunkRowIndex = 0; chunkRowIndex < this._chunks.length; chunkRowIndex++) {
      const chunkRow = this._chunks[chunkRowIndex];
      let rowCleared = true;

      let removedLeadingChunks = 0;
      let removedTrailingChunks = 0;
      for (let chunkColumnIndex = 0; chunkColumnIndex < chunkRow.length; chunkColumnIndex++) {
        if (
          chunkRowIndex >= onScreenRowIndexStart &&
          chunkRowIndex <= onScreenRowIndexEnd &&
          chunkColumnIndex >= onScreenColumnIndexStart &&
          chunkColumnIndex <= onScreenColumnIndexEnd
        ) {
          rowCleared = false;
          continue;
        }

        const chunk = chunkRow[chunkColumnIndex];
        if (chunk) {
          if (this.chunkGarbageCollectorPredicate(chunk, this, engine)) {
            chunkRow[chunkColumnIndex] = undefined;
          } else {
            rowCleared = false;
          }
        }

        if (chunkColumnIndex < onScreenColumnIndexStart) {
          if (rowCleared) {
            removedLeadingChunks++;
          }
        } else {
          if (chunkRow[chunkColumnIndex]) {
            removedTrailingChunks = 0;
          } else {
            removedTrailingChunks++;
          }
        }
      }
      leadingColumnsToRemove = Math.min(leadingColumnsToRemove, removedLeadingChunks);
      trailingColumnsToRemove = Math.min(trailingColumnsToRemove, removedTrailingChunks);

      if (chunkRowIndex < onScreenRowIndexStart) {
        if (rowCleared && leadingRowsToRemove === chunkRowIndex) {
          leadingRowsToRemove++;
        }
      } else {
        if (rowCleared) {
          trailingRowsToRemove++;
        } else {
          trailingRowsToRemove = 0;
        }
      }
    }

    this._chunks.splice(this._chunks.length - trailingRowsToRemove);
    this._chunks.splice(0, leadingRowsToRemove);
    this._chunksYOffset += leadingRowsToRemove;
    for (let rowIndex = 0; rowIndex < this._chunks.length; rowIndex++) {
      const chunkRow = this._chunks[rowIndex];
      chunkRow.splice(chunkRow.length - trailingColumnsToRemove);
      chunkRow.splice(0, leadingColumnsToRemove);
    }
    this._chunksXOffset += leadingColumnsToRemove;
  }
}

/**
 * The [[ChunkSystemTileMap]] class provides a way to do extremally large scenes with collision
 * without the overhead of actors. As the name implies, the ChunkSystemTileMap is used as a regular
 * [[TileMap]], however its cells are organized into tiled square chunks. This allows loading of the
 * currently needed chunks on demand and unloading the currently unneeded chunks from the memory.
 */
export class ChunkSystemTileMap extends Configurable(ChunkSystemTileMapImpl) {}

export function wrapChunkGenerator(chunkGenerator: BaseChunkGenerator): ChunkGenerator {
  return (chunkColumn: number, chunkRow: number, chunkSystemTileMap: ChunkSystemTileMap, engine: Engine) => {
    const chunkCellColumn = chunkColumn * chunkSystemTileMap.chunkSize;
    const chunkCellRow = chunkRow * chunkSystemTileMap.chunkSize;
    const chunk = new TileMap({
      x: chunkSystemTileMap.x + chunkCellColumn * chunkSystemTileMap.cellWidth,
      y: chunkSystemTileMap.y + chunkCellRow * chunkSystemTileMap.cellHeight,
      cellWidth: chunkSystemTileMap.cellWidth,
      cellHeight: chunkSystemTileMap.cellHeight,
      rows: chunkSystemTileMap.chunkSize,
      cols: chunkSystemTileMap.chunkSize
    });
    return chunkGenerator(chunk, chunkCellColumn, chunkCellRow, chunkSystemTileMap, engine);
  };
}

export function wrapCellGenerator(cellGenerator: BaseCellGenerator): ChunkGenerator {
  return wrapChunkGenerator((chunk, chunkCellColumn, chunkCellRow, chunkSystemTileMap, engine) => {
    const { cols, rows } = chunk;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < cols; column++) {
        const cellIndex = column + row * cols;
        const pregeneratedCell = chunk.getCellByIndex(cellIndex);
        const cell = cellGenerator(pregeneratedCell, chunkCellColumn + column, chunkCellRow + row, chunk, chunkSystemTileMap, engine);
        chunk.data[cellIndex] = cell;
      }
    }
    return chunk;
  });
}