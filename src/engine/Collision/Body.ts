import { Vector } from '../Algebra';
import { Collider } from './Collider';
// import { PreCollisionEvent, PostCollisionEvent, CollisionStartEvent, CollisionEndEvent } from '../Events';
import { Clonable } from '../Interfaces/Clonable';
import { TransformComponent } from '../EntityComponentSystem/Components/TransformComponent';
import { MotionComponent } from '../EntityComponentSystem/Components/MotionComponent';
import { Component } from '../EntityComponentSystem/Component';
import { Entity } from '../EntityComponentSystem/Entity';
import { CollisionType } from './CollisionType';
import { BoundingBox } from './BoundingBox';
import { Shape } from './Shape';
import { CollisionGroup } from './CollisionGroup';
import { EventDispatcher } from '../EventDispatcher';
import { CollisionContact } from './CollisionContact';
import { Physics } from '../Physics';
import { CollisionEndEvent, CollisionStartEvent, PostCollisionEvent, PreCollisionEvent } from '../Events';

export interface BodyComponentOptions {
  box?: { width: number, height: number }; 
  colliders?: Collider[];
  type?: CollisionType;
  group?: CollisionGroup;
  anchor?: Vector;
  offset?: Vector;
}

export enum Constraint {
  Rotation = 'rotation',
  X = 'x',
  Y = 'y'
}

/**
 * Body describes all the physical properties pos, vel, acc, rotation, angular velocity for the purpose of 
 * of physics simulation.
 */
export class BodyComponent extends Component<'body'> implements Clonable<Body> {
  public readonly type = 'body';
  public dependencies = [TransformComponent, MotionComponent];
  public static _ID = 0;
  public readonly id = BodyComponent._ID++;
  public events = new EventDispatcher(this);

  constructor(options?: BodyComponentOptions) {
    super();
    if (options) {
      if (options.box) {
        const { box: { width, height }, anchor = Vector.Half, offset = Vector.Zero } = options;
        this.useBoxCollider(width, height, anchor, offset);
      }
      if (this.colliders?.length > 0) {
        this.colliders.forEach(c => this.add(c));
      }
    }
  }

  public collisionType: CollisionType = CollisionType.PreventCollision;

  public group: CollisionGroup = CollisionGroup.All;

  /**
   * 
   */
  public mass: number = Physics.defaultMass;

  // TODO get inertia from shapes
  // TODO https://physics.stackexchange.com/questions/273394/is-moment-of-inertia-cumulative
  // public inertia: number = 1000;
  public get inertia() {
    return this.colliders[0].shape.getInertia(this.mass);
  }

  /**
   * The also known as coefficient of restitution of this actor, represents the amount of energy preserved after collision or the
   * bounciness. If 1, it is 100% bouncy, 0 it completely absorbs.
   */
  public bounciness: number = 0.2;

  
  /**
   * The coefficient of friction on this actor
   */
  public friction: number = 0.99;

  /**
   * Should use global gravity [[Physics.gravity]]
   */
  public useGravity: boolean = true;

  /**
   * Motion constraints
   */
  public constraints: Constraint[] = [];

  /**
   * TODO make list readonly, proxy
   */
  public colliders: Collider[] = [];

  get bounds(): BoundingBox {
    let results: BoundingBox;

    results = this.colliders.reduce(
      (acc, collider) => acc.combine(collider.bounds),
      this.colliders[0]?.bounds ?? new BoundingBox().translate(this.pos)
    );
    
    return results;
  }

  public add(collider: Collider) {
    if (!collider.owningId) {
      collider.owningId = this.id
      collider.body = this;
      this.colliders.push(collider);
      this.events.wire(collider.events);
      // TODO listen to collider events?
    } else {
      // TODO log warning
    }
  }

  /**
   * For each collider in each body run collision on colliders
   * @param other 
   */
  public collide(other: Body): CollisionContact[] {
    const collisions = []

    for (let colliderA of this.colliders) {
      for (let colliderB of other.colliders) {
        const maybeCollision = colliderA.collide(colliderB);
        if (maybeCollision) {
          collisions.push(maybeCollision);
        }
      }
    }

    return collisions;
  }

  public get active() {
    return this.owner?.active;
  }

  public get center() {
    return this.pos;
  }

  public get transform(): TransformComponent {
    // todo should the owner be typed 
    return (this.owner as Entity<TransformComponent>).components.transform;
  }

  public get motion(): MotionComponent {
    // todo owner should have the right types
    return (this.owner as Entity<MotionComponent>).components.motion;
  }

  /**
   * The (x, y) position of the actor this will be in the middle of the actor if the
   * [[Actor.anchor]] is set to (0.5, 0.5) which is default.
   * If you want the (x, y) position to be the top left of the actor specify an anchor of (0, 0).
   */
  public get pos(): Vector {
    return this.transform.pos;
  }

  public set pos(val: Vector) {
    this.transform.pos = val;
  }

  /**
   * The position of the actor last frame (x, y) in pixels
   */
  public oldPos: Vector = new Vector(0, 0);

  /**
   * The current velocity vector (vx, vy) of the actor in pixels/second
   */
  public get vel(): Vector {
    return this.motion.vel;
  }

  public set vel(val: Vector) {
    this.motion.vel = val;
  }

  /**
   * The velocity of the actor last frame (vx, vy) in pixels/second
   */
  public oldVel: Vector = new Vector(0, 0);

  /**
   * The current acceleration vector (ax, ay) of the actor in pixels/second/second. An acceleration pointing down such as (0, 100) may
   * be useful to simulate a gravitational effect.
   */
  public get acc(): Vector {
    return this.motion.acc;
  }

  public set acc(val: Vector) {
    this.motion.acc = val;
  }

  /**
   * Gets/sets the acceleration of the actor from the last frame. This does not include the global acc [[Physics.acc]].
   */
  public oldAcc: Vector = Vector.Zero;

  /**
   * The current torque applied to the actor
   */
  public get torque(): number {
    return this.motion.torque;
  }

  public set torque(val: number) {
    this.motion.torque = val;
  }

  /**
   * Gets/sets the rotation of the body from the last frame.
   */
  public oldRotation: number = 0; // radians

  /**
   * The rotation of the actor in radians
   */
  public get rotation() {
    return this.transform.rotation;
  }

  public set rotation(val: number) {
    this.transform.rotation = val;
  }

  /**
   * The scale vector of the actor
   * @obsolete ex.Body.scale will be removed in v0.25.0
   */
  public scale: Vector = Vector.One;

  /**
   * The scale of the actor last frame
   * @obsolete ex.Body.scale will be removed in v0.25.0
   */
  public oldScale: Vector = Vector.One;

  /**
   * The x scalar velocity of the actor in scale/second
   * @obsolete ex.Body.scale will be removed in v0.25.0
   */
  public sx: number = 0; //scale/sec
  /**
   * The y scalar velocity of the actor in scale/second
   * @obsolete ex.Body.scale will be removed in v0.25.0
   */
  public sy: number = 0; //scale/sec

  /**
   * The rotational velocity of the actor in radians/second
   * @deprecated
   */
  public get rx(): number {
    return this.motion.angularVelocity;
  }

  public set rx(value: number) {
    this.motion.angularVelocity = value;
  }

  public get angularVelocity(): number {
    return this.motion.angularVelocity;
  }

  public set angularVelocity(value: number) {
    this.motion.angularVelocity = value;
  }

  private _totalMtv: Vector = Vector.Zero;

  /**
   * Add minimum translation vectors accumulated during the current frame to resolve collisions.
   */
  public addMtv(mtv: Vector) {
    this._totalMtv.addEqual(mtv);
  }

  /**
   * Applies the accumulated translation vectors to the body's position
   */
  public applyMtv(): void {
    this.pos.addEqual(this._totalMtv);
    this._totalMtv.setTo(0, 0);
  }

  /**
   * Sets the old versions of pos, vel, acc, and scale.
   */
  public captureOldTransform() {
    // Capture old values before integration step updates them
    this.oldVel.setTo(this.vel.x, this.vel.y);
    this.oldPos.setTo(this.pos.x, this.pos.y);
    this.oldAcc.setTo(this.acc.x, this.acc.y);
    this.oldScale.setTo(this.scale.x, this.scale.y);
    this.oldRotation = this.rotation;
  }

  public hasChanged() {
    return (!this.oldPos.equals(this.pos) ||
          this.oldRotation !== this.rotation ||
          this.oldScale !== this.scale)
  }

  onAdd(entity: Entity) {
    this.events.on('precollision', (evt: any) => {
      entity.events.emit('precollision', new PreCollisionEvent(evt.target.owner, evt.other.body.owner, evt.side, evt.intersection));
    });
    this.events.on('postcollision', (evt: any) => {
      entity.events.emit('postcollision', new PostCollisionEvent(evt.target.owner, evt.other.body.owner, evt.side, evt.intersection));
    });
    this.events.on('collisionstart', (evt: any) => {
      entity.events.emit('collisionstart', new CollisionStartEvent(evt.target.owner, evt.other.owner, evt.pair));
    });
    this.events.on('collisionend', (evt: any) => {
      entity.events.emit('collisionend', new CollisionEndEvent(evt.target.owner, evt.other.owner));
    });
  }

  onRemove() {
    this.events.clear();
  }

  update() {
    for (let collider of this.colliders) {
      collider.update();
    }
  }

  /**
   * Sets up a box geometry based on the current bounds of the associated actor of this physics body.
   *
   * If no width/height are specified the body will attempt to use the associated actor's width/height.
   *
   * By default, the box is center is at (0, 0) which means it is centered around the actors anchor.
   */
  public useBoxCollider(width: number, height: number, anchor: Vector = Vector.Half, center: Vector = Vector.Zero): Collider {
    this.colliders = [];
    const collider = new Collider({ shape: Shape.Box(width, height, anchor, center) });
    this.add(collider);
    return collider;
  }

  /**
   * Sets up a [[ConvexPolygon|convex polygon]] collision geometry based on a list of of points relative
   *  to the anchor of the associated actor
   * of this physics body.
   *
   * Only [convex polygon](https://en.wikipedia.org/wiki/Convex_polygon) definitions are supported.
   *
   * By default, the box is center is at (0, 0) which means it is centered around the actors anchor.
   */
  public usePolygonCollider(points: Vector[], center: Vector = Vector.Zero): Collider {
    this.colliders = [];
    const collider = new Collider({ shape: Shape.Polygon(points, false, center)});
    this.add(collider)
    return collider
  }

  /**
   * Sets up a [[Circle|circle collision geometry]] with a specified radius in pixels.
   *
   * By default, the box is center is at (0, 0) which means it is centered around the actors anchor.
   */
  public useCircleCollider(radius: number, center: Vector = Vector.Zero): Collider {
    this.colliders = [];
    const collider = new Collider({ shape: Shape.Circle(radius, center)});
    this.add(collider)
    return collider;
  }

  /**
   * Sets up an [[Edge|edge collision geometry]] with a start point and an end point relative to the anchor of the associated actor
   * of this physics body.
   *
   * By default, the box is center is at (0, 0) which means it is centered around the actors anchor.
   */
  public useEdgeCollider(begin: Vector, end: Vector): Collider {
    this.colliders = [];
    const collider = new Collider({ shape: Shape.Edge(begin, end)});
    this.add(collider);
    return collider;
  }
}


// Alias for backwards compat
export type Body = BodyComponent;