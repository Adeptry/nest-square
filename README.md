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

### Webhooks

To handle Square Webhooks, consider the `SquareWebhookController` class below listens to POST requests on the `square/webhook` route.

This example uses Nest's EventEmitter2 system to publish and listen in Services.

The controller expects a configuration object that includes `webhookSignatureKey`. This key is used to validate incoming webhook events.

```typescript
@Controller("square/webhook")
export class SquareWebhookController {
  private readonly logger = new Logger(SquareWebhookController.name);

  constructor(
    @Inject(YourConfig.KEY)
    private readonly config: ConfigType<typeof YourConfig>,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @ApiExcludeEndpoint()
  @Post()
  post(
    @Headers("x-square-signature") signature: string,
    // Enable raw bodies!
    @Body() body: any,
    @Req() request: Request
  ) {
    this.logger.verbose(this.post.name);
    // WebhooksHelper from Square
    if (
      !WebhooksHelper.isValidWebhookEventSignature(
        body,
        signature,
        this.config.webhookSignatureKey,
        request.url
      )
    ) {
      return;
    }

    this.logger.log(body.type);
    // I'm prefixing the event with `square``, consult Square's documentation for the list.
    this.eventEmitter.emit(`square.${body.type}`, body);
  }
}
```

## Documentation

Please refer to the inline JSDoc comments for more detailed information on each method's usage.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
