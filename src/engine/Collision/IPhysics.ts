module ex {
   export interface IEnginePhysics {
      /**
       * Global engine acceleration, useful for defining consitent gravity on all actors
       */
      acc: Vector;
      /**
       * Number of pos/vel integration steps
       */
      integrationSteps: number;
      /**
       * The integration method
       */
      integrator: string;
      /**
       * Number of collision resultion passes 
       */
      collisionPasses: number;
      /**
       * The epsilon below which objects go to sleep
       */
      sleepEpsilon: number;
      /**
       * Bias motion calculation towards the current frame, or the last frame
       */
      motionBias: number;
      /**
       * Allow rotation in the physics simulation
       */
      allowRotation: boolean;
   }
}