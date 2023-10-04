# nest-square

## Overview

`nest-square` is a NestJS module designed to facilitate easy integration with the Square Node.js SDK.
It endeavors to expose the Square Node.js SDK in a manner idiomatic to Nest, and provides a couple
utilities you can choose to use if they suit your needs.

## Features

- Simplified Square Client instantiation
- Retrying API calls
- Easy uploading of catalog images
- Accumlating `listCatalog` call
- Extensible and asynchronous configuration

## Installation

To install the `nest-square` package, run the following command:

```bash
npm install nest-square @nestjs/common @nestjs/config square
```

Nest.js and Square are peer dependencies.

## Quick Start

Firstly, import `NestSquareModule` into your module:

```typescript
import { NestSquareModule } from "nest-square";

@Module({
  imports: [
    NestSquareModule.forRoot({
      clientEnvironment: "",
      oauthClientId: "",
      oauthClientSecret: "",
    }),
  ],
})
export class AppModule {}
```

Instead of committing these strings, I recommend placing them in your `.env` (and adding it to `.gitignore`):

```bash
SQUARE_CLIENT_ENVIRONMENT=
SQUARE_OAUTH_CLIENT_ID=
SQUARE_OAUTH_CLIENT_SECRET=
```

If you do, you may make use of a the validating configuration convinience:

```typescript
@Module({
  imports: [NestSquareModule.fromEnv()],
})
export class AppModule {}
```

### Using NestSquareService

Once `NestSquareModule` is imported, you can also import `NestSquareService` to use Square functionalities easily:

```typescript
import { NestSquareService } from "nest-square";

@Injectable()
export class AppService {
  constructor(private readonly squareService: NestSquareService) {}

  someFunction() {
    const squareAccessToken = "";
    const squareOrderResponse = await this.squareService.retryOrThrow(
      squareAccessToken,
      (client) =>
        client.ordersApi.createOrder({
          order: {
            locationId: "",
            lineItems: [],
            state: "DRAFT",
          },
        })
    );
  }
}
```

If you do not want to use the retry higher-order-function, you may get a client directly, with or without an access token.

### Retry

The `retryOrThrow` method provides a built-in retry mechanism for dealing with transient issues in your API calls. It retries the provided client function multiple times before eventually throwing an error if all attempts are unsuccessful. This packages uses the default configuration of `p-retry`, and only retries HTTP >500 and 429, denoting an internal Square error or too many requests respectively.

If you find that in the course of development you trigger a 429, you are likely doing something wrong.

### Logging

`nest-square` uses Nest.js's default logger set with class-name context, and verbosely logs every invocation.

### BigInt

To represent money amounts, Square makes use of BigInt. To facilitate serialization, consider including the following Nest pipe:

```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transformBigInt(data)));
  }

  private transformBigInt(object: any): any {
    if (object === null) {
      return null;
    }
    switch (typeof object) {
      case "bigint":
        return object.toString();
      case "object":
        for (const key in object) {
          object[key] = this.transformBigInt(object[key]);
        }
        return object;
      default:
        return object;
    }
  }
}

// In main.ts

app.useGlobalInterceptors(new BigIntInterceptor());
```

This will make so that if an object you provide in response to a request has a BigInt, like say if you return the result of a Square API directly, it will be converted to a String. Modify to suit your applications' needs.

Be sure to check the [documentation](https://developer.squareup.com/docs/sdks/nodejs/setup-project#nodejs-express-and-bigint) on this topic.

### Webhooks

To handle Square Webhooks, consider the `SquareWebhookController` class below listens to POST requests on the `square/webhook` route.

This example uses Nest's EventEmitter2 system to publish and listen in Services.

The controller expects a configuration object that includes `webhookSignatureKey`. This key is used to validate incoming webhook events.

```typescript
@Controller("square/webhook")
export class SquareWebhookController {
  private readonly logger = new Logger(SquareWebhookController.name);

  constructor(
    @Inject(SquareConfig.KEY)
    private readonly squareConfig: ConfigType<typeof SquareConfig>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @ApiExcludeEndpoint()
  @Post()
  post(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-square-hmacsha256-signature") signature?: string
  ) {
    this.logger.verbose(this.post.name);
    const { body, hostname, originalUrl, rawBody } = request;
    const { squareWebhookSignatureKey } = this.squareConfig;

    if (signature && rawBody) {
      const isValid = WebhooksHelper.isValidWebhookEventSignature(
        rawBody.toString(),
        signature,
        squareWebhookSignatureKey,
        `https://${hostname}${originalUrl}`
      );

      if (isValid) {
        this.eventEmitter.emit(`square.${body.type}`, body);
        return;
      }
    }

    this.logger.error("Invalid Square webhook signature");
  }
}
```

## Documentation

Please refer to the inline JSDoc comments for more detailed information on each method's usage.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
