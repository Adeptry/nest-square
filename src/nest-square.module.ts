import { DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestSquareAsyncOptions } from "./nest-square-async-options.js";
import {
  NestSquareConfig,
  NestSquareConfigType,
} from "./nest-square.config.js";
import { NestSquareService } from "./nest-square.service.js";

/**
 * NestSquareModule is the main class where the module is defined.
 *
 * @remarks
 * This module is global and exports `NestSquareService`.
 */
@Global()
@Module({})
export class NestSquareModule {
  /**
   * Synchronously bootstraps the NestSquareModule with configuration options.
   *
   * @param {NestSquareConfigType} options - Configuration options for the module.
   * @returns {DynamicModule} - The configured dynamic module.
   */
  static forRoot(options: NestSquareConfigType): DynamicModule {
    return {
      module: NestSquareModule,
      imports: [ConfigModule.forFeature(NestSquareConfig)],
      providers: [
        NestSquareService,
        {
          provide: "NEST_SQUARE_CONFIG",
          useValue: options,
        },
      ],
      exports: [NestSquareService],
    };
  }

  /**
   * Asynchronously bootstraps the NestSquareModule with configuration options.
   *
   * @param {NestSquareAsyncOptions} options - Configuration options for the module.
   * @returns {DynamicModule} - The configured dynamic module.
   */
  static forRootAsync(options: NestSquareAsyncOptions): DynamicModule {
    return {
      module: NestSquareModule,
      imports: [
        ...(options.imports || []),
        ConfigModule.forFeature(NestSquareConfig),
      ],
      providers: [
        NestSquareService,
        {
          provide: "NEST_SQUARE_CONFIG",
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [NestSquareService],
    };
  }
}
