import { registerAs } from "@nestjs/config";
import { plainToClass } from "class-transformer";
import { IsString, validateSync } from "class-validator";

export const NEST_SQUARE_CONFIG_INJECTION_KEY = "NEST_SQUARE_CONFIG";

export type NestSquareConfigType = {
  clientEnvironment: string;
  oauthClientId: string;
  oauthClientSecret: string;
};

class SquareConfigValidator {
  @IsString()
  SQUARE_OAUTH_CLIENT_ID!: string;

  @IsString()
  SQUARE_OAUTH_CLIENT_SECRET!: string;

  @IsString()
  SQUARE_CLIENT_ENVIRONMENT!: string;
}

export const NestSquareConfig = registerAs<NestSquareConfigType>(
  "square",
  () => {
    const errors = validateSync(
      plainToClass(SquareConfigValidator, process.env, {
        enableImplicitConversion: true,
      }),
      {
        skipMissingProperties: false,
      }
    );

    if (errors.length > 0) {
      throw new Error(errors.toString());
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      clientEnvironment: process.env.SQUARE_CLIENT_ENVIRONMENT!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      oauthClientId: process.env.SQUARE_OAUTH_CLIENT_ID!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      oauthClientSecret: process.env.SQUARE_OAUTH_CLIENT_SECRET!,
    };
  }
);
