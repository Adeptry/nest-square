import { DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestSquareAsyncOptions } from "./nest-square-async-options.js";
import {
  NEST_SQUARE_CONFIG_INJECTION_KEY,
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
   * Bootstraps the NestSquareModule using configuration values from environment variables.
   * Assumes that environment variables are set up and validates against them.
   *
   * Be sure to add the below to your .env
   *
   * SQUARE_CLIENT_ENVIRONMENT=abc
   * SQUARE_OAUTH_CLIENT_ID=123
   * SQUARE_OAUTH_CLIENT_SECRET=***
   *
   * @returns {DynamicModule} - The configured dynamic module, ready for injection.
   */
  static fromEnv(): DynamicModule {
    return {
      module: NestSquareModule,
      imports: [ConfigModule.forFeature(NestSquareConfig)],
      providers: [NestSquareService],
      exports: [NestSquareService],
    };
  }

  /**
   * Synchronously bootstraps the NestSquareModule with configuration options,
   * if you don't want to use environment variables.
   *
   * @param {NestSquareConfigType} options - Configuration options for the module.
   * @returns {DynamicModule} - The configured dynamic module.
   */
  static forRoot(options: NestSquareConfigType): DynamicModule {
    return {
      module: NestSquareModule,
      providers: [
        NestSquareService,
        {
          provide: NEST_SQUARE_CONFIG_INJECTION_KEY,
          useValue: options,
        },
      ],
      exports: [NestSquareService],
    };
  }

  /**
   * Asynchronously bootstraps the NestSquareModule with configuration options,
   * if you want to use environment variables from your DB or other source.
   *
   * @param {NestSquareAsyncOptions} options - Configuration options for the module.
   * @returns {DynamicModule} - The configured dynamic module.
   */
  static forRootAsync(options: NestSquareAsyncOptions): DynamicModule {
    return {
      module: NestSquareModule,
      imports: [...(options.imports || [])],
      providers: [
        NestSquareService,
        {
          provide: NEST_SQUARE_CONFIG_INJECTION_KEY,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [NestSquareService],
    };
  }
}
